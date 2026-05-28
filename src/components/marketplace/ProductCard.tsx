import { Minus, Plus, MapPin, Sparkles, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { preferredProducer, type Product } from "@/lib/catalog";

function StockBadge({ product }: { product: Product }) {
  const stock = product.producers.reduce((sum, producer) => sum + producer.stock, 0);
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-success-bg)] px-3 py-1 text-[12px] font-medium tracking-wide text-[var(--color-success-fg)]">
      Disponível · {stock} {product.unit}
    </span>
  );
}

export function ProductCard({
  product,
  qty,
  onChange,
  producerChoice,
  onProducerChange,
}: {
  product: Product;
  qty: number;
  onChange: (qty: number) => void;
  producerChoice?: string;
  onProducerChange?: (producerId: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const recommended = preferredProducer(product);
  const selectedProducer =
    product.producers.find((producer) => producer.id === producerChoice) ?? recommended;
  const availableStock = Math.max(0, selectedProducer.stock);
  const canIncrease = qty < availableStock;

  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`group flex flex-col rounded-2xl border bg-white p-4 transition-all sm:p-6 ${
        hover ? "border-border-strong shadow-md -translate-y-0.5" : "border-border shadow-xs"
      }`}
      style={{
        borderColor: hover ? "var(--border-strong)" : undefined,
      }}
    >
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-[var(--color-surface-brand-soft)] text-7xl">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          product.emoji
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            {product.category}
          </p>
          <h3 className="mt-1 text-lg font-semibold leading-snug text-brand-900">{product.name}</h3>
        </div>
        <StockBadge product={product} />
      </div>
      <p className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        {selectedProducer.name} · {selectedProducer.origin}
      </p>

      <InsightLine product={product} />

      <div className="mt-4 rounded-xl border border-border bg-canvas p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-900">
              <ShieldCheck className="h-3.5 w-3.5 text-leaf-700" />
              Produtor
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedProducer.onTimeRate}% no prazo · score{" "}
              {selectedProducer.reliabilityScore.toFixed(1)}
            </p>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-brand-700">
            {producerChoice ? "manual" : "auto"}
          </span>
        </div>
        {product.producers.length > 1 && (
          <select
            value={producerChoice ?? ""}
            onChange={(event) => onProducerChange?.(event.target.value)}
            className="mt-3 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
          >
            <option value="">Escolha automática recomendada</option>
            {product.producers.map((producer) => (
              <option key={producer.id} value={producer.id}>
                {producer.name} · R$ {producer.price.toFixed(2)} · {producer.stock} {product.unit}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight text-brand-900">
            R$ {selectedProducer.price.toFixed(2)}
            <span className="ml-1 text-sm font-medium text-muted-foreground">/{product.unit}</span>
          </p>
        </div>
        {qty === 0 ? (
          <button
            onClick={() => onChange(Math.min(1, availableStock))}
            disabled={availableStock <= 0}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-900 px-5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {availableStock <= 0 ? "Indisponivel" : "Adicionar"}
          </button>
        ) : (
          <div className="inline-flex h-11 w-full items-center justify-between rounded-xl border border-border bg-white sm:w-auto">
            <button
              onClick={() => onChange(Math.max(0, qty - 1))}
              className="grid h-11 w-11 place-items-center rounded-l-xl text-brand-900 hover:bg-secondary"
              aria-label="Diminuir"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-sm font-semibold text-brand-900">{qty}</span>
            <button
              onClick={() => onChange(Math.min(availableStock, qty + 1))}
              disabled={!canIncrease}
              className="grid h-11 w-11 place-items-center rounded-r-xl text-brand-900 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Aumentar"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

const INSIGHTS = [
  "Disponível no estoque publicado",
  "Entrega prevista no próximo ciclo",
  "Produto selecionado por produtor local",
  "Compra direta com origem visível",
];

function InsightLine({ product }: { product: Product }) {
  const idx = product.id.charCodeAt(0) % INSIGHTS.length;
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[var(--color-surface-brand-soft)] px-2 py-1 text-[11px] font-medium text-brand-700">
      <Sparkles className="h-3 w-3 text-leaf-700" />
      {INSIGHTS[idx]}
    </p>
  );
}
