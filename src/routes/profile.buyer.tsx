import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { type BuyerProfileDetails, useBuyerProfileDetails } from "@/lib/buyer-profile";
import { formatOrderDate, type SavedOrder, useOrders } from "@/lib/orders";
import {
  Building2,
  CalendarClock,
  History,
  MapPin,
  Pencil,
  Phone,
  Repeat,
  Save,
  ShieldCheck,
  ShoppingBasket,
  TrendingDown,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/profile/buyer")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <BuyerProfile />
    </RequireProfile>
  ),
});

function BuyerProfile() {
  const { details, saveDetails, saving } = useBuyerProfileDetails();
  const { orders } = useOrders();
  const location = [details.city, details.state].filter(Boolean).join(", ");
  const activeOrders = orders.filter((order) => order.status !== "Cancelado");
  const deliveredOrders = activeOrders.filter((order) => order.status === "Entregue");
  const openOrders = activeOrders.filter((order) => order.status !== "Entregue");
  const recentTotal = activeOrders.reduce((sum, order) => sum + order.total, 0);
  const onTimeRate = activeOrders.length
    ? Math.round((deliveredOrders.length / activeOrders.length) * 100)
    : 0;
  const nextDelivery = openOrders[0]?.deliveryEta || "Sem pedidos abertos";
  const productSummary = useMemo(() => summarizeProducts(orders), [orders]);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-6 pb-24 sm:px-8 sm:py-10 md:pb-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Painel do comprador
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              {details.companyName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {details.businessType || "Comprador"} verificado -{" "}
              {location || "localização pendente"}
            </p>
          </div>
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-leaf-500 hover:text-brand-900"
          >
            <ShoppingBasket className="h-3.5 w-3.5 text-leaf-600" />
            Novo pedido
          </Link>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric icon={ShieldCheck} label="Pedidos entregues" value={`${onTimeRate}%`} />
          <Metric
            icon={ShoppingBasket}
            label="Compras registradas"
            value={`R$ ${recentTotal.toFixed(2)}`}
          />
          <Metric icon={CalendarClock} label="Próxima entrega" value={nextDelivery} />
        </section>

        <section className="mt-6">
          <BuyerDetailsPanel details={details} onSave={saveDetails} saving={saving} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Histórico de compras" icon={History}>
            {orders.length ? (
              <ul className="divide-y divide-border">
                {orders.map((order) => (
                  <li key={order.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-brand-900">Pedido #{order.id}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatOrderDate(order.createdAt)} -{" "}
                          {producerNames(order) || "Produtor a definir"}
                        </p>
                      </div>
                      <span className="rounded-full bg-surface-brand-soft px-3 py-1 text-xs font-medium text-brand-700">
                        {order.status}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <Mini label="Total" value={`R$ ${order.total.toFixed(2)}`} />
                      <Mini label="Entrega" value={order.deliveryEta || "A combinar"} />
                    </dl>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-canvas p-4 text-sm text-muted-foreground">
                Nenhum pedido registrado ainda.
              </p>
            )}
          </Panel>

          <Panel title="Pedido recorrente" icon={Repeat}>
            <div className="rounded-xl border border-[var(--border-strong)] bg-surface-brand-soft p-4">
              <p className="text-sm font-semibold text-brand-900">Pedidos recorrentes</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Acompanhe modelos salvos e pedidos frequentes na área de pedidos.
              </p>
              <Link
                to="/orders"
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-900 px-4 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Ver recorrentes
              </Link>
            </div>
          </Panel>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Produtos mais comprados" icon={TrendingDown}>
            {productSummary.length ? (
              <ul className="space-y-3">
                {productSummary.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3"
                  >
                    <span className="font-medium text-brand-900">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.quantity.toLocaleString("pt-BR")} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-canvas p-4 text-sm text-muted-foreground">
                Os produtos mais comprados aparecem depois do primeiro pedido.
              </p>
            )}
          </Panel>

          <Panel title="Contato principal" icon={Phone}>
            <p className="text-sm text-muted-foreground">
              Confirmacoes de pedido e entrega serao enviadas para{" "}
              {details.phone || "o telefone cadastrado"}.
            </p>
          </Panel>
        </section>
      </main>
    </div>
  );
}

function BuyerDetailsPanel({
  details,
  onSave,
  saving,
}: {
  details: BuyerProfileDetails;
  onSave: (details: BuyerProfileDetails) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(details);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(details);
  }, [details]);

  const save = async () => {
    setError("");
    try {
      await onSave(draft);
      setEditing(false);
      setNotice("Dados da empresa atualizados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar os dados.");
    }
  };

  return (
    <Panel title="Dados do estabelecimento" icon={Building2}>
      {!editing ? (
        <div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Mini label="Nome fantasia" value={details.companyName || "Não informado"} />
            <Mini label="Tipo" value={details.businessType || "Não informado"} />
            <Mini label="CNPJ" value={details.cnpj || "Não informado"} />
            <Mini label="Responsável" value={details.responsibleName || "Não informado"} />
            <Mini label="Telefone" value={details.phone || "Não informado"} />
            <Mini label="Cidade" value={details.city || "Não informado"} />
            <Mini label="Estado" value={details.state || "Não informado"} />
          </dl>
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
              icon={Building2}
              label="Nome fantasia"
              value={draft.companyName}
              onChange={(companyName) => setDraft({ ...draft, companyName })}
            />
            <TextField
              icon={ShoppingBasket}
              label="Tipo de empresa"
              value={draft.businessType}
              onChange={(businessType) => setDraft({ ...draft, businessType })}
            />
            <TextField
              icon={Building2}
              label="CNPJ"
              value={draft.cnpj}
              onChange={(cnpj) => setDraft({ ...draft, cnpj })}
              placeholder="Digite o CNPJ"
            />
            <TextField
              icon={User}
              label="Responsável"
              value={draft.responsibleName}
              onChange={(responsibleName) => setDraft({ ...draft, responsibleName })}
            />
            <TextField
              icon={Phone}
              label="Telefone/WhatsApp"
              value={draft.phone}
              onChange={(phone) => setDraft({ ...draft, phone })}
            />
            <TextField
              icon={MapPin}
              label="Cidade"
              value={draft.city}
              onChange={(city) => setDraft({ ...draft, city })}
            />
            <TextField
              icon={MapPin}
              label="Estado"
              value={draft.state}
              onChange={(state) => setDraft({ ...draft, state })}
              placeholder="SP"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
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

function summarizeProducts(orders: SavedOrder[]) {
  const totals = new Map<string, { name: string; quantity: number; unit: string }>();

  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.productName}-${item.unit}`;
      const current = totals.get(key) ?? {
        name: item.productName,
        quantity: 0,
        unit: item.unit,
      };
      current.quantity += Number(item.quantity || 0);
      totals.set(key, current);
    }
  }

  return Array.from(totals.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 4);
}

function producerNames(order: SavedOrder) {
  return Array.from(new Set(order.items.map((item) => item.producerName).filter(Boolean))).join(
    ", ",
  );
}

function TextField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-900">{label}</span>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-white px-3 focus-within:border-leaf-600 focus-within:ring-2 focus-within:ring-leaf-100">
        <Icon className="h-4 w-4 text-leaf-700" />
        <input
          type={type}
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
