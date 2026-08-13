import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { useOrganizationDashboard } from "@/lib/organization-dashboard";
import { useOrganizations } from "@/lib/organizations";
import { isOrganizationDashboardPath } from "@/lib/organization-navigation";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  PackageCheck,
  Package,
  ClipboardList,
  MessageSquare,
  ShieldCheck,
  User,
  UserPlus,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/organizations")({
  component: OrganizationRoute,
});

function OrganizationRoute() {
  const { pathname } = useLocation();
  return (
    <RequireProfile roles={["gestor_organizacao"]}>
      {isOrganizationDashboardPath(pathname) ? <OrganizationsDashboard /> : <Outlet />}
    </RequireProfile>
  );
}

function OrganizationsDashboard() {
  const { organizations, loading, error } = useOrganizations();
  const organizationIds = organizations.map((organization) => organization.id);
  const dashboard = useOrganizationDashboard(organizationIds);
  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-8 pb-24 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Gestão institucional
        </p>
        <h1 className="mt-2 text-3xl font-bold text-brand-900">Cooperativas e associações</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gerencie as organizações vinculadas à sua conta e acompanhe a verificação cadastral.
        </p>
        {!loading && organizations.length > 0 && (
          <OperationalSummary
            dashboard={dashboard}
            hasUnverifiedOrganization={organizations.some(
              (organization) => organization.verificationStatus !== "verified",
            )}
          />
        )}
        <section className="mt-6 rounded-2xl border border-leaf-200 bg-leaf-50 p-5">
          <h2 className="text-lg font-bold text-brand-900">Primeiros passos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use este roteiro para deixar a organização pronta para receber associados e negociar.
          </p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <GuideStep done={organizations.length > 0} text="Cadastro institucional criado" />
            <GuideStep
              done={dashboard.metrics.activeMembers > 0}
              to="/organizations/members"
              text="Convidar ou aprovar associados"
            />
            <GuideStep
              done={dashboard.metrics.activeProducts > 0}
              to="/organizations/products"
              text="Acompanhar produtos publicados"
            />
            <GuideStep to="/organizations/negotiations" text="Acompanhar negociações" />
            <GuideStep to="/organizations/messages" text="Acompanhar mensagens" />
            <GuideStep to="/profile/organization" text="Revisar perfil e notificações" />
          </ol>
        </section>
        {loading ? (
          <p className="mt-8 rounded-2xl border border-border bg-white p-6">
            Carregando organizações...
          </p>
        ) : error ? (
          <p className="mt-8 rounded-2xl bg-[var(--color-error-bg)] p-4 text-[var(--color-error-fg)]">
            {error}
          </p>
        ) : organizations.length === 0 ? (
          <Empty />
        ) : (
          <section className="mt-8 grid gap-5 lg:grid-cols-2">
            {organizations.map((organization) => (
              <article
                key={organization.id}
                className="rounded-2xl border border-border bg-white p-5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-leaf-100 text-brand-700">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <VerificationStatus status={organization.verificationStatus} />
                </div>
                <h2 className="mt-4 text-xl font-bold text-brand-900">{organization.tradeName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{organization.legalName}</p>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <Info
                    label="Tipo"
                    value={organization.type === "cooperativa" ? "Cooperativa" : "Associação"}
                  />
                  <Info label="CNPJ" value={formatCnpj(organization.cnpj)} />
                  <Info
                    label="Responsável"
                    value={`${organization.responsibleName} · ${organization.responsibleRole}`}
                  />
                  <Info label="Localização" value={`${organization.city}, ${organization.state}`} />
                </dl>
                {organization.verificationStatus === "unverified" && (
                  <p className="mt-5 rounded-xl bg-orange-50 p-3 text-xs text-orange-800">
                    O cadastro está ativo, mas os dados do CNPJ ainda não foram verificados. A
                    organização pode gerenciar associados e negociações, porém permanece sem selo de
                    verificação.
                  </p>
                )}
                {organization.rejectionReason && (
                  <p className="mt-5 rounded-xl bg-[var(--color-error-bg)] p-3 text-xs text-[var(--color-error-fg)]">
                    Motivo: {organization.rejectionReason}
                  </p>
                )}
                <div className="mt-6 grid gap-2 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-5">
                  <QuickLink to="/organizations/members" icon={Users} label="Associados" />
                  <QuickLink to="/organizations/products" icon={Package} label="Produtos" />
                  <QuickLink
                    to="/organizations/negotiations"
                    icon={ClipboardList}
                    label="Negociações"
                  />
                  <QuickLink to="/organizations/messages" icon={MessageSquare} label="Mensagens" />
                  <QuickLink to="/profile/organization" icon={User} label="Perfil" />
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
type DashboardState = ReturnType<typeof useOrganizationDashboard>;

function OperationalSummary({
  dashboard,
  hasUnverifiedOrganization,
}: {
  dashboard: DashboardState;
  hasUnverifiedOrganization: boolean;
}) {
  const { metrics, pendingMemberships, loading, error } = dashboard;
  if (loading) {
    return (
      <section
        className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Resumo operacional"
      >
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-2xl border border-border bg-white"
          />
        ))}
      </section>
    );
  }
  return (
    <>
      <section className="mt-8" aria-labelledby="operational-summary-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="operational-summary-title" className="text-xl font-bold text-brand-900">
              Resumo operacional
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe vínculos, autorizações e publicações da organização.
            </p>
          </div>
          <Link
            to="/organizations/members"
            className="text-sm font-semibold text-leaf-700 hover:underline"
          >
            Gerenciar associados
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={Users} label="Associados ativos" value={metrics.activeMembers} />
          <MetricCard
            icon={UserPlus}
            label="Solicitações pendentes"
            value={metrics.pendingRequests}
            attention={metrics.pendingRequests > 0}
          />
          <MetricCard
            icon={BadgeCheck}
            label="Autorizados a publicar"
            value={metrics.authorizedMembers}
          />
          <MetricCard
            icon={PackageCheck}
            label="Produtos publicados"
            value={metrics.activeProducts}
          />
        </div>
        {error && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
            Não foi possível atualizar todo o resumo. Tente recarregar a página.
          </p>
        )}
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Ações prioritárias">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-xs">
          <h2 className="font-bold text-brand-900">Ações prioritárias</h2>
          <ul className="mt-4 space-y-3">
            {metrics.pendingRequests > 0 && (
              <ActionAlert
                title={`${metrics.pendingRequests} solicitação${metrics.pendingRequests > 1 ? "ões" : ""} aguardando análise`}
                text="Confira os dados dos produtores antes de aprovar o vínculo."
                to="/organizations/members"
              />
            )}
            {hasUnverifiedOrganization && (
              <ActionAlert
                title="Cadastro institucional ainda não verificado"
                text="Confira no perfil se os dados da organização estão completos."
                to="/profile/organization"
              />
            )}
            {metrics.activeMembers > 0 && metrics.authorizedMembers === 0 && (
              <ActionAlert
                title="Nenhum associado autorizado a publicar"
                text="Escolha quais associados podem usar os dados comerciais da organização."
                to="/organizations/members"
              />
            )}
            {metrics.pendingRequests === 0 &&
              !hasUnverifiedOrganization &&
              !(metrics.activeMembers > 0 && metrics.authorizedMembers === 0) && (
                <li className="flex items-start gap-3 rounded-xl bg-leaf-50 p-3 text-sm text-brand-900">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
                  Não há ações urgentes neste momento.
                </li>
              )}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5 shadow-xs">
          <h2 className="font-bold text-brand-900">Solicitações recentes</h2>
          {pendingMemberships.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {pendingMemberships.slice(0, 3).map((membership) => (
                <li key={membership.id} className="rounded-xl bg-canvas p-3">
                  <p className="font-semibold text-brand-900">{membership.producerName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {membership.propertyName} · {membership.organizationName}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {pendingMemberships.length > 0 && (
            <Link
              to="/organizations/members"
              className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-leaf-700 hover:underline"
            >
              Analisar solicitações
            </Link>
          )}
        </div>
      </section>
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  attention = false,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  attention?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border bg-white p-5 shadow-xs ${attention ? "border-orange-300" : "border-border"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`grid h-10 w-10 place-items-center rounded-xl ${attention ? "bg-orange-100 text-orange-800" : "bg-leaf-100 text-leaf-700"}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        {attention && (
          <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">
            Atenção
          </span>
        )}
      </div>
      <p className="mt-4 text-3xl font-bold text-brand-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
    </article>
  );
}

function ActionAlert({ title, text, to }: { title: string; text: string; to: string }) {
  return (
    <li className="rounded-xl border border-orange-200 bg-orange-50 p-3">
      <p className="text-sm font-semibold text-brand-900">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
      <Link
        to={to}
        className="mt-2 inline-flex min-h-9 items-center text-sm font-semibold text-leaf-700 hover:underline"
      >
        Resolver agora
      </Link>
    </li>
  );
}
function GuideStep({ text, done, to }: { text: string; done?: boolean; to?: string }) {
  const content = (
    <span className="flex min-h-12 items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-brand-900">
      {done ? (
        <CheckCircle2 className="h-5 w-5 text-green-700" />
      ) : (
        <span className="grid h-6 w-6 place-items-center rounded-full bg-leaf-100 text-xs">•</span>
      )}
      {text}
    </span>
  );
  return <li>{to ? <Link to={to}>{content}</Link> : content}</li>;
}
function QuickLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Users }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-brand-900 hover:bg-secondary"
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
function Empty() {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-white p-8 text-center">
      <Users className="mx-auto h-8 w-8 text-leaf-700" />
      <h2 className="mt-3 font-semibold text-brand-900">Nenhuma organização vinculada</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cadastros administrados por esta conta aparecerão aqui.
      </p>
    </div>
  );
}
function VerificationStatus({ status }: { status: "unverified" | "verified" | "failed" }) {
  const labels = {
    unverified: "Não verificada",
    verified: "CNPJ verificado",
    failed: "Verificação divergente",
  };
  const Icon = status === "verified" ? ShieldCheck : Clock3;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-brand-900">
      <Icon className="h-3.5 w-3.5" />
      {labels[status]}
    </span>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-brand-900">{value}</dd>
    </div>
  );
}
function formatCnpj(value: string) {
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
