import { createFileRoute } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { OrganizationMembers } from "@/components/organizations/OrganizationMembers";
import { useOrganizations } from "@/lib/organizations";
import { Users } from "lucide-react";

export const Route = createFileRoute("/organizations/members")({
  component: () => (
    <RequireProfile roles={["gestor_organizacao"]}>
      <OrganizationMembersPage />
    </RequireProfile>
  ),
});

function OrganizationMembersPage() {
  const { organizations, loading, error } = useOrganizations();
  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1000px] px-4 py-8 pb-24 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Gestão institucional
        </p>
        <h1 className="mt-2 text-3xl font-bold text-brand-900">Associados</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Convide produtores, analise solicitações e defina quem pode comercializar pela
          organização.
        </p>
        {loading && (
          <p className="mt-8 rounded-2xl border border-border bg-white p-6">
            Carregando associados...
          </p>
        )}
        {error && (
          <p className="mt-8 rounded-xl bg-red-50 p-4 text-red-800" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && organizations.length === 0 && (
          <div className="mt-8 rounded-2xl border border-border bg-white p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-leaf-700" />
            <p className="mt-3 font-semibold text-brand-900">Nenhuma organização vinculada.</p>
          </div>
        )}
        <div className="mt-8 space-y-5">
          {organizations.map((organization) => (
            <section
              key={organization.id}
              className="rounded-2xl border border-border bg-white p-5 shadow-xs"
            >
              <h2 className="text-xl font-bold text-brand-900">{organization.tradeName}</h2>
              <OrganizationMembers organizationId={organization.id} />
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
