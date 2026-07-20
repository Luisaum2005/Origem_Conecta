import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { useOrganizationDirectory } from "@/lib/organization-directory";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, MapPin, Search, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/directory/organizations")({
  component: () => (
    <RequireProfile allowed={["comprador", "produtor", "admin"]}>
      <OrganizationDirectory />
    </RequireProfile>
  ),
});

function OrganizationDirectory() {
  const [query, setQuery] = useState("");
  const { organizations, loading, error } = useOrganizationDirectory(query);
  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-8 pb-24 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Rede Origem Conecta
        </p>
        <h1 className="mt-2 text-3xl font-bold text-brand-900">Cooperativas e associações</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Encontre organizações, produtores associados e os produtos que fazem parte da rede.
        </p>
        <label className="relative mt-6 block max-w-xl">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por organização, cidade ou produto"
            className="h-11 w-full rounded-xl border border-border bg-white pl-11 pr-4 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-100"
          />
        </label>

        {loading ? (
          <p className="mt-8 rounded-2xl border border-border bg-white p-6 text-sm text-muted-foreground">
            Carregando organizações...
          </p>
        ) : error ? (
          <p className="mt-8 rounded-2xl bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error-fg)]">
            Não foi possível carregar o diretório: {error}
          </p>
        ) : organizations.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-border bg-white p-8 text-center text-sm text-muted-foreground">
            Nenhuma organização encontrada para esta busca.
          </p>
        ) : (
          <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {organizations.map((organization) => (
              <article
                key={organization.id}
                className="rounded-2xl border border-border bg-white p-5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-leaf-100 text-brand-700">
                    <Building2 className="h-5 w-5" />
                  </span>
                  {organization.verificationStatus === "verified" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-success-fg)]">
                      <ShieldCheck className="h-3.5 w-3.5" /> Verificada
                    </span>
                  )}
                </div>
                <p className="mt-4 text-xs font-semibold uppercase text-leaf-700">
                  {organization.type === "cooperativa" ? "Cooperativa" : "Associação"}
                </p>
                <h2 className="mt-1 text-lg font-bold text-brand-900">{organization.tradeName}</h2>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-leaf-700" />
                    {organization.city}, {organization.state}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-leaf-700" />
                    {organization.activeMembers} associado(s)
                  </span>
                </div>
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Produtos fornecidos pela rede
                  </p>
                  <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                    {organization.suppliedProducts.length ? (
                      organization.suppliedProducts.map((product) => (
                        <span
                          key={product}
                          className="rounded-full bg-leaf-100 px-2.5 py-1 text-xs font-medium text-brand-900"
                        >
                          {product}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Produtos ainda não informados.
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
