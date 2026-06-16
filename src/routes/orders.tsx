import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { SupportButton } from "@/components/layout/SupportButton";
import { useAvailableProducts } from "@/lib/available-products";
import { useCart } from "@/lib/cart";
import { getOperationWindow } from "@/lib/operation";
import {
  canCancelOrder,
  formatCancellationDeadline,
  formatOrderDate,
  type SavedOrder,
  useOrders,
} from "@/lib/orders";
import { type RecurringOrder, useRecurringOrders } from "@/lib/recurring-orders";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  PackageCheck,
  Repeat,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/orders")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Orders />
    </RequireProfile>
  ),
});

function Orders() {
  const { orders, cancelOrder, openComplaint } = useOrders();
  const operation = getOperationWindow();
  const { recurringOrders, toggleRecurringOrder, removeRecurringOrder } = useRecurringOrders();
  const products = useAvailableProducts();
  const { replaceCart } = useCart();
  const navigate = useNavigate();
  const [repeatNotice, setRepeatNotice] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const openOrders = orders.filter(
    (order) => order.status !== "Entregue" && order.status !== "Cancelado",
  );
  const deliveredOrders = orders.filter((order) => order.status === "Entregue");
  const availableProductIds = new Set(products.map((product) => product.id));

  useEffect(() => {
    const notice = window.sessionStorage.getItem("origem-conecta-order-success");
    if (!notice) return;
    setSuccessNotice(notice);
    window.sessionStorage.removeItem("origem-conecta-order-success");
  }, []);

  const loadItemsToCart = (items: RecurringOrder["items"], successMessage: string) => {
    const nextCart: Record<string, number> = {};
    const nextProducerChoices: Record<string, string> = {};
    let skippedItems = 0;

    for (const item of items) {
      if (!availableProductIds.has(item.productId)) {
        skippedItems += 1;
        continue;
      }
      nextCart[item.productId] = item.quantity;
      if (item.manualProducerChoice) {
        nextProducerChoices[item.productId] = item.producerId;
      }
    }

    replaceCart(nextCart, nextProducerChoices);
    if (!Object.keys(nextCart).length) {
      setRepeatNotice(
        "Nenhum item deste pedido está disponível no estoque atual. Escolha novos produtos no portfólio.",
      );
    } else if (skippedItems > 0) {
      window.sessionStorage.setItem(
        "origem-conecta-repeat-notice",
        `${skippedItems} item(ns) não entraram porque não estão disponíveis no estoque atual.`,
      );
    } else {
      window.sessionStorage.setItem("origem-conecta-repeat-notice", successMessage);
    }
    navigate({ to: Object.keys(nextCart).length ? "/order" : "/portfolio" });
  };

  const repeatOrder = (orderId: string) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;
    loadItemsToCart(order.items, "Pedido anterior carregado para revisão.");
  };

  const loadRecurringOrder = (recurringOrder: RecurringOrder) => {
    loadItemsToCart(recurringOrder.items, "Pedido recorrente carregado para revisão.");
  };

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-8 pb-24 sm:px-8 sm:py-10 md:pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/portfolio"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao portfólio
          </Link>
          <SupportButton compact />
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Comprador
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              Meus pedidos
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Acompanhe pedidos em andamento, produtores envolvidos e histórico de compra.
            </p>
          </div>
          <Link
            to="/portfolio"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-900 px-4 text-sm font-semibold text-white hover:bg-brand-800"
          >
            <ShoppingBag className="h-4 w-4" />
            Novo pedido
          </Link>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric icon={ClipboardList} label="Pedidos totais" value={`${orders.length}`} />
          <Metric icon={Truck} label="Em andamento" value={`${openOrders.length}`} />
          <Metric icon={PackageCheck} label="Entregues" value={`${deliveredOrders.length}`} />
        </section>

        {successNotice && (
          <div className="mt-4 rounded-xl border border-leaf-200 bg-leaf-50 px-4 py-3 text-sm font-semibold text-brand-900">
            {successNotice}
          </div>
        )}

        {repeatNotice && (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
            {repeatNotice}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-border bg-white px-4 py-3 text-sm text-muted-foreground">
          {operation.issueText}
        </div>

        {recurringOrders.length > 0 && (
          <section className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-xs">
            <div>
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-brand-900">
                <CalendarClock className="h-4 w-4 text-leaf-700" />
                Pedidos recorrentes
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Carregue um modelo salvo, revise quantidades e confirme quando quiser.
              </p>
            </div>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {recurringOrders.map((recurringOrder) => (
                <li
                  key={recurringOrder.id}
                  className="rounded-xl border border-border bg-canvas p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-brand-900">{recurringOrder.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {recurringOrder.frequency} · {recurringOrder.items.length} item(ns)
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        recurringOrder.active
                          ? "bg-[var(--color-success-bg)] text-[var(--color-success-fg)]"
                          : "bg-surface-muted text-muted-foreground"
                      }`}
                    >
                      {recurringOrder.active ? "ativo" : "pausado"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => loadRecurringOrder(recurringOrder)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
                    >
                      <Repeat className="h-4 w-4 text-leaf-700" />
                      Carregar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleRecurringOrder(recurringOrder.id)}
                      className="inline-flex h-9 items-center rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
                    >
                      {recurringOrder.active ? "Pausar" : "Ativar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecurringOrder(recurringOrder.id)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--color-error-bg)] bg-white px-3 text-sm font-semibold text-[var(--color-error-fg)] hover:bg-[var(--color-error-bg)]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {orders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-border bg-white p-12 text-center">
            <h3 className="text-lg font-semibold text-brand-900">Nenhum pedido criado ainda</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Monte um pedido no portfólio para acompanhar por aqui.
            </p>
            <Link
              to="/portfolio"
              className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-900 px-5 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Ver portfólio
            </Link>
          </div>
        ) : (
          <section className="mt-8 grid gap-4">
            {orders.map((order) => (
              <BuyerOrderCard
                key={order.id}
                order={order}
                repeatOrder={repeatOrder}
                cancelOrder={cancelOrder}
                openComplaint={openComplaint}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function BuyerOrderCard({
  order,
  repeatOrder,
  cancelOrder,
  openComplaint,
}: {
  order: SavedOrder;
  repeatOrder: (orderId: string) => void;
  cancelOrder: (id: string, actor: "comprador", reason: string) => Promise<void>;
  openComplaint: (id: string, complaint: string) => Promise<void>;
}) {
  const [cancelReason, setCancelReason] = useState("");
  const [complaint, setComplaint] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const cancelAllowed = canCancelOrder(order);

  const cancel = async () => {
    setError("");
    setMessage("");
    try {
      await cancelOrder(order.id, "comprador", cancelReason);
      setMessage("Pedido cancelado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cancelar o pedido.");
    }
  };

  const complain = async () => {
    setError("");
    setMessage("");
    try {
      await openComplaint(order.id, complaint);
      setComplaint("");
      setMessage("Reclamação enviada. Nossa operação vai acompanhar este pedido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a reclamação.");
    }
  };

  return (
    <article className="rounded-2xl border border-border bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
            Pedido #{order.id}
          </p>
          <h2 className="mt-1 text-xl font-bold text-brand-900">
            {order.items.length} item{order.items.length > 1 ? "s" : ""} · R$ {order.total.toFixed(2)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Criado em {formatOrderDate(order.createdAt)} · entrega {order.deliveryEta}
          </p>
          {order.status !== "Cancelado" && order.status !== "Entregue" && (
            <p className="mt-1 text-xs font-semibold text-orange-700">
              Pode cancelar até {formatCancellationDeadline(order)}
            </p>
          )}
          <p className="mt-1 text-sm font-semibold text-brand-900">
            Pagamento: {order.paymentMethod ?? "A combinar"}
          </p>
          {order.paymentNotes && (
            <p className="mt-1 text-xs text-muted-foreground">{order.paymentNotes}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/tracking"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
            >
              <Truck className="h-4 w-4 text-leaf-700" />
              Rastrear pedido
            </Link>
            <button
              type="button"
              onClick={() => repeatOrder(order.id)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
            >
              <Repeat className="h-4 w-4 text-leaf-700" />
              Repetir pedido
            </button>
          </div>
        </div>
        <div className="min-w-[180px]">
          <span className="text-xs font-semibold text-muted-foreground">Status</span>
          <p className="mt-1 inline-flex h-10 items-center rounded-lg border border-border bg-canvas px-3 text-sm font-semibold text-brand-900">
            {order.status}
          </p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-canvas">
        {order.items.map((item) => (
          <li
            key={`${order.id}-${item.productId}`}
            className="flex flex-wrap items-start justify-between gap-3 p-4"
          >
            <div>
              <p className="font-semibold text-brand-900">{item.productName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Produtor: {item.producerName} ·{" "}
                {item.manualProducerChoice ? "produtor escolhido" : "produtor automático"}
              </p>
              {item.notes && (
                <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-brand-900">
                  {item.notes}
                </p>
              )}
            </div>
            <p className="text-sm font-semibold text-brand-900">
              {item.quantity.toLocaleString("pt-BR")} {item.unit} · R$ {item.lineTotal.toFixed(2)}
            </p>
          </li>
        ))}
      </ul>

      {order.status !== "Recebido" && order.status !== "Cancelado" && (
        <div className="mt-4 rounded-xl border border-leaf-200 bg-leaf-50 p-4 text-sm text-brand-900">
          <p className="font-semibold">Resumo confirmado pelo produtor</p>
          <p className="mt-1">
            Entrega confirmada para {order.deliveryEta}. Informe o código abaixo ao produtor
            somente no momento do recebimento.
          </p>
          <p className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-lg font-bold tracking-widest">
            Código: {order.deliveryCode ?? "gerando"}
          </p>
          {order.receiptCode && (
            <p className="mt-2 text-sm font-semibold">Recibo: {order.receiptCode}</p>
          )}
          <ul className="mt-3 space-y-1 text-xs">
            {order.items.map((item) => (
              <li key={`${order.id}-summary-${item.productId}`}>
                {item.productName}: {item.quantity.toLocaleString("pt-BR")} {item.unit} ·{" "}
                {item.producerName} · R$ {item.lineTotal.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.status === "Cancelado" && (
        <div className="mt-4 rounded-xl border border-[var(--color-error-bg)] bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error-fg)]">
          <p className="font-semibold">Pedido cancelado</p>
          <p className="mt-1">
            Cancelado por {order.canceledBy ?? "usuário"}:{" "}
            {order.cancellationReason ?? "sem motivo informado"}
          </p>
        </div>
      )}

      {cancelAllowed && (
        <div className="mt-4 grid gap-2 rounded-xl border border-border bg-canvas p-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="text-xs font-semibold text-brand-900">Motivo do cancelamento</span>
            <input
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Opcional"
              className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void cancel()}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--color-error-bg)] bg-white px-3 text-sm font-semibold text-[var(--color-error-fg)] hover:bg-[var(--color-error-bg)]"
          >
            Cancelar pedido
          </button>
        </div>
      )}

      {order.status !== "Cancelado" && (
        <div className="mt-4 rounded-xl border border-border bg-white p-3">
          <label className="block">
            <span className="text-xs font-semibold text-brand-900">
              Produto não chegou ou veio diferente?
            </span>
            <textarea
              value={complaint}
              onChange={(event) => setComplaint(event.target.value)}
              rows={3}
              placeholder="Descreva o problema para a operação acompanhar."
              className="mt-2 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void complain()}
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500 sm:w-auto"
          >
            Enviar reclamação
          </button>
          {order.complaint && (
            <p className="mt-2 text-xs font-semibold text-orange-700">
              Reclamação em aberto: {order.complaint}
            </p>
          )}
        </div>
      )}

      {message && (
        <p className="mt-3 rounded-xl border border-leaf-200 bg-leaf-50 px-4 py-3 text-sm font-semibold text-brand-900">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-[var(--color-error-bg)] px-4 py-3 text-sm font-semibold text-[var(--color-error-fg)]">
          {error}
        </p>
      )}
    </article>
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
