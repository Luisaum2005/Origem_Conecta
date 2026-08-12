import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { PushSettings } from "@/components/notifications/PushSettings";
import { useAuth } from "@/lib/auth";
import { useOrganizations } from "@/lib/organizations";
import { Building2, LogOut, Repeat2 } from "lucide-react";

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
  const { organizations, loading } = useOrganizations();
  const logout = async () => {
    await signOut();
    await navigate({ to: "/login", replace: true });
  };
  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[900px] px-4 py-8 pb-24 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">Minha conta</p>
        <h1 className="mt-2 text-3xl font-bold text-brand-900">Perfil da organização</h1>
        <section className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-leaf-100">
              <Building2 className="h-5 w-5 text-leaf-700" />
            </span>
            <div>
              <h2 className="font-bold text-brand-900">{profile?.nome}</h2>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {loading ? (
              <p>Carregando...</p>
            ) : (
              organizations.map((organization) => (
                <div key={organization.id} className="rounded-xl bg-canvas p-4">
                  <p className="font-semibold text-brand-900">{organization.tradeName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {organization.legalName} · {organization.city}/{organization.state}
                  </p>
                </div>
              ))
            )}
          </div>
          {profile?.roles.includes("produtor") && (
            <Link
              to="/profile/producer"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-brand-900"
            >
              <Repeat2 className="h-4 w-4" /> Acessar perfil de produtor
            </Link>
          )}
        </section>
        <PushSettings />
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
