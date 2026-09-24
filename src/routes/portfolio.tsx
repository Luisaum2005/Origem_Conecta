import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { DataLoadError, DataLoading } from "@/components/system/DataLoadState";
import { useAvailableProductsResource } from "@/lib/available-products";
import { useCart } from "@/lib/cart";
import { Building2, Clock3, Search, ShoppingBag } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getOperationWindow } from "@/lib/operation";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/portfolio")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Portfolio />
    </RequireProfile>
  ),
});

function Portfolio() {
  const { products, loading, error, reload } = useAvailableProductsResource();
  const categories = useMemo(
    () => ["Todos", ...Array.from(new Set(products.map((product) => product.category)))],
    [products],
  );
  const { cart, setQty, totalItems } = useCart();
  const { profile } = useAuth();
  const operation = useMemo(() => getOperationWindow(), []);
  const [cat, setCat] = useState("Todos");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      products.filter(
        (product) =>
          (cat === "Todos" || product.category === cat) &&
          (q === "" || product.name.toLowerCase().includes(q.toLowerCase())),
      ),
    [cat, products, q],
  );

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-6 pb-44 sm:px-8 sm:py-10 md:pb-10">
        <section className="relative -mx-4 -mt-6 overflow-hidden rounded-b-[28px] text-white sm:mx-0 sm:mt-0 sm:rounded-[28px]">
          <img
            src="/img/campo.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,61,34,.55)_0%,rgba(20,61,34,.15)_38%,rgba(20,61,34,.94)_100%)]" />
          <div className="relative flex min-h-[300px] flex-col justify-end px-5 pb-5 pt-6 sm:min-h-[340px] sm:px-10 sm:pb-8">
            {profile?.nome && (
              <p className="mb-auto text-sm font-medium text-white/85">Olá, {profile.nome}</p>
            )}
            <h1 className="mt-10 text-[28px] font-normal leading-tight tracking-tight text-white sm:text-4xl">
              Direto do produtor
              <span className="block text-[34px] font-semibold sm:text-5xl">para sua cozinha</span>
            </h1>
            <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-brand-900">
              <Clock3 className="h-3.5 w-3.5" />
              Pedidos até{" "}
              {operation.cutoff.toLocaleDateString("pt-BR", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
              })}
              , 18h · entrega {operation.delivery.toLocaleDateString("pt-BR", { weekday: "short" })}
              , 8h
            </span>
            <div className="relative mt-4 w-full sm:max-w-md">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Buscar produto no portfólio"
                type="search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Buscar alface, tomate, ovos…"
                className="h-13 w-full rounded-full border-0 bg-white/97 py-3.5 pl-12 pr-4 text-[15px] text-brand-900 shadow-lg placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-leaf-300"
              />
            </div>
          </div>
        </section>

        <Link
          to="/directory/organizations"
          className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-leaf-700 hover:underline"
        >
          <Building2 className="h-4 w-4" />
          Conhecer cooperativas e associações
        </Link>

        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {categories.map((category) => {
            const active = category === cat;
            return (
              <button
                key={category}
                onClick={() => setCat(category)}
                className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors motion-reduce:transition-none ${
                  active
                    ? "bg-brand-900 text-white"
                    : "border border-border bg-white text-muted-foreground hover:text-brand-900"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-8">
            <DataLoadError message={error} onRetry={reload} />
          </div>
        )}

        {loading && products.length === 0 ? (
          <div className="mt-10">
            <DataLoading label={"Carregando produtos dispon\u00edveis..."} />
          </div>
        ) : (
          <section className="mt-5 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                qty={cart[product.id] ?? 0}
                onChange={(qty) => setQty(product.id, qty)}
              />
            ))}
          </section>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="mt-10 rounded-2xl border border-border bg-canvas p-12 text-center">
            <h3 className="text-lg font-semibold text-brand-900">Nenhum produto disponível</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Publique produtos ativos no estoque do produtor para aparecerem aqui.
            </p>
          </div>
        )}
      </main>

      {totalItems > 0 && (
        <Link
          to="/order"
          className="fixed bottom-[92px] left-1/2 z-40 inline-flex h-14 max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-brand-900 px-5 text-base font-semibold text-white shadow-md transition-all hover:bg-brand-800 hover:shadow-lg motion-reduce:transition-none md:bottom-6 md:px-6"
        >
          <ShoppingBag className="h-5 w-5" />
          Ver lista de interesse
          <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-orange-600 px-2 text-sm font-bold">
            {totalItems.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          </span>
        </Link>
      )}
    </div>
  );
}
