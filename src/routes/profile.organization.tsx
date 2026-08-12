import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { PushSettings } from "@/components/notifications/PushSettings";
import { OrganizationSettingsForm } from "@/components/organizations/OrganizationSettingsForm";
import { useAuth } from "@/lib/auth";
import { useOrganizations } from "@/lib/organizations";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BellRing, Building2, LogOut, Repeat2, ShieldCheck, Users } from "lucide-react";

export const Route = createFileRoute("/profile/organization")({
  component: () => (
    <RequireProfile roles={["gestor_organizacao"]}>
      <OrganizationProfile />
    </RequireProfile>
  ),
});

function OrganizationProfile() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { organizations, loading, error, refresh } = useOrganizations();
  const logout = async () => {
    await signOut();
    await navigate({ to: "/login", replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1000px] px-4 py-8 pb-24 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Configurações institucionais
        </p>
        <h1 className="mt-2 text-3xl font-bold text-brand-900">Perfil da organização</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Mantenha os contatos e endereços atualizados e escolha quais avisos deseja receber.
        </p>

        <section className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-xs sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-leaf-100">
              <ShieldCheck className="h-5 w-5 text-leaf-700" />
            </span>
            <div className="min-w-0">
              <h2 className="font-bold text-brand-900">Conta responsável</h2>
              <p className="truncate text-sm text-muted-foreground">
                {profile?.nome} · {profile?.email}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-5">
            <Link
              to="/organizations/members"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-brand-900 hover:bg-secondary"
            >
              <Users className="h-4 w-4" /> Gerenciar associados
            </Link>
            {profile?.roles.includes("produtor") && (
              <Link
                to="/profile/producer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-brand-900 hover:bg-secondary"
              >
                <Repeat2 className="h-4 w-4" /> Acessar perfil de produtor
              </Link>
            )}
          </div>
        </section>

        <section className="mt-6 space-y-4" aria-labelledby="organization-data-title">
          <div>
            <h2 id="organization-data-title" className="text-xl font-bold text-brand-900">
              Dados das organizações
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Alterações de contato são aplicadas imediatamente.
            </p>
          </div>
          {loading ? (
            <div className="h-72 animate-pulse rounded-2xl bg-white" />
          ) : error ? (
            <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800" role="alert">
              <p>Não foi possível carregar os dados das organizações.</p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="mt-2 font-semibold underline"
              >
                Tentar novamente
              </button>
            </div>
          ) : organizations.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white p-8 text-center">
              <Building2 className="mx-auto h-10 w-10 text-leaf-700" />
              <p className="mt-3 font-semibold text-brand-900">Nenhuma organização vinculada</p>
            </div>
          ) : (
            organizations.map((organization) => (
              <OrganizationSettingsForm
                key={organization.id}
                organization={organization}
                onUpdated={refresh}
              />
            ))
          )}
        </section>

        <section aria-labelledby="notification-settings-title">
          <h2 id="notification-settings-title" className="sr-only">
            Preferências de notificações
          </h2>
          <PushSettings />
        </section>

        <aside className="mt-6 flex gap-3 rounded-2xl border border-leaf-200 bg-leaf-50 p-4 text-sm text-brand-900">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-leaf-700" />
          As preferências acima pertencem à sua conta e valem para todos os perfis acessados com
          este login.
        </aside>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 font-semibold text-red-700 sm:w-auto"
        >
          <LogOut className="h-5 w-5" /> Sair da conta
        </button>
      </main>
    </div>
  );
}
