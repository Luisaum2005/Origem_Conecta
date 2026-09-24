import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Building2,
  LifeBuoy,
  LogOut,
  Repeat2,
  Settings,
  UserCog,
} from "@/components/mobile/icons";
import { useState } from "react";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { supportHref } from "@/lib/support";
import { ListRow, TextSizeOptions } from "@/components/mobile/ProfileParts";
import { Sheet } from "@/components/mobile/Sheet";
import { PushSettings } from "@/components/notifications/PushSettings";
import { OrganizationSettingsForm } from "@/components/organizations/OrganizationSettingsForm";
import { InstallButton } from "@/components/pwa/InstallButton";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { useOrganizationDashboard } from "@/lib/organization-dashboard";
import { useOrganizations } from "@/lib/organizations";

export const Route = createFileRoute("/profile/organization")({
  component: () => (
    <RequireProfile roles={["gestor_organizacao"]}>
      <OrganizationProfile />
    </RequireProfile>
  ),
});

const formatCnpj = (value: string) =>
  value.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

function OrganizationProfile() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const { organizations, loading, error, refresh } = useOrganizations();
  const organization = organizations[0];
  const { metrics } = useOrganizationDashboard(organizations.map((item) => item.id));
  const [sheet, setSheet] = useState<"data" | "notifications" | "settings" | null>(null);

  const logout = async () => {
    await signOut();
    await navigate({ to: "/login", replace: true });
  };
  const back = () => {
    if (window.history.length > 1) router.history.back();
    else void navigate({ to: "/organizations" });
  };

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-c6-perfil">
        <div className="m-cover">
          <img src="/img/campo.jpg" alt="" />
          <div className="m-veil" />
          <div className="m-status" />
          <div className="m-cb">
            <button type="button" className="m-round m-glass" onClick={back} aria-label="Voltar">
              <ArrowLeft className="lucide" aria-hidden />
            </button>
            <button
              type="button"
              className="m-round m-glass"
              onClick={() => void logout()}
              aria-label="Sair da conta"
            >
              <LogOut className="lucide" aria-hidden />
            </button>
          </div>
        </div>

        <div className="m-me m-card">
          <div className="m-top">
            <span className="m-avatar m-big m-mono">
              {initials(organization?.tradeName ?? profile?.nome) || "?"}
            </span>
            {organization?.verificationStatus === "verified" && (
              <span className="m-chip m-leaf">
                <BadgeCheck className="lucide" aria-hidden />
                CNPJ verificado
              </span>
            )}
          </div>
          <b>{organization?.tradeName ?? (loading ? "Carregando..." : "Sua organização")}</b>
          {organization && (
            <>
              <span>
                {organization.legalName} · {organization.city}
              </span>
              <span>CNPJ {formatCnpj(organization.cnpj)}</span>
            </>
          )}
          <div className="m-kp">
            <div>
              <strong>{metrics.activeMembers}</strong>
              <em>associados</em>
            </div>
            <div>
              <strong>{metrics.activeProducts}</strong>
              <em>produtos</em>
            </div>
            <div>
              <strong>{metrics.authorizedMembers}</strong>
              <em>vendem</em>
            </div>
          </div>
        </div>

        {error && (
          <div className="m-pad">
            <div className="m-card m-alert" role="alert">
              <span>Não foi possível carregar os dados da organização.</span>
              <button type="button" onClick={() => void refresh()}>
                Tentar de novo
              </button>
            </div>
          </div>
        )}

        <div className="m-grp m-card">
          <ListRow
            icon={<Building2 className="lucide" aria-hidden />}
            title="Dados institucionais"
            subtitle="Razão social, endereço, IE"
            onClick={() => setSheet("data")}
          />
          <ListRow
            icon={<UserCog className="lucide" aria-hidden />}
            title="Responsáveis"
            subtitle={
              organization
                ? `${organization.responsibleName} · ${organization.responsibleRole.toLowerCase()}`
                : "Quem administra a organização"
            }
            onClick={() => setSheet("data")}
          />
          <ListRow
            icon={<Bell className="lucide" aria-hidden />}
            title="Notificações"
            subtitle="Adesões, pedidos e mensagens"
            onClick={() => setSheet("notifications")}
          />
          {profile?.roles.includes("produtor") && (
            <ListRow
              icon={<Repeat2 className="lucide" aria-hidden />}
              title="Área do produtor"
              subtitle="Estoque e negociações da sua unidade"
              to="/profile/producer"
            />
          )}
        </div>
        <div className="m-grp m-card">
          <ListRow
            icon={<Settings className="lucide" aria-hidden />}
            title="Ajustes"
            subtitle="Tamanho do texto e instalar o app"
            onClick={() => setSheet("settings")}
          />
          <ListRow
            icon={<LifeBuoy className="lucide" aria-hidden />}
            title="Suporte"
            subtitle="WhatsApp da equipe Origem"
            href={supportHref}
          />
        </div>
      </div>

      <Sheet open={sheet === "data"} title="Dados institucionais" onClose={() => setSheet(null)}>
        <div className="m-legacy">
          {organizations.map((item) => (
            <OrganizationSettingsForm key={item.id} organization={item} onUpdated={refresh} />
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === "notifications"} title="Notificações" onClose={() => setSheet(null)}>
        <PushSettings />
      </Sheet>
      <Sheet open={sheet === "settings"} title="Ajustes" onClose={() => setSheet(null)}>
        <span className="m-lbl">Tamanho do texto</span>
        <TextSizeOptions />
        <span className="m-lbl">Aplicativo</span>
        <InstallButton variant="compact" />
      </Sheet>
    </>
  );
}
