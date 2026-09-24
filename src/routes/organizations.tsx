import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Circle, CircleCheck, Users } from "@/components/mobile/icons";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { NotificationBell } from "@/components/mobile/NotificationBell";
import { initials } from "@/lib/format";
import { useOrganizationDashboard } from "@/lib/organization-dashboard";
import { isOrganizationDashboardPath } from "@/lib/organization-navigation";
import { useOrganizationNegotiations } from "@/lib/organization-negotiations";
import { useOrganizations } from "@/lib/organizations";

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
  const organization = organizations[0];
  const dashboard = useOrganizationDashboard(organizations.map((item) => item.id));
  const { negotiations } = useOrganizationNegotiations();
  const { metrics, pendingMemberships } = dashboard;
  const open = negotiations.filter(
    (item) => item.status !== "entregue" && item.status !== "cancelado",
  );

  const steps = [
    { text: "Cadastro institucional", done: organizations.length > 0, to: "/profile/organization" },
    { text: "Convidar associados", done: metrics.activeMembers > 0, to: "/organizations/members" },
    { text: "Publicar produtos", done: metrics.activeProducts > 0, to: "/organizations/products" },
    {
      text: "Primeira negociação",
      done: negotiations.length > 0,
      to: "/organizations/negotiations",
    },
    {
      text: "Autorizar quem vende",
      done: metrics.authorizedMembers > 0,
      to: "/organizations/members",
    },
    {
      text: "CNPJ verificado",
      done: organization?.verificationStatus === "verified",
      to: "/profile/organization",
    },
  ];
  const done = steps.filter((step) => step.done).length;

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-c1-painel">
        <div className="m-status" />
        <div className="m-hd">
          <Link to="/profile/organization" className="m-avatar" aria-label="Perfil da organização">
            {initials(organization?.tradeName) || "?"}
          </Link>
          <div className="m-who">
            <b>{organization?.tradeName ?? (loading ? "Carregando..." : "Sua organização")}</b>
            <span>
              {organization
                ? `${organization.city} · ${metrics.activeMembers} associados`
                : "Cadastre a organização para começar"}
            </span>
          </div>
          <NotificationBell />
        </div>

        {error && (
          <div className="m-pad">
            <div className="m-card m-alert" role="alert">
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="m-kpi" style={{ gridTemplateColumns: "1fr 1.25fr 1fr" }}>
          <div className="m-card">
            <span>Associados</span>
            <b>{metrics.activeMembers}</b>
          </div>
          <div className="m-card">
            <span>Produtos ativos</span>
            <b>{metrics.activeProducts}</b>
          </div>
          <div className="m-card">
            <span>Negociações</span>
            <b>{open.length}</b>
          </div>
        </div>

        <div className="m-steps m-card">
          <div className="m-t">
            <b>Primeiros passos</b>
            <span>
              {done} de {steps.length}
            </span>
          </div>
          <div className="m-bar">
            <i style={{ width: `${(done / steps.length) * 100}%` }} />
          </div>
          <ul>
            {steps.map((step) => (
              <li key={step.text} className={step.done ? "m-ok" : undefined}>
                <Link to={step.to}>
                  {step.done ? (
                    <CircleCheck className="lucide" aria-hidden />
                  ) : (
                    <Circle className="lucide" aria-hidden />
                  )}
                  {step.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="m-lb">
          <h3>Precisa de você</h3>
          <Link to="/organizations/members">Ver tudo</Link>
        </div>
        {pendingMemberships.length === 0 ? (
          <div className="m-pad" style={{ paddingTop: 0 }}>
            <div className="m-card m-empty">
              <Users className="lucide m-ok" aria-hidden />
              <span>Nenhuma adesão esperando análise.</span>
            </div>
          </div>
        ) : (
          <div className="m-need m-card">
            {pendingMemberships.slice(0, 3).map((membership) => (
              <div key={membership.id} className="m-pr">
                <span className="m-avatar" style={{ width: "40px", height: "40px" }}>
                  {initials(membership.producerName)}
                </span>
                <div>
                  <b>{membership.producerName}</b>
                  <span>Adesão · {membership.location ?? membership.propertyName}</span>
                </div>
                <Link to="/organizations/members" className="m-btn m-secondary m-sm">
                  Revisar
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
