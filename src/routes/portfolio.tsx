import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  ChevronRight,
  CircleCheck,
  Clock3,
  Search,
  ShoppingBasket,
  SlidersHorizontal,
} from "@/components/mobile/icons";
import { useEffect, useMemo, useState } from "react";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { NotificationBell } from "@/components/mobile/NotificationBell";
import { DataLoadError, DataLoading } from "@/components/system/DataLoadState";
import { useAuth } from "@/lib/auth";
import { useAvailableProductsResource } from "@/lib/available-products";
import { useBuyerProfileDetails } from "@/lib/buyer-profile";
import { useCart } from "@/lib/cart";
import { preferredProducer } from "@/lib/catalog";
import { initials } from "@/lib/format";
import { getOperationWindow } from "@/lib/operation";
import { PRODUCT_GROUPS } from "@/lib/product-group";

export const Route = createFileRoute("/portfolio")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Portfolio />
    </RequireProfile>
  ),
});

const weekday = (date: Date) => date.toLocaleDateString("pt-BR", { weekday: "short" });

function Portfolio() {
  const { products, loading, error, reload } = useAvailableProductsResource();
  const { cart, setQty, totalItems } = useCart();
  const { profile } = useAuth();
  const { details } = useBuyerProfileDetails();
  const operation = useMemo(() => getOperationWindow(), []);
  const [cat, setCat] = useState("Todos");
  const [q, setQ] = useState("");
  const [cheapestFirst, setCheapestFirst] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [added, setAdded] = useState<{ message: React.ReactNode; undo: () => void } | null>(null);
  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(null), 4500);
    return () => window.clearTimeout(timer);
  }, [added]);
  const listCount = Object.values(cart).filter((value) => value > 0).length;

  const categories = useMemo(() => {
    const present = new Set(products.map((product) => product.category));
    const ordered = PRODUCT_GROUPS.filter((group) => present.has(group));
    const others = [...present].filter((group) => !ordered.includes(group as never)).sort();
    return ["Todos", ...ordered, ...others];
  }, [products]);

  const filtered = useMemo(() => {
    const list = products.filter(
      (product) =>
        (cat === "Todos" || product.category === cat) &&
        (q === "" || product.name.toLowerCase().includes(q.toLowerCase())),
    );
    return cheapestFirst
      ? [...list].sort((a, b) => preferredProducer(a).price - preferredProducer(b).price)
      : list;
  }, [cat, cheapestFirst, products, q]);

  const name = profile?.nome ?? "";
  const firstName = name.split(" ")[0];
  const company = details.companyName || "Complete seu perfil";

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-01-portfolio">
        <section className="m-hero">
          <img src="/img/campo.jpg" alt="" />
          <div className="m-veil" />
          <div className="m-in">
            <div className="m-status" />
            <div className="m-hello">
              <Link
                to="/profile/buyer"
                className="m-avatar m-l"
                style={{ background: "#fff" }}
                aria-label="Abrir perfil"
              >
                {initials(name) || "?"}
              </Link>
              <div className="m-who">
                <b>Olá, {firstName}</b>
                <span>{company}</span>
              </div>
              <NotificationBell glass />
            </div>
            <h1>
              Direto do produtor<b>para sua cozinha</b>
            </h1>
            <div className="m-dl">
              <span className="m-chip m-white">
                <Clock3 className="lucide" aria-hidden />
                Pedidos até {weekday(operation.cutoff)}, 18h · entrega {weekday(operation.delivery)}
                , 8h
              </span>
            </div>
            <label className="m-search">
              <Search className="lucide" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Buscar alface, tomate, ovos…"
                aria-label="Buscar produto no portfólio"
              />
              <button
                type="button"
                className="m-go"
                aria-pressed={cheapestFirst}
                aria-label="Ordenar pelo menor preço"
                title="Ordenar pelo menor preço"
                onClick={() => setCheapestFirst((current) => !current)}
              >
                <SlidersHorizontal className="lucide" aria-hidden />
              </button>
            </label>
          </div>
        </section>

        <div className="m-cats" role="tablist" aria-label="Categorias">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={category === cat}
              className={`m-pill${category === cat ? " m-on" : ""}`}
              onClick={() => setCat(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="m-sec">
          <h2>{expanded ? "Todos os produtos" : "Colhido esta semana"}</h2>
          {filtered.length > 2 && (
            <button type="button" onClick={() => setExpanded((current) => !current)}>
              {expanded ? "Ver menos" : "Ver tudo"}
            </button>
          )}
        </div>

        {error && (
          <div className="m-pad">
            <DataLoadError message={error} onRetry={reload} />
          </div>
        )}

        {loading && products.length === 0 ? (
          <div className="m-pad">
            <DataLoading label="Carregando produtos disponíveis..." />
          </div>
        ) : filtered.length === 0 && !error ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>Nenhum produto disponível</b>
              <span>
                {q || cat !== "Todos"
                  ? "Tente outra busca ou categoria."
                  : "Os produtos aparecem aqui quando os produtores publicam estoque."}
              </span>
            </div>
          </div>
        ) : (
          <div className={`m-rail${expanded ? " m-grid" : ""}`}>
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                qty={cart[product.id] ?? 0}
                onChange={(qty) => setQty(product.id, qty)}
                onAdded={(message, undo) => setAdded({ message, undo })}
              />
            ))}
          </div>
        )}

        {expanded && (
          <div className="m-pad">
            <Link to="/directory/organizations" className="m-card m-linkrow">
              <span className="m-ic">
                <Building2 className="lucide" aria-hidden />
              </span>
              <span className="m-tx">
                <b>Cooperativas e associações</b>
                <span>Compre de grupos de produtores da região</span>
              </span>
              <ChevronRight className="lucide" aria-hidden />
            </Link>
          </div>
        )}

        {added ? (
          <div className="m-toast" role="status">
            <CircleCheck className="lucide" aria-hidden />
            {added.message}
            <button
              type="button"
              onClick={() => {
                added.undo();
                setAdded(null);
              }}
            >
              Desfazer
            </button>
          </div>
        ) : (
          totalItems > 0 && (
            <Link to="/order" className="m-toast">
              <ShoppingBasket className="lucide" aria-hidden />
              <span>
                <b>
                  {listCount} {listCount === 1 ? "item" : "itens"}
                </b>{" "}
                na lista de interesse
              </span>
              <span className="m-act">Ver lista</span>
            </Link>
          )
        )}
      </div>
    </>
  );
}
