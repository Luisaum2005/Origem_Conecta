import { createFileRoute } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/auth";
import { formatOrderDate, type OrderStatus, useOrders } from "@/lib/orders";
import { useProducerStock } from "@/lib/producer-stock";
import { useRegisteredProducers } from "@/lib/producers";
import { useQuoteRequests } from "@/lib/quote-requests";
import {
  ClipboardList,
  MessageSquareText,
  Package,
  RotateCcw,
  Route as RouteIcon,
  Sprout,
  Store,
  Trash2,
  Truck,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: () => (
    <RequireProfile allowed={["admin"]}>
      <Admin />
    </RequireProfile>
  ),
});

function Admin() {
  const { isSupabaseConfigured } = useAuth();
  const { orders } = useOrders();
  const [stock] = useProducerStock();
  const { quotes } = useQuoteRequests();
  const { producers, loading: producersLoading } = useRegisteredProducers();
  const activeStock = stock.filter((item) => item.status === "ativo");
  const openOrders = orders.filter((order) => order.status !== "Entregue");
  const openQuotes = quotes.filter(
    (quote) => quote.status === "Aberta" || quote.status === "Respondida",
  );
  const totalValue = orders.reduce((sum, order) => sum + order.total, 0);

  const clearLocalTestData = () => {
    if (typeof window === "undefined") return;
    const confirmed = window.confirm("Limpar todos os dados locais de teste deste navegador?");
    if (!confirmed) return;
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("origem-conecta-"))
      .forEach((key) => window.localStorage.removeItem(key));
    window.location.assign("/login");
  };

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-8 pb-24 sm:px-8 sm:py-10 md:pb-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Administração Origem
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              Central de acompanhamento
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Acompanhe pedidos, produtores, estoque publicado e andamento das entregas. O status
              dos pedidos é alterado pelo produtor.
            </p>
          </div>
          <a
            href="#admin-stock"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-brand-900 hover:border-leaf-500 sm:w-auto"
          >
            <Sprout className="h-4 w-4 text-leaf-700" />
            Ver estoque
          </a>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={ClipboardList} label="Pedidos criados" value={`${orders.length}`} />
          <Metric icon={Truck} label="Em andamento" value={`${openOrders.length}`} />
          <Metric icon={Package} label="Produtos ativos" value={`${activeStock.length}`} />
          <Metric
            icon={MessageSquareText}
            label="Cotações abertas"
            value={`${openQuotes.length}`}
          />
        </section>

        <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Store} label="Valor em pedidos" value={`R$ ${totalValue.toFixed(2)}`} />
          <Metric
            icon={RouteIcon}
            label="Produtores cadastrados"
            value={producersLoading ? "..." : `${producers.length}`}
          />
          <Metric icon={Sprout} label="Itens em estoque" value={`${stock.length}`} />
          <Metric
            icon={RotateCcw}
            label="Base de dados"
            value={isSupabaseConfigured ? "Supabase" : "Local"}
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Panel title="Acompanhamento de pedidos" icon={ClipboardList}>
            {orders.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="space-y-4">
                {orders.map((order) => (
                  <li
                    key={order.id}
                    className="rounded-2xl border border-border bg-white p-4 shadow-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
                          Pedido #{order.id}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-brand-900">
                          {order.buyerName} - R$ {order.total.toFixed(2)}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatOrderDate(order.createdAt)} - {order.items.length} item
                          {order.items.length > 1 ? "s" : ""}
                        </p>
                      </div>

                      <div className="block w-full sm:w-auto sm:min-w-[180px]">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Status operacional
                        </span>
                        <span
                          className={`mt-1 inline-flex h-10 w-full items-center rounded-lg px-3 text-sm font-semibold sm:w-auto ${statusClass(
                            order.status,
                          )}`}
                        >
                          {order.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-[680px] text-sm">
                        <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Produto</th>
                            <th className="px-4 py-3 font-semibold">Produtor alocado</th>
                            <th className="px-4 py-3 font-semibold">Qtd.</th>
                            <th className="px-4 py-3 text-right font-semibold">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-white">
                          {order.items.map((item) => (
                            <tr key={`${order.id}-${item.productId}`}>
                              <td className="px-4 py-3 font-medium text-brand-900">
                                {item.productName}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {item.producerName}
                                <span className="ml-2 rounded-full bg-surface-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                                  {item.manualProducerChoice ? "manual" : "auto"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-brand-900">
                                R$ {item.lineTotal.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="mt-4 rounded-xl bg-canvas px-4 py-3 text-xs text-muted-foreground">
                      O admin apenas acompanha. Confirmacao, separacao, entrega e baixa final sao
                      feitas pelo produtor no painel de pedidos recebidos.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="space-y-6">
            <Panel title="Alocação por produtor" icon={RouteIcon}>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Crie um pedido para visualizar a alocação.
                </p>
              ) : (
                <ul className="space-y-3">
                  {producerSummary(orders).map((producer) => (
                    <li
                      key={producer.name}
                      className="rounded-xl border border-border bg-canvas p-4"
                    >
                      <p className="font-semibold text-brand-900">{producer.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {producer.items} item{producer.items > 1 ? "s" : ""} - R${" "}
                        {producer.total.toFixed(2)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Produtores cadastrados" icon={Store}>
              {producersLoading ? (
                <p className="text-sm text-muted-foreground">Carregando produtores...</p>
              ) : producers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum produtor cadastrado no Supabase ainda.
                </p>
              ) : (
                <ul className="space-y-3">
                  {producers.map((producer) => (
                    <li key={producer.id} className="rounded-xl border border-border bg-canvas p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-brand-900">{producer.propertyName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {producer.responsibleName}
                            {producer.cnpj ? ` - CNPJ ${producer.cnpj}` : ""}
                          </p>
                          {producer.location && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {producer.location}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                          {producer.active ? "Ativo" : "Pausado"}
                        </span>
                      </div>
                      {producer.products.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {producer.products.slice(0, 4).map((product) => (
                            <span
                              key={product}
                              className="rounded-full bg-leaf-100 px-2.5 py-1 text-[11px] font-semibold text-brand-900"
                            >
                              {product}
                            </span>
                          ))}
                          {producer.products.length > 4 && (
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                              +{producer.products.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div id="admin-stock" className="scroll-mt-24">
              <Panel title="Estoque publicado" icon={Sprout}>
                <ul className="space-y-3">
                  {activeStock.slice(0, 6).map((item) => (
                    <li key={item.id} className="rounded-xl border border-border bg-canvas p-4">
                      <p className="text-sm font-semibold text-brand-900">{item.product}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.quantity} {item.unit} - R$ {Number(item.price || 0).toFixed(2)}/
                        {item.unit}
                      </p>
                    </li>
                  ))}
                  {activeStock.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum produto ativo publicado.</p>
                  )}
                </ul>
              </Panel>
            </div>

            <Panel title="Cotações recentes" icon={MessageSquareText}>
              <ul className="space-y-3">
                {quotes.slice(0, 5).map((quote) => (
                  <li key={quote.id} className="rounded-xl border border-border bg-canvas p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-brand-900">
                          {quote.productName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {quote.quantity} {quote.unit} - {quote.buyerName}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-brand-700">
                        {quote.status}
                      </span>
                    </div>
                  </li>
                ))}
                {quotes.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma cotação criada ainda.</p>
                )}
              </ul>
            </Panel>

            <Panel title="Dados de teste" icon={Trash2}>
              <p className="text-sm text-muted-foreground">
                Remove apenas os dados salvos neste navegador. Dados reais no Supabase devem ser
                apagados pelo painel do Supabase.
              </p>
              <button
                type="button"
                onClick={clearLocalTestData}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-error-bg)] bg-white px-4 text-sm font-semibold text-[var(--color-error-fg)] hover:bg-[var(--color-error-bg)]"
              >
                <Trash2 className="h-4 w-4" />
                Limpar dados locais
              </button>
            </Panel>
          </div>
        </section>
      </main>
    </div>
  );
}

function producerSummary(orders: ReturnType<typeof useOrders>["orders"]) {
  const map = new Map<string, { name: string; items: number; total: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = map.get(item.producerName) ?? { name: item.producerName, items: 0, total: 0 };
      current.items += 1;
      current.total += item.lineTotal;
      map.set(item.producerName, current);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-border bg-canvas p-8 text-center">
      <h3 className="text-base font-semibold text-brand-900">Nenhum pedido criado ainda</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Quando o comprador confirmar um pedido, ele aparece aqui para acompanhamento.
      </p>
    </div>
  );
}

function statusClass(status: OrderStatus) {
  if (status === "Recebido") return "bg-orange-100 text-orange-700";
  if (status === "Em separação") return "bg-[var(--color-info-bg)] text-[var(--color-info-fg)]";
  if (status === "Em entrega") return "bg-[var(--color-warning-bg)] text-brand-900";
  return "bg-[var(--color-success-bg)] text-[var(--color-success-fg)]";
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
