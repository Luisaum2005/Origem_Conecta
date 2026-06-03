import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/auth";
import { formatOrderDate, type SavedOrder, useOrders } from "@/lib/orders";
import { type ProducerProfileDetails, useProducerProfileDetails } from "@/lib/producer-profile";
import { useProducerStock } from "@/lib/producer-stock";
import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  MapPin,
  Package,
  PackageCheck,
  Pencil,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  Sprout,
  Store,
  TrendingUp,
  Truck,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/profile/producer")({
  component: () => (
    <RequireProfile allowed={["produtor"]}>
      <ProducerProfile />
    </RequireProfile>
  ),
});

const PRODUCER_ID = "ramy-pitayas";
const PRODUCER_NAME = "Ramy Pitayas";

function ProducerProfile() {
  const { profile, isSupabaseConfigured } = useAuth();
  const { details, saveDetails, saving } = useProducerProfileDetails();
  const [stock] = useProducerStock();
  const { orders } = useOrders();
  const producerName =
    details.propertyName || (profile?.tipo === "produtor" ? profile.nome : PRODUCER_NAME);

  const activeStock = stock.filter((item) => item.status === "ativo");
  const pausedStock = stock.filter((item) => item.status === "pausado");
  const producerOrders = getProducerOrders(
    orders,
    Boolean(isSupabaseConfigured && profile?.tipo === "produtor"),
  );
  const openOrders = producerOrders.filter((order) => order.status !== "Entregue");
  const deliveredOrders = producerOrders.filter((order) => order.status === "Entregue");
  const stockPotential = activeStock.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
    0,
  );
  const orderRevenue = producerOrders.reduce((sum, order) => sum + producerOrderTotal(order), 0);
  const deliveryRate = producerOrders.length
    ? Math.round((deliveredOrders.length / producerOrders.length) * 100)
    : 0;
  const topProducts = productSummary(producerOrders);
  const activity = buildActivity(producerOrders, stock);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-6 pb-24 sm:px-8 sm:py-10 md:pb-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Painel do produtor
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              {producerName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Produtor verificado - {details.location || "localização pendente"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/producer/orders"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-leaf-500 hover:text-brand-900"
            >
              <Store className="h-3.5 w-3.5 text-leaf-600" />
              Ver pedidos recebidos
            </Link>
            <Link
              to="/production"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-leaf-500 hover:text-brand-900"
            >
              <Sprout className="h-3.5 w-3.5 text-leaf-600" />
              Gerenciar estoque
            </Link>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Package} label="Produtos ativos" value={`${activeStock.length}`} />
          <Metric icon={Truck} label="Pedidos em andamento" value={`${openOrders.length}`} />
          <Metric
            icon={CircleDollarSign}
            label="Receita em pedidos"
            value={`R$ ${orderRevenue.toFixed(2)}`}
          />
          <Metric
            icon={ShieldCheck}
            label="Pedidos entregues"
            value={producerOrders.length ? `${deliveryRate}%` : "Sem dados"}
          />
        </section>

        <section className="mt-6">
          <ProducerDetailsPanel details={details} onSave={saveDetails} saving={saving} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Estoque publicado" icon={Package}>
            {stock.length === 0 ? (
              <EmptyMessage text="Nenhum produto cadastrado no estoque." />
            ) : (
              <ul className="divide-y divide-border">
                {stock.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-brand-900">{item.product}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            item.status === "ativo"
                              ? "bg-[var(--color-success-bg)] text-[var(--color-success-fg)]"
                              : "bg-surface-muted text-muted-foreground"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.notes || "Sem observações adicionais"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-brand-900">
                        {item.quantity || "0"} {item.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        R$ {Number(item.price || 0).toFixed(2)}/{item.unit}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/production"
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-leaf-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-leaf-700 active:scale-[0.99] sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar disponibilidade
            </Link>
          </Panel>

          <Panel title="Produtos mais vendidos" icon={TrendingUp}>
            {topProducts.length === 0 ? (
              <EmptyMessage text="Os produtos mais vendidos aparecem depois do primeiro pedido." />
            ) : (
              <ul className="space-y-3">
                {topProducts.map((product) => (
                  <li key={product.name} className="rounded-xl border border-border bg-canvas p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-brand-900">{product.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {product.quantity} {product.unit} vendidos
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
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <Panel title="Resumo operacional" icon={PackageCheck}>
            <dl className="grid gap-4">
              <Mini label="Potencial do estoque ativo" value={`R$ ${stockPotential.toFixed(2)}`} />
              <Mini label="Pedidos recebidos" value={`${producerOrders.length}`} />
              <Mini label="Produtos pausados" value={`${pausedStock.length}`} />
              <Mini label="Próxima entrega" value={nextDeliveryLabel(openOrders)} />
            </dl>
          </Panel>

          <Panel title="Alertas de operação" icon={AlertTriangle}>
            <div className="space-y-3">
              {openOrders.length > 0 && (
                <Alert
                  title="Pedidos aguardando ação"
                  text={`${openOrders.length} pedido(s) ainda em andamento.`}
                />
              )}
              {pausedStock.length > 0 && (
                <Alert
                  title="Produtos pausados"
                  text={`${pausedStock.length} produto(s) fora do portfólio.`}
                />
              )}
              {activeStock.length === 0 && (
                <Alert
                  title="Sem estoque ativo"
                  text="Publique ao menos um produto para aparecer ao comprador."
                />
              )}
              {openOrders.length === 0 && pausedStock.length === 0 && activeStock.length > 0 && (
                <Alert
                  title="Operação em dia"
                  text="Estoque ativo e nenhum pedido pendente no momento."
                />
              )}
            </div>
          </Panel>

          <Panel title="Histórico operacional" icon={CalendarClock}>
            {activity.length === 0 ? (
              <EmptyMessage text="As movimentacoes aparecem quando houver estoque ou pedidos." />
            ) : (
              <ul className="space-y-3">
                {activity.map((event) => (
                  <li
                    key={event}
                    className="rounded-xl bg-canvas px-4 py-3 text-sm font-medium text-brand-900"
                  >
                    {event}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      </main>
    </div>
  );
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

function nextDeliveryLabel(orders: SavedOrder[]) {
  if (!orders.length) return "Sem pedidos abertos";
  return orders[0].deliveryEta;
}

function buildActivity(orders: SavedOrder[], stock: { product: string; status: string }[]) {
  const orderEvents = orders.slice(0, 3).map((order) => {
    return `Pedido #${order.id} - ${order.status} - ${formatOrderDate(order.createdAt)}`;
  });
  const stockEvents = stock.slice(0, 2).map((item) => {
    return `${item.product} ${item.status === "ativo" ? "publicado" : "pausado"} no estoque`;
  });
  return [...orderEvents, ...stockEvents].slice(0, 5);
}

function ProducerDetailsPanel({
  details,
  onSave,
  saving,
}: {
  details: ProducerProfileDetails;
  onSave: (details: ProducerProfileDetails) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(details);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const productsText = draft.products.join(", ");

  useEffect(() => {
    setDraft(details);
  }, [details]);

  const save = async () => {
    setError("");
    try {
      await onSave({
        ...draft,
        products: productsText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setEditing(false);
      setNotice("Dados do produtor atualizados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar os dados.");
    }
  };

  return (
    <Panel title="Dados da propriedade" icon={Store}>
      {!editing ? (
        <div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Mini label="Propriedade" value={details.propertyName || "Não informado"} />
            <Mini label="Responsável" value={details.responsibleName || "Não informado"} />
            <Mini label="CNPJ" value={details.cnpj || "Não informado"} />
            <Mini label="Telefone" value={details.phone || "Não informado"} />
            <Mini label="Localização" value={details.location || "Não informado"} />
          </dl>
          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Produtos atendidos
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {details.products.length ? (
                details.products.map((product) => (
                  <span
                    key={product}
                    className="rounded-full bg-leaf-100 px-3 py-1 text-xs font-semibold text-brand-900"
                  >
                    {product}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Nenhum produto informado.</span>
              )}
            </div>
          </div>
          {notice && (
            <p className="mt-4 text-sm font-semibold text-[var(--color-success-fg)]">{notice}</p>
          )}
          <button
            type="button"
            onClick={() => {
              setNotice("");
              setError("");
              setEditing(true);
            }}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
          >
            <Pencil className="h-4 w-4 text-leaf-700" />
            Editar dados
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              icon={Store}
              label="Nome da propriedade"
              value={draft.propertyName}
              onChange={(propertyName) => setDraft({ ...draft, propertyName })}
            />
            <TextField
              icon={User}
              label="Responsável"
              value={draft.responsibleName}
              onChange={(responsibleName) => setDraft({ ...draft, responsibleName })}
            />
            <TextField
              icon={Store}
              label="CNPJ"
              value={draft.cnpj}
              onChange={(cnpj) => setDraft({ ...draft, cnpj })}
              placeholder="00.000.000/0000-00"
            />
            <TextField
              icon={Phone}
              label="Telefone/WhatsApp"
              value={draft.phone}
              onChange={(phone) => setDraft({ ...draft, phone })}
            />
            <TextField
              icon={MapPin}
              label="Localização"
              value={draft.location}
              onChange={(location) => setDraft({ ...draft, location })}
              placeholder="Cidade, UF"
            />
          </div>
          <label className="block">
            <span className="block text-sm font-medium text-brand-900">Produtos atendidos</span>
            <textarea
              value={productsText}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  products: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Pitaya Roxa, Figo, Cafe especial..."
              className="mt-2 min-h-[92px] w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-100"
            />
            <span className="mt-1.5 block text-xs text-muted-foreground">
              Separe os produtos por vírgula.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {error && (
              <p className="w-full rounded-xl bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-leaf-600 px-4 text-sm font-semibold text-white hover:bg-leaf-700 disabled:bg-[var(--color-surface-disabled)] disabled:text-[var(--text-disabled)]"
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar dados"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(details);
                setError("");
                setEditing(false);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-brand-900 hover:border-leaf-500"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function TextField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-900">{label}</span>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-white px-3 focus-within:border-leaf-600 focus-within:ring-2 focus-within:ring-leaf-100">
        <Icon className="h-4 w-4 text-leaf-700" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full bg-transparent text-sm text-brand-900 focus:outline-none"
        />
      </div>
    </label>
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-brand-900">{value}</dd>
    </div>
  );
}

function Alert({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-canvas p-4">
      <p className="text-sm font-semibold text-brand-900">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return <p className="rounded-xl bg-canvas p-4 text-sm text-muted-foreground">{text}</p>;
}
