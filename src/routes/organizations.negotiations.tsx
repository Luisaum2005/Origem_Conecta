import { createFileRoute } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import {
  getNegotiationProducers,
  useOrganizationNegotiations,
  type OrganizationNegotiation,
  type OrganizationNegotiationItem,
  type OrganizationNegotiationStatus,
} from "@/lib/organization-negotiations";
import { CheckCircle2, ClipboardList, Search, Truck, Users } from "lucide-react";
import { useMemo, useState } from "react";

type StatusFilter = "all" | "new" | "progress" | "completed" | "cancelled";

export const Route = createFileRoute("/organizations/negotiations")({
  component: () => (
    <RequireProfile roles={["gestor_organizacao"]}>
      <OrganizationNegotiationsPage />
    </RequireProfile>
  ),
});

function OrganizationNegotiationsPage() {
  const { negotiations, loading, error, refresh } = useOrganizationNegotiations();
  const [search, setSearch] = useState("");
  const [organizationId, setOrganizationId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const organizations = useMemo(
    () =>
      Array.from(
        new Map(
          negotiations.map((negotiation) => [
            negotiation.organizationId,
            negotiation.organizationName,
          ]),
        ),
      ),
    [negotiations],
  );
  const visibleNegotiations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return negotiations.filter((negotiation) => {
      if (organizationId !== "all" && negotiation.organizationId !== organizationId) return false;
      if (status !== "all" && statusGroup(negotiation.status) !== status) return false;
      if (!query) return true;
      return [
        negotiation.buyerName,
        negotiation.organizationName,
        negotiation.orderId,
        ...negotiation.items.flatMap((item) => [item.productName, item.producerName]),
      ].some((value) => value.toLocaleLowerCase("pt-BR").includes(query));
    });
  }, [negotiations, organizationId, search, status]);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-8 pb-24 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Gestão institucional
        </p>
        <h1 className="mt-2 text-3xl font-bold text-brand-900">Negociações da organização</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Acompanhe solicitações relacionadas aos produtos publicados com os dados da organização. O
          produtor responsável continua conduzindo a negociação e atualizando a entrega.
        </p>

        <section
          className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Resumo das negociações"
        >
          <Summary icon={ClipboardList} label="Novas" value={countByGroup(negotiations, "new")} />
          <Summary
            icon={Truck}
            label="Em andamento"
            value={countByGroup(negotiations, "progress")}
          />
          <Summary
            icon={CheckCircle2}
            label="Concluídas"
            value={countByGroup(negotiations, "completed")}
          />
          <Summary
            icon={Users}
            label="Produtores envolvidos"
            value={uniqueProducerCount(negotiations)}
          />
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-white p-4 shadow-xs">
          <h2 className="font-bold text-brand-900">Filtrar negociações</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              <label htmlFor="organization-negotiation-search" className="sr-only">
                Buscar negociações
              </label>
              <input
                id="organization-negotiation-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar comprador, produtor ou produto"
                className="h-12 w-full rounded-xl border border-border pl-10 pr-3 text-base"
              />
            </div>
            <label htmlFor="negotiation-organization" className="sr-only">
              Organização
            </label>
            <select
              id="negotiation-organization"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="h-12 rounded-xl border border-border bg-white px-3 text-base text-brand-900"
            >
              <option value="all">Todas as organizações</option>
              {organizations.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <label htmlFor="negotiation-status" className="sr-only">
              Situação
            </label>
            <select
              id="negotiation-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="h-12 rounded-xl border border-border bg-white px-3 text-base text-brand-900"
            >
              <option value="all">Todas as situações</option>
              <option value="new">Novas</option>
              <option value="progress">Em andamento</option>
              <option value="completed">Concluídas</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-800" role="alert">
            <p>Não foi possível carregar as negociações da organização.</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-2 min-h-10 font-semibold underline"
            >
              Tentar novamente
            </button>
          </div>
        )}
        {loading ? (
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : visibleNegotiations.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-white p-10 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-leaf-700" />
            <h2 className="mt-3 text-lg font-bold text-brand-900">Nenhuma negociação encontrada</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {negotiations.length === 0
                ? "As negociações aparecerão quando compradores solicitarem produtos publicados pela organização."
                : "Tente remover algum filtro ou buscar por outro termo."}
            </p>
          </div>
        ) : (
          <section className="mt-6 space-y-4" aria-label="Negociações encontradas">
            {visibleNegotiations.map((negotiation) => (
              <NegotiationCard
                key={`${negotiation.orderId}-${negotiation.organizationId}`}
                negotiation={negotiation}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function NegotiationCard({ negotiation }: { negotiation: OrganizationNegotiation }) {
  const producers = getNegotiationProducers(negotiation);
  return (
    <article className="rounded-2xl border border-border bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-leaf-700">
            {negotiation.organizationName}
          </p>
          <h2 className="mt-1 text-xl font-bold text-brand-900">{negotiation.buyerName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Solicitação #{negotiation.orderId.slice(0, 8).toUpperCase()} ·{" "}
            {formatDate(negotiation.createdAt)}
          </p>
        </div>
        <StatusBadge status={negotiation.status} />
      </div>

      <div className="mt-5 rounded-xl bg-canvas p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Produtor{producers.length > 1 ? "es" : ""} responsável{producers.length > 1 ? "eis" : ""}
        </p>
        <p className="mt-1 font-semibold text-brand-900">{producers.join(", ")}</p>
      </div>

      <div className="mt-5">
        <h3 className="font-bold text-brand-900">Produtos desta organização</h3>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {negotiation.items.map((item, index) => (
            <NegotiationItemRow
              key={`${item.productName}-${item.producerName}-${index}`}
              item={item}
            />
          ))}
        </ul>
      </div>
      {negotiation.deliveryLabel && (
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="font-semibold text-brand-900">Previsão informada:</span>{" "}
          {negotiation.deliveryLabel}
        </p>
      )}
      <p className="mt-4 rounded-xl bg-leaf-50 p-3 text-xs leading-relaxed text-brand-900">
        Para corrigir estoque, confirmar ou atualizar esta solicitação, o produtor responsável deve
        acessar o próprio painel.
      </p>
    </article>
  );
}

function NegotiationItemRow({ item }: { item: OrganizationNegotiationItem }) {
  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-brand-900">{item.productName}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Responsável: {item.producerName}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-brand-900">
          {item.quantity.toLocaleString("pt-BR")} {item.unit}
        </span>
        <span className="rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-brand-900">
          {itemProgress(item)}
        </span>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: OrganizationNegotiationStatus }) {
  const group = statusGroup(status);
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        group === "completed"
          ? "bg-green-100 text-green-800"
          : group === "cancelled"
            ? "bg-red-100 text-red-800"
            : group === "progress"
              ? "bg-blue-100 text-blue-800"
              : "bg-orange-100 text-orange-800"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-2xl border border-border bg-white p-5 shadow-xs">
      <Icon className="h-6 w-6 text-leaf-700" />
      <p className="mt-3 text-3xl font-bold text-brand-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
    </article>
  );
}

function statusGroup(status: OrganizationNegotiationStatus): Exclude<StatusFilter, "all"> {
  if (status === "recebido") return "new";
  if (status === "em_separacao" || status === "em_entrega") return "progress";
  if (status === "entregue") return "completed";
  return "cancelled";
}

function statusLabel(status: OrganizationNegotiationStatus) {
  return {
    recebido: "Nova",
    em_separacao: "Em preparação",
    em_entrega: "Em entrega",
    entregue: "Concluída",
    cancelado: "Cancelada",
  }[status];
}

function itemProgress(item: OrganizationNegotiationItem) {
  if (item.deliveredAt) return "Entregue";
  if (item.shippedAt) return "Em entrega";
  if (item.confirmedAt) return "Confirmado";
  return "Aguardando produtor";
}

function countByGroup(
  negotiations: OrganizationNegotiation[],
  group: Exclude<StatusFilter, "all">,
) {
  return negotiations.filter((negotiation) => statusGroup(negotiation.status) === group).length;
}

function uniqueProducerCount(negotiations: OrganizationNegotiation[]) {
  return new Set(negotiations.flatMap(getNegotiationProducers)).size;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
