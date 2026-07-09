import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { useAvailableProducts } from "@/lib/available-products";
import { useCart } from "@/lib/cart";
import { Search, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/portfolio")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Portfolio />
    </RequireProfile>
  ),
});

function Portfolio() {
  const products = useAvailableProducts();
  const categories = useMemo(
    () => ["Todos", ...Array.from(new Set(products.map((product) => product.category)))],
    [products],
  );
  const { cart, producerChoices, selectedUnits, setQty, setProducerChoice, setUnit, totalItems } = useCart();
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
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
                Portfólio
              </h1>
            </div>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Buscar produto"
              className="h-12 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm text-brand-900 placeholder:text-[var(--text-tertiary)] focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-100"
            />
          </div>
        </div>

        <div className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {categories.map((category) => {
            const active = category === cat;
            return (
              <button
                key={category}
                onClick={() => setCat(category)}
                className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
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

        <section className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              qty={cart[product.id] ?? 0}
              onChange={(qty) => setQty(product.id, qty)}
              producerChoice={producerChoices[product.id]}
              onProducerChange={(producerId) => setProducerChoice(product.id, producerId)}
              selectedUnit={selectedUnits[product.id] ?? product.unit}
              onUnitChange={(unit) => setUnit(product.id, unit)}
            />
          ))}
        </section>

        {filtered.length === 0 && (
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
          className="fixed bottom-[92px] left-1/2 z-40 inline-flex h-14 max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-brand-900 px-5 text-base font-semibold text-white shadow-md transition-all hover:bg-brand-800 hover:shadow-lg md:bottom-6 md:px-6"
        >
          <ShoppingBag className="h-5 w-5" />
          Ver pedido
          <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-orange-600 px-2 text-sm font-bold">
            {totalItems.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          </span>
        </Link>
      )}
    </div>
  );
}
