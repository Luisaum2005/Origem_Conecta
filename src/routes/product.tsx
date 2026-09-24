import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, MessageCircle, Minus, Plus, ShoppingBasket } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { CategoryIcon } from "@/components/marketplace/ProductCard";
import { useStartNegotiation } from "@/lib/negotiation";
import { DataLoadError, DataLoading } from "@/components/system/DataLoadState";
import { useAvailableProductsResource } from "@/lib/available-products";
import { useCart } from "@/lib/cart";
import { preferredProducer } from "@/lib/catalog";
import { formatBRL } from "@/lib/format";

type ProductSearch = { id?: string };

export const Route = createFileRoute("/product")({
  validateSearch: (search: Record<string, unknown>): ProductSearch => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <ProductPage />
    </RequireProfile>
  ),
});

function formatQuantity(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function ProductPage() {
  const { id } = Route.useSearch();
  const { products, loading, error, reload } = useAvailableProductsResource();
  const product = useMemo(() => products.find((item) => item.id === id), [id, products]);
  const { cart, setQty } = useCart();
  const { negotiating, startNegotiation } = useStartNegotiation();
  const [draft, setDraft] = useState<number | null>(null);

  if (error) {
    return (
      <main className="mx-auto max-w-[640px] px-4 py-10">
        <DataLoadError message={error} onRetry={reload} />
      </main>
    );
  }

  if (!product) {
    return (
      <main className="mx-auto max-w-[640px] px-4 py-10">
        {loading ? (
          <DataLoading label="Carregando produto..." />
        ) : (
          <div className="surface-card p-8 text-center">
            <p className="font-semibold text-brand-900">Produto não encontrado</p>
            <Link to="/portfolio" className="mt-4 inline-flex font-semibold text-leaf-700">
              Voltar ao portfólio
            </Link>
          </div>
        )}
      </main>
    );
  }

  const producer = preferredProducer(product);
  const stock = Math.max(0, producer.stock);
  const inCart = cart[product.id] ?? 0;
  const quantity = draft ?? (inCart > 0 ? inCart : Math.min(1, stock));
  const clamp = (value: number) => Math.max(0, Math.min(stock, Number(value.toFixed(2))));

  const addToList = () => {
    if (quantity <= 0) {
      toast.error("Informe uma quantidade maior que zero.");
      return;
    }
    setQty(product.id, clamp(quantity));
    setDraft(null);
    toast.success(`${formatQuantity(quantity)} ${product.unit} de ${product.name} na lista`, {
      action: { label: "Desfazer", onClick: () => setQty(product.id, inCart) },
    });
  };

  return (
    <div className="min-h-screen pb-56">
      <div className="relative h-[340px] overflow-hidden [background:linear-gradient(160deg,#eef8e2_0%,#d9eec4_100%)] sm:mx-auto sm:mt-6 sm:max-w-[640px] sm:rounded-[28px]">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center">
            <CategoryIcon category={product.category} name={product.name} />
          </div>
        )}
        <Link
          to="/portfolio"
          aria-label="Voltar ao portfólio"
          className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-brand-900 shadow-sm backdrop-blur"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      <main className="relative -mt-7 rounded-t-[28px] bg-canvas px-5 pt-6 sm:mx-auto sm:mt-0 sm:max-w-[640px] sm:bg-transparent sm:px-0">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-600">
          {product.category}
        </p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-brand-900">
          {product.name}
        </h1>
        {product.description && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        )}

        <dl className="surface-card mt-4 grid grid-cols-3 p-3.5">
          <div>
            <dt className="text-xs text-muted-foreground">Preço/{product.unit}</dt>
            <dd className="mt-1 whitespace-nowrap text-[15px] font-semibold text-brand-900">
              {formatBRL(producer.price)}
            </dd>
          </div>
          <div className="border-l border-[var(--hairline)] pl-3">
            <dt className="text-xs text-muted-foreground">Estoque</dt>
            <dd className="mt-1 whitespace-nowrap text-[15px] font-semibold text-brand-900">
              {formatQuantity(stock)}{" "}
              <span className="text-xs font-medium text-muted-foreground">{product.unit}</span>
            </dd>
          </div>
          <div className="border-l border-[var(--hairline)] pl-3">
            <dt className="text-xs text-muted-foreground">Previsão</dt>
            <dd className="mt-1 text-[15px] font-semibold text-brand-900">{producer.eta}</dd>
          </div>
        </dl>

        <section className="surface-card mt-2.5 flex items-center gap-3 p-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-900 text-sm font-semibold text-white">
            {producer.property
              .split(/\s+/)
              .filter((word) => !["de", "da", "das", "do", "dos", "e"].includes(word.toLowerCase()))
              .slice(0, 2)
              .map((word) => word[0].toUpperCase())
              .join("")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[15px] font-semibold text-brand-900">
              <span className="truncate">{producer.property}</span>
              {producer.commercialVerificationStatus === "verified" && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" aria-label="Verificado" />
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {producer.name} · {producer.origin}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-brand-700">
              {producer.onTimeRate}% no prazo · nota{" "}
              {producer.reliabilityScore.toLocaleString("pt-BR")}
            </p>
          </div>
          <button
            type="button"
            disabled={negotiating}
            onClick={() => void startNegotiation(product, producer)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--hairline)] bg-white text-brand-900 shadow-sm disabled:opacity-50"
            aria-label="Conversar com o produtor"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        </section>
      </main>

      {stock > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-[var(--hairline)] bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3.5 shadow-[0_-12px_30px_-12px_rgba(20,61,34,0.16)] lg:pb-6">
          <div className="mx-auto flex max-w-[640px] flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 items-center gap-1 rounded-full border border-[var(--hairline)] bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setDraft(clamp(quantity - 1))}
                  className="grid h-8 w-8 place-items-center rounded-full bg-surface-brand-soft text-brand-900"
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-10 text-center text-sm font-semibold text-brand-900">
                  {formatQuantity(quantity)}
                </span>
                <button
                  type="button"
                  onClick={() => setDraft(clamp(quantity + 1))}
                  className="grid h-8 w-8 place-items-center rounded-full bg-surface-brand-soft text-brand-900"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="rounded-full bg-surface-brand-soft px-3.5 py-2 text-sm font-semibold text-brand-900">
                {product.unit}
              </span>
              <div className="ml-auto text-right">
                <p className="text-xs text-muted-foreground">Total estimado</p>
                <p className="text-lg font-bold text-brand-900">
                  {formatBRL(quantity * producer.price)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={addToList}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-900 py-3.5 text-base font-semibold text-white"
            >
              <ShoppingBasket className="h-5 w-5" />
              {inCart > 0 ? "Atualizar na lista" : "Adicionar à lista"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
