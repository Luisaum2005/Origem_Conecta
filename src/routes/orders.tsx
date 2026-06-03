import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { useAvailableProducts } from "@/lib/available-products";
import { useCart } from "@/lib/cart";
import { formatOrderDate, useOrders } from "@/lib/orders";
import { type RecurringOrder, useRecurringOrders } from "@/lib/recurring-orders";
import {
  CalendarClock,
  ClipboardList,
  PackageCheck,
  Repeat,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/orders")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Orders />
    </RequireProfile>
  ),
});

function Orders() {
  const { orders } = useOrders();
  const { recurringOrders, toggleRecurringOrder, removeRecurringOrder } = useRecurringOrders();
  const products = useAvailableProducts();
  const { replaceCart } = useCart();
  const navigate = useNavigate();
  const [repeatNotice, setRepeatNotice] = useState("");
  const openOrders = orders.filter((order) => order.status !== "Entregue");
  const deliveredOrders = orders.filter((order) => order.status === "Entregue");
  const availableProductIds = new Set(products.map((product) => product.id));

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
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">Comprador</p>
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

        {repeatNotice && (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
            {repeatNotice}
          </div>
        )}

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
                        {recurringOrder.frequency} - {recurringOrder.items.length} item(ns)
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
              <article
                key={order.id}
                className="rounded-2xl border border-border bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
                      Pedido #{order.id}
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-brand-900">
                      {order.items.length} item{order.items.length > 1 ? "s" : ""} - R${" "}
                      {order.total.toFixed(2)}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Criado em {formatOrderDate(order.createdAt)} - entrega {order.deliveryEta}
                    </p>
                    <Link
                      to="/tracking"
                      className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
                    >
                      <Truck className="h-4 w-4 text-leaf-700" />
                      Rastrear pedido
                    </Link>
                    <button
                      type="button"
                      onClick={() => repeatOrder(order.id)}
                      className="ml-2 mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
                    >
                      <Repeat className="h-4 w-4 text-leaf-700" />
                      Repetir pedido
                    </button>
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
                      className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <div>
                        <p className="font-semibold text-brand-900">{item.productName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.producerName} -{" "}
                          {item.manualProducerChoice ? "produtor escolhido" : "produtor automático"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-brand-900">
                        {item.quantity} {item.unit} - R$ {item.lineTotal.toFixed(2)}
                      </p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
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
