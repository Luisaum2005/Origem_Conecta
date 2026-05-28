import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { formatOrderDate, type OrderStatus, type SavedOrder, useOrders } from "@/lib/orders";
import { Check, ClipboardList, Package, ShieldCheck, Sparkles, Star, Truck } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/tracking")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Tracking />
    </RequireProfile>
  ),
});

const statusFlow: OrderStatus[] = ["Recebido", "Em separação", "Em entrega", "Entregue"];

const stepConfig: Record<
  OrderStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    doneCaption: string;
    pendingCaption: string;
  }
> = {
  Recebido: {
    label: "Pedido recebido",
    icon: ClipboardList,
    doneCaption: "Pedido confirmado na plataforma",
    pendingCaption: "Aguardando confirmação",
  },
  "Em separação": {
    label: "Em separação",
    icon: Package,
    doneCaption: "Produtor separando os itens",
    pendingCaption: "Aguardando separação",
  },
  "Em entrega": {
    label: "Em entrega",
    icon: Truck,
    doneCaption: "Pedido saiu para entrega",
    pendingCaption: "Aguardando saída",
  },
  Entregue: {
    label: "Entregue",
    icon: Check,
    doneCaption: "Entrega concluída",
    pendingCaption: "Aguardando confirmação",
  },
};

function Tracking() {
  const { orders } = useOrders();
  const [selectedId, setSelectedId] = useState("");
  const selectedOrder = useMemo(() => {
    if (!orders.length) return null;
    return orders.find((order) => order.id === selectedId) ?? orders[0];
  }, [orders, selectedId]);

  const currentIndex = selectedOrder ? statusFlow.indexOf(selectedOrder.status) : -1;
  const producers = selectedOrder ? groupByProducer(selectedOrder) : [];
  const timeline = selectedOrder ? buildTimeline(selectedOrder) : [];

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-8 pb-20 sm:px-8 sm:py-10 md:pb-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
              {selectedOrder ? `Pedido #${selectedOrder.id}` : "Rastreamento"}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              Acompanhamento da entrega
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Veja o status real do pedido conforme comprador, produtor ou admin atualizam a
              operação.
            </p>
          </div>

          {orders.length > 0 && (
            <label className="block w-full sm:w-[260px]">
              <span className="text-xs font-semibold text-muted-foreground">Selecionar pedido</span>
              <select
                value={selectedOrder?.id ?? ""}
                onChange={(event) => setSelectedId(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold text-brand-900 focus:border-leaf-600 focus:outline-none"
              >
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    #{order.id} - {order.status}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {!selectedOrder ? (
          <EmptyState />
        ) : (
          <>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-info-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-info-fg)]">
              <Sparkles className="h-3.5 w-3.5" />
              Status atual: {selectedOrder.status} - entrega {selectedOrder.deliveryEta}
            </div>

            <section className="mt-8 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
              <ol className="relative grid grid-cols-1 gap-8 md:grid-cols-4">
                {statusFlow.map((status, index) => {
                  const config = stepConfig[status];
                  const done = index < currentIndex || selectedOrder.status === "Entregue";
                  const current = index === currentIndex && selectedOrder.status !== "Entregue";
                  const Icon = config.icon;

                  return (
                    <li key={status} className="relative flex items-start gap-4">
                      {index < statusFlow.length - 1 && (
                        <span
                          className={`absolute left-6 top-12 h-full w-0.5 md:left-12 md:right-0 md:top-6 md:h-0.5 md:w-auto ${
                            index < currentIndex ? "bg-leaf-600" : "bg-surface-muted"
                          }`}
                        />
                      )}
                      <span
                        className={`relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full transition-all ${
                          done
                            ? "bg-leaf-600 text-white"
                            : current
                              ? "scale-105 bg-brand-900 text-white ring-4 ring-leaf-100"
                              : "bg-surface-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-brand-900">
                          {config.label}
                          {current && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                              em curso
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {done || current ? config.doneCaption : config.pendingCaption}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-8 border-t border-border pt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Linha do tempo
                </p>
                <ul className="mt-3 space-y-2.5">
                  {timeline.map((event) => (
                    <li key={event.label} className="flex items-center gap-3 text-sm">
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full ${
                          event.done
                            ? "bg-leaf-100 text-brand-700"
                            : "bg-surface-muted text-muted-foreground"
                        }`}
                      >
                        {event.done ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        )}
                      </span>
                      <span className="w-28 text-xs font-mono text-muted-foreground">
                        {event.time}
                      </span>
                      <span className={event.done ? "text-brand-900" : "text-muted-foreground"}>
                        {event.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border-strong)] bg-surface-brand-soft p-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-leaf-700" />
                  <h3 className="font-semibold text-brand-900">Produtores neste pedido</h3>
                </div>
                <ul className="mt-4 space-y-3 text-sm">
                  {producers.map((producer) => (
                    <li
                      key={producer.name}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3"
                    >
                      <span className="font-medium text-brand-900">{producer.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {producer.products.join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-white p-6">
                <h3 className="font-semibold text-brand-900">Avaliação pós-entrega</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedOrder.status === "Entregue"
                    ? "Pedido entregue. A avaliação já pode ser registrada."
                    : "Disponível quando o pedido for marcado como entregue."}
                </p>
                <Link
                  to="/rating"
                  className={`mt-4 inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${
                    selectedOrder.status === "Entregue"
                      ? "border-leaf-600 bg-leaf-600 text-white hover:bg-leaf-700"
                      : "border-border bg-white text-muted-foreground hover:border-leaf-500 hover:text-brand-900"
                  }`}
                >
                  <Star className="h-4 w-4" />
                  Avaliar entrega
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-white p-12 text-center">
      <h3 className="text-lg font-semibold text-brand-900">Nenhum pedido para rastrear</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Crie um pedido no portfólio para acompanhar o status por aqui.
      </p>
      <Link
        to="/portfolio"
        className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-900 px-5 text-sm font-semibold text-white hover:bg-brand-800"
      >
        Ver portfólio
      </Link>
    </div>
  );
}

function groupByProducer(order: SavedOrder) {
  const map = new Map<string, string[]>();
  for (const item of order.items) {
    const current = map.get(item.producerName) ?? [];
    current.push(item.productName);
    map.set(item.producerName, current);
  }
  return Array.from(map.entries()).map(([name, products]) => ({ name, products }));
}

function buildTimeline(order: SavedOrder) {
  const currentIndex = statusFlow.indexOf(order.status);
  const createdAt = formatOrderDate(order.createdAt);

  return statusFlow.map((status, index) => {
    const done = index <= currentIndex;
    const labelByStatus: Record<OrderStatus, string> = {
      Recebido: "Pedido confirmado",
      "Em separação": "Separação iniciada com os produtores",
      "Em entrega": "Saiu para entrega",
      Entregue: "Entrega concluída",
    };

    return {
      label: labelByStatus[status],
      time: index === 0 ? createdAt : done ? "Atualizado" : "Pendente",
      done,
    };
  });
}
