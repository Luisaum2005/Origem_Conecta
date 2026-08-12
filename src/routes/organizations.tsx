import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { useOrganizations } from "@/lib/organizations";
import { Building2, CheckCircle2, Clock3, MessageSquare, ShieldCheck, Users } from "lucide-react";

export const Route = createFileRoute("/organizations")({
  component: () => (
    <RequireProfile roles={["gestor_organizacao"]}>
      <Organizations />
    </RequireProfile>
  ),
});

function Organizations() {
  const { organizations, loading, error } = useOrganizations();
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
        <section className="mt-6 rounded-2xl border border-leaf-200 bg-leaf-50 p-5">
          <h2 className="text-lg font-bold text-brand-900">Primeiros passos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use este roteiro para deixar a organização pronta para receber associados e negociar.
          </p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            <GuideStep done={organizations.length > 0} text="Cadastro institucional criado" />
            <GuideStep to="/organizations/members" text="Convidar ou aprovar associados" />
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
                <div className="mt-6 grid gap-2 border-t border-border pt-5 sm:grid-cols-3">
                  <QuickLink to="/organizations/members" icon={Users} label="Associados" />
                  <QuickLink
                    to="/organizations/negotiations"
                    icon={CheckCircle2}
                    label="Negociações"
                  />
                  <QuickLink to="/organizations/messages" icon={MessageSquare} label="Mensagens" />
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
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
