import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/auth";
import { ClipboardList, Users } from "lucide-react";

export const Route = createFileRoute("/organizations/negotiations")({
  component: () => (
    <RequireProfile roles={["gestor_organizacao"]}>
      <OrganizationNegotiations />
    </RequireProfile>
  ),
});

function OrganizationNegotiations() {
  const { profile } = useAuth();
  const isProducer = profile?.roles?.includes("produtor");
  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[900px] px-4 py-8 pb-24 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Gestão institucional
        </p>
        <h1 className="mt-2 text-3xl font-bold text-brand-900">Negociações</h1>
        <div className="mt-8 rounded-2xl border border-border bg-white p-6 shadow-xs">
          <ClipboardList className="h-9 w-9 text-leaf-700" />
          <h2 className="mt-4 text-xl font-bold text-brand-900">
            Como funciona a negociação institucional
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Os produtos são publicados por produtores autorizados, usando os dados comerciais da
            organização. O produtor responsável conduz a negociação e a organização mantém a gestão
            dos vínculos.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/organizations/members"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-brand-900"
            >
              <Users className="h-4 w-4" /> Gerenciar autorizados
            </Link>
            {isProducer && (
              <Link
                to="/producer/orders"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-900 px-4 text-sm font-semibold text-white"
              >
                Ver minhas negociações como produtor
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
