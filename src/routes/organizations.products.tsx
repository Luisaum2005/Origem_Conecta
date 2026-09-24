import { createFileRoute } from "@tanstack/react-router";
import { Search, TriangleAlert, X } from "@/components/mobile/icons";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { ProductFallback } from "@/components/marketplace/ProductCard";
import { Sheet } from "@/components/mobile/Sheet";
import { formatBRL, unitLabel } from "@/lib/format";
import {
  isOrganizationProductLowStock,
  isOrganizationProductOutdated,
  type OrganizationProduct,
  setOrganizationProductPaused,
  useOrganizationProducts,
} from "@/lib/organization-products";
import { PRODUCT_GROUPS, productGroup } from "@/lib/product-group";

export const Route = createFileRoute("/organizations/products")({
  component: () => (
    <RequireProfile roles={["gestor_organizacao"]}>
      <OrganizationProductsPage />
    </RequireProfile>
  ),
});

function OrganizationProductsPage() {
  const { products, loading, error, refresh } = useOrganizationProducts();
  const [group, setGroup] = useState("Todos");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OrganizationProduct | null>(null);
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const present = new Set(products.map((product) => productGroup(product.productName)));
    return ["Todos", ...PRODUCT_GROUPS.filter((item) => present.has(item))];
  }, [products]);
  const members = new Set(products.map((product) => product.producerId)).size;
  const visible = products.filter((product) => {
    const term = query.trim().toLowerCase();
    if (term && !`${product.productName} ${product.propertyName}`.toLowerCase().includes(term))
      return false;
    return group === "Todos" || productGroup(product.productName) === group;
  });

  const togglePause = async (product: OrganizationProduct) => {
    setBusy(true);
    try {
      await setOrganizationProductPaused(product.id, !product.organizationPaused);
      toast.success(
        product.organizationPaused ? "Produto liberado" : "Produto pausado pela organização",
      );
      await refresh();
      setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o produto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-c3-produtos">
        <div className="m-status" />
        <div className="m-hd m-big">
          <h1>Produtos</h1>
          <button
            type="button"
            className="m-round"
            aria-label={searching ? "Fechar busca" : "Buscar produto"}
            onClick={() => {
              setSearching((value) => !value);
              setQuery("");
            }}
          >
            {searching ? (
              <X className="lucide" aria-hidden />
            ) : (
              <Search className="lucide" aria-hidden />
            )}
          </button>
        </div>
        {searching && (
          <div style={{ padding: "14px 20px 0" }}>
            <label className="m-search">
              <Search className="lucide" aria-hidden />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Produto ou associado"
                aria-label="Buscar produto"
              />
            </label>
          </div>
        )}
        <p className="m-intro">
          {products.length} {products.length === 1 ? "produto" : "produtos"} de {members}{" "}
          {members === 1 ? "associado vendido" : "associados vendidos"} em nome da cooperativa.
        </p>
        <div className="m-cats" role="tablist">
          {groups.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={group === item}
              className={`m-pill${group === item ? " m-on" : ""}`}
              onClick={() => setGroup(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {error && (
          <div className="m-pad">
            <div className="m-card m-alert" role="alert">
              <span>{error}</span>
            </div>
          </div>
        )}
        {loading && products.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <span>Carregando produtos...</span>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>Nenhum produto aqui</b>
              <span>Os produtos dos associados autorizados a vender aparecem nesta lista.</span>
            </div>
          </div>
        ) : (
          <div className="m-grid">
            {visible.map((product) => (
              <button
                key={product.id}
                type="button"
                className={`m-pp m-card${product.organizationPaused || !product.active ? " m-paused" : ""}`}
                onClick={() => setSelected(product)}
              >
                <div className="m-ph">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" />
                  ) : (
                    <ProductFallback
                      category={productGroup(product.productName)}
                      name={product.productName}
                      label={false}
                      className="m-fill"
                    />
                  )}
                  <span className="m-chip m-white m-q">
                    {product.availableQuantity.toLocaleString("pt-BR")}{" "}
                    {unitLabel(product.unit, product.availableQuantity)}
                  </span>
                </div>
                <div className="m-tx">
                  <b>{product.productName}</b>
                  <span>por {product.propertyName}</span>
                  <div className="m-r2">
                    <span className="m-price">
                      {formatBRL(product.price)} <small>/{product.unit}</small>
                    </span>
                  </div>
                  {product.organizationPaused ? (
                    <span className="m-warn">Pausado pela organização</span>
                  ) : isOrganizationProductLowStock(product) ? (
                    <span className="m-warn">
                      <TriangleAlert className="lucide" aria-hidden />
                      Acabando
                    </span>
                  ) : isOrganizationProductOutdated(product.updatedAt) ? (
                    <span className="m-warn">Sem atualização há 30 dias</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={Boolean(selected)}
        title={selected?.productName ?? ""}
        onClose={() => setSelected(null)}
        footer={
          selected && (
            <button
              type="button"
              className={`m-btn ${selected.organizationPaused ? "m-primary" : "m-secondary"}`}
              disabled={busy}
              onClick={() => void togglePause(selected)}
            >
              {selected.organizationPaused ? "Liberar para venda" : "Pausar pela organização"}
            </button>
          )
        }
      >
        {selected && (
          <p className="m-note">
            {selected.propertyName} · {selected.producerName}
            <br />
            {selected.availableQuantity.toLocaleString("pt-BR")}{" "}
            {unitLabel(selected.unit, selected.availableQuantity)} disponíveis · mínimo{" "}
            {selected.minimumStock.toLocaleString("pt-BR")} · {formatBRL(selected.price)}/
            {selected.unit}
            <br />
            Atualizado em {new Date(selected.updatedAt).toLocaleDateString("pt-BR")}
          </p>
        )}
      </Sheet>
    </>
  );
}
