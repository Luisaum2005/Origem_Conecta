import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/auth";
import {
  canCancelOrder,
  formatCancellationDeadline,
  formatOrderDate,
  type OrderStatus,
  type SavedOrder,
  useOrders,
} from "@/lib/orders";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  ShoppingBag,
  Sprout,
  Truck,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/producer/orders")({
  component: () => (
    <RequireProfile allowed={["produtor"]}>
      <ProducerOrders />
    </RequireProfile>
  ),
});

const PRODUCER_ID = "produtor";
const PRODUCER_NAME = "Produtor";

function ProducerOrders() {
  const { profile, isSupabaseConfigured } = useAuth();
  const { orders, updateStatus, confirmDelivery, cancelOrder, completeDelivery } = useOrders();
  const producerName = profile?.tipo === "produtor" ? profile.nome : PRODUCER_NAME;
  const producerOrders = getProducerOrders(
    orders,
    Boolean(isSupabaseConfigured && profile?.tipo === "produtor"),
  );

  const openOrders = producerOrders.filter(
    (order) => order.status !== "Entregue" && order.status !== "Cancelado",
  );
  const deliveredOrders = producerOrders.filter((order) => order.status === "Entregue");
  const totalRevenue = producerOrders.reduce((sum, order) => sum + producerOrderTotal(order), 0);
  const topProducts = productSummary(producerOrders);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-8 pb-24 sm:px-8 sm:py-10 md:pb-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Painel do produtor
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              Pedidos recebidos
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Acompanhe os pedidos de {producerName}, confirme data e hora de entrega e avance o
              status operacional.
            </p>
          </div>
          <Link
            to="/production"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 text-sm font-semibold text-white hover:bg-brand-800 sm:w-auto"
          >
            <Sprout className="h-4 w-4" />
            Gerenciar estoque
          </Link>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={ClipboardList}
            label="Pedidos recebidos"
            value={`${producerOrders.length}`}
          />
          <Metric icon={Truck} label="Em andamento" value={`${openOrders.length}`} />
          <Metric icon={PackageCheck} label="Entregues" value={`${deliveredOrders.length}`} />
          <Metric
            icon={ShoppingBag}
            label="Receita vinculada"
            value={`R$ ${totalRevenue.toFixed(2)}`}
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel title="Fila operacional" icon={ClipboardList}>
            {producerOrders.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="space-y-4">
                {producerOrders.map((order) => (
                  <ProducerOrderCard
                    key={order.id}
                    order={order}
                    updateStatus={updateStatus}
                    confirmDelivery={confirmDelivery}
                    cancelOrder={cancelOrder}
                    completeDelivery={completeDelivery}
                  />
                ))}
              </ul>
            )}
          </Panel>

          <div className="space-y-6">
            <Panel title="Produtos mais vendidos" icon={PackageCheck}>
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Os produtos aparecem aqui quando houver pedidos para o produtor.
                </p>
              ) : (
                <ul className="space-y-3">
                  {topProducts.map((product) => (
                    <li
                      key={product.name}
                      className="rounded-xl border border-border bg-canvas p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-brand-900">{product.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {product.quantity.toLocaleString("pt-BR")} {product.unit} vendidos
                          </p>
                        </div>
                        <p className="text-sm font-bold text-brand-900">
                          R$ {product.total.toFixed(2)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Próximas ações" icon={CheckCircle2}>
              <ul className="space-y-3">
                <ActionItem title="Recebido" text="Informe data e hora de entrega para confirmar." />
                <ActionItem title="Em separação" text="Prepare lote, embalagem e conferência." />
                <ActionItem title="Em entrega" text="Acompanhe a saída até a baixa do pedido." />
              </ul>
            </Panel>
          </div>
        </section>
      </main>
    </div>
  );
}

function ProducerOrderCard({
  order,
  updateStatus,
  confirmDelivery,
  cancelOrder,
  completeDelivery,
}: {
  order: SavedOrder;
  updateStatus: (id: string, status: OrderStatus) => Promise<void>;
  confirmDelivery: (id: string, deliveryAt: string) => Promise<void>;
  cancelOrder: (id: string, actor: "produtor", reason: string) => Promise<void>;
  completeDelivery: (id: string, code: string) => Promise<void>;
}) {
  const total = producerOrderTotal(order);
  const [deliveryAt, setDeliveryAt] = useState("");
  const [deliveryCode, setDeliveryCode] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const cancelAllowed = canCancelOrder(order);

  const confirmOrder = async () => {
    if (!deliveryAt) {
      setError("Informe a data e a hora da entrega antes de confirmar o pedido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await confirmDelivery(order.id, deliveryAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar o pedido.");
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    setSaving(true);
    setError("");
    try {
      await cancelOrder(order.id, "produtor", cancelReason);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cancelar o pedido.");
    } finally {
      setSaving(false);
    }
  };

  const finishDelivery = async () => {
    if (!deliveryCode.trim()) {
      setError("Informe o código recebido do comprador para concluir a entrega.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await completeDelivery(order.id, deliveryCode);
      setDeliveryCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a entrega.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
            Pedido #{order.id}
          </p>
          <h3 className="mt-1 text-lg font-bold text-brand-900">
            {order.buyerName} - R$ {total.toFixed(2)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatOrderDate(order.createdAt)} - entrega {order.deliveryEta}
          </p>
          {order.status !== "Cancelado" && (
            <p className="mt-1 text-xs font-semibold text-orange-700">
              Cancelamento permitido até {formatCancellationDeadline(order)}
            </p>
          )}
          {order.status === "Cancelado" && (
            <p className="mt-1 text-xs font-semibold text-[var(--color-error-fg)]">
              Cancelado por {order.canceledBy ?? "usuário"}:{" "}
              {order.cancellationReason ?? "sem motivo informado"}
            </p>
          )}
          <p className="mt-1 text-sm font-semibold text-brand-900">
            Pagamento: {order.paymentMethod ?? "A combinar"}
          </p>
          {order.paymentNotes && (
            <p className="mt-1 text-xs text-muted-foreground">{order.paymentNotes}</p>
          )}
        </div>

        <div className="block w-full sm:w-auto sm:min-w-[180px]">
          <span className="text-xs font-semibold text-muted-foreground">Status</span>
          <p className="mt-1 inline-flex h-10 w-full items-center rounded-lg border border-border bg-canvas px-3 text-sm font-semibold text-brand-900">
            {order.status}
          </p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-canvas">
        {order.items.map((item) => (
          <li
            key={`${order.id}-${item.productId}`}
            className="flex flex-wrap items-start justify-between gap-3 p-4"
          >
            <div>
              <p className="font-semibold text-brand-900">{item.productName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.quantity.toLocaleString("pt-BR")} {item.unit} - R$ {item.unitPrice.toFixed(2)}
                /{item.unit}
              </p>
              {item.notes && (
                <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-brand-900">
                  {item.notes}
                </p>
              )}
            </div>
            <p className="text-sm font-bold text-brand-900">R$ {item.lineTotal.toFixed(2)}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:flex sm:flex-wrap">
        {order.status === "Recebido" && (
          <div className="grid w-full gap-2 rounded-xl border border-border bg-canvas p-3 sm:grid-cols-[minmax(220px,280px)_auto] sm:items-end">
            <label className="block">
              <span className="text-xs font-semibold text-brand-900">Data e hora da entrega</span>
              <input
                type="datetime-local"
                value={deliveryAt}
                onChange={(event) => setDeliveryAt(event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void confirmOrder()}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-900 px-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              <CalendarClock className="h-4 w-4" />
              {saving ? "Confirmando..." : "Confirmar pedido"}
            </button>
            {error && (
              <p className="rounded-lg bg-[var(--color-error-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-error-fg)] sm:col-span-2">
                {error}
              </p>
            )}
          </div>
        )}
        {order.status === "Em separação" && (
          <button
            type="button"
            onClick={() => void updateStatus(order.id, "Em entrega")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500 sm:h-10"
          >
            <Truck className="h-4 w-4 text-leaf-700" />
            Saiu para entrega
          </button>
        )}
        {order.status === "Em entrega" && (
          <div className="grid w-full gap-2 rounded-xl border border-border bg-canvas p-3 sm:grid-cols-[minmax(160px,220px)_auto] sm:items-end">
            <label className="block">
              <span className="text-xs font-semibold text-brand-900">Código do comprador</span>
              <input
                value={deliveryCode}
                onChange={(event) => setDeliveryCode(event.target.value)}
                inputMode="numeric"
                placeholder="Ex: 1234"
                className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void finishDelivery()}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-900 px-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              <PackageCheck className="h-4 w-4" />
              Concluir entrega
            </button>
          </div>
        )}
        {cancelAllowed && (
          <div className="grid w-full gap-2 rounded-xl border border-[var(--color-error-bg)] bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="text-xs font-semibold text-brand-900">Motivo do cancelamento</span>
              <input
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Ex: sem disponibilidade para atender"
                className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--color-error-bg)] bg-white px-3 text-sm font-semibold text-[var(--color-error-fg)] hover:bg-[var(--color-error-bg)] disabled:opacity-60"
            >
              Cancelar pedido
            </button>
          </div>
        )}
        {order.status === "Entregue" && (
          <div className="w-full rounded-xl border border-leaf-200 bg-leaf-50 p-3 text-sm text-brand-900">
            <p className="font-semibold">Entrega concluída</p>
            <p className="mt-1">Recibo: {order.receiptCode ?? "gerado na confirmação"}</p>
          </div>
        )}
      </div>
    </li>
  );
}

function producerOrderTotal(order: SavedOrder) {
  return order.items.reduce((sum, item) => sum + item.lineTotal, 0);
}

function productSummary(orders: SavedOrder[]) {
  const map = new Map<string, { name: string; quantity: number; unit: string; total: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = map.get(item.productName) ?? {
        name: item.productName,
        quantity: 0,
        unit: item.unit,
        total: 0,
      };
      current.quantity += item.quantity;
      current.total += item.lineTotal;
      map.set(item.productName, current);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

function getProducerOrders(orders: SavedOrder[], alreadyScoped: boolean) {
  if (alreadyScoped) return orders.filter((order) => order.items.length > 0);
  return orders
    .map((order) => ({
      ...order,
      items: order.items.filter((item) => item.producerId === PRODUCER_ID),
    }))
    .filter((order) => order.items.length > 0);
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-border bg-canvas p-8 text-center">
      <h3 className="text-base font-semibold text-brand-900">Nenhum pedido recebido ainda</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Quando um comprador escolher produtos deste produtor, o pedido aparece aqui.
      </p>
    </div>
  );
}

function ActionItem({ title, text }: { title: string; text: string }) {
  return (
    <li className="rounded-xl border border-border bg-canvas p-4">
      <p className="text-sm font-semibold text-brand-900">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </li>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-xs sm:p-6">
      <h2 className="inline-flex items-center gap-2 text-base font-semibold text-brand-900">
        <Icon className="h-4 w-4 text-leaf-700" />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-100 text-brand-700">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-brand-900">{value}</p>
    </div>
  );
}
