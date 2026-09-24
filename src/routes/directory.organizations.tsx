import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  Package,
  Search,
  Users,
  Warehouse,
} from "@/components/mobile/icons";
import { useMemo, useState } from "react";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/auth";
import { useBuyerProfileDetails } from "@/lib/buyer-profile";
import { useOrganizationDirectory } from "@/lib/organization-directory";
import { PRODUCT_GROUPS, productGroup } from "@/lib/product-group";

export const Route = createFileRoute("/directory/organizations")({
  component: () => (
    <RequireProfile allowed={["comprador", "produtor", "admin"]}>
      <OrganizationDirectory />
    </RequireProfile>
  ),
});

type Filter = "all" | "near" | "cooperativa" | "associacao";

const normalize = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function OrganizationDirectory() {
  const router = useRouter();
  const { profile } = useAuth();
  const { details } = useBuyerProfileDetails();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { organizations, loading, error } = useOrganizationDirectory(query);
  const city = normalize(details.city || "");

  const visible = useMemo(
    () =>
      organizations.filter((organization) => {
        if (filter === "near") return Boolean(city) && normalize(organization.city) === city;
        if (filter === "cooperativa" || filter === "associacao")
          return organization.type === filter;
        return true;
      }),
    [city, filter, organizations],
  );

  const pills: { key: Filter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "near", label: "Perto de mim" },
    { key: "cooperativa", label: "Cooperativas" },
    { key: "associacao", label: "Associações" },
  ];

  const back = () => {
    if (window.history.length > 1) router.history.back();
    else
      void router.navigate({
        to: profile?.tipo === "produtor" ? "/producer/orders" : "/portfolio",
      });
  };

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-10-cooperativas">
        <div className="m-status" />
        <div className="m-hd">
          <button type="button" className="m-round" onClick={back} aria-label="Voltar">
            <ArrowLeft className="lucide" aria-hidden />
          </button>
          <h1>Cooperativas e associações</h1>
          <span style={{ width: "44px" }} />
        </div>
        <div style={{ padding: "12px 20px 0" }}>
          <label className="m-search">
            <Search className="lucide" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome ou cidade"
              aria-label="Buscar cooperativa ou associação"
            />
          </label>
        </div>
        <div className="m-cats" role="tablist">
          {pills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              role="tab"
              aria-selected={filter === pill.key}
              className={`m-pill${filter === pill.key ? " m-on" : ""}`}
              onClick={() => setFilter(pill.key)}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <span>Carregando organizações...</span>
            </div>
          </div>
        ) : error ? (
          <div className="m-pad">
            <div className="m-card m-alert" role="alert">
              <span>Não foi possível carregar o diretório: {error}</span>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>Nenhuma organização encontrada</b>
              <span>
                {filter === "near" && !city
                  ? "Informe sua cidade no perfil para ver as organizações perto de você."
                  : "Tente outra busca ou filtro."}
              </span>
            </div>
          </div>
        ) : (
          visible.map((organization) => {
            const groups = [
              ...new Set(
                organization.suppliedProducts.map(productGroup).filter((g) => g !== "Outros"),
              ),
            ].sort(
              (a, b) =>
                ((PRODUCT_GROUPS.indexOf(a as never) + 99) % 99) -
                ((PRODUCT_GROUPS.indexOf(b as never) + 99) % 99),
            );
            const type = organization.type === "cooperativa" ? "Cooperativa" : "Associação";
            return (
              <article key={organization.id} className="m-co m-card">
                <div className="m-ph">
                  <div className="m-fallback" style={{ width: "100%", height: "100%" }}>
                    <Warehouse className="lucide" aria-hidden />
                    <span>{type}</span>
                  </div>
                  {organization.verificationStatus === "verified" && (
                    <span className="m-chip m-white m-v">
                      <BadgeCheck className="lucide" aria-hidden />
                      Verificada
                    </span>
                  )}
                </div>
                <div className="m-bd">
                  <b>{organization.tradeName}</b>
                  <span>
                    {[organization.city && `${organization.city}, ${organization.state}`, type]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <div className="m-mt">
                    <span>
                      <Users className="lucide" aria-hidden />
                      {organization.activeMembers}{" "}
                      {organization.activeMembers === 1 ? "associado" : "associados"}
                    </span>
                    <span>
                      <Package className="lucide" aria-hidden />
                      {organization.suppliedProducts.length}{" "}
                      {organization.suppliedProducts.length === 1 ? "produto" : "produtos"}
                    </span>
                  </div>
                  {groups.length > 0 && (
                    <div className="m-cs">
                      {groups.slice(0, 4).map((group) => (
                        <span key={group} className="m-chip m-leaf">
                          {group}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}

        <div className="m-footer" style={{ paddingBottom: "30px" }}>
          <div className="m-cta2">
            <div>
              <b>Você representa uma?</b>
              <span>Cadastre e venda para restaurantes da região.</span>
            </div>
            <Link to="/signup/organization" className="m-btn m-secondary m-sm">
              Cadastrar
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
