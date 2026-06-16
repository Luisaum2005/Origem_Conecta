import {
  ChevronLeft,
  ChevronRight,
  Info,
  MapPin,
  Minus,
  PlayCircle,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { preferredProducer, type Product } from "@/lib/catalog";

function formatQuantity(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function parseQuantity(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampQuantity(value: number, max: number) {
  return Math.max(0, Math.min(max, Number(value.toFixed(2))));
}

function StockBadge({ product }: { product: Product }) {
  const stock = product.producers.reduce((sum, producer) => sum + producer.stock, 0);
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-success-bg)] px-3 py-1 text-[12px] font-semibold tracking-wide text-[var(--color-success-fg)]">
      Disponível: {formatQuantity(stock)} {product.unit}
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
  const [mediaIndex, setMediaIndex] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const recommended = preferredProducer(product);
  const selectedProducer =
    product.producers.find((producer) => producer.id === producerChoice) ?? recommended;
  const availableStock = Math.max(0, selectedProducer.stock);
  const canIncrease = qty < availableStock;
  const media = [
    product.imageUrl ? { type: "image" as const, url: product.imageUrl } : null,
    product.videoUrl ? { type: "video" as const, url: product.videoUrl } : null,
  ].filter(Boolean) as Array<{ type: "image" | "video"; url: string }>;
  const currentMedia = media[mediaIndex] ?? null;

  const updateQuantity = (value: number) => onChange(clampQuantity(value, availableStock));
  const changeMedia = (direction: number) => {
    if (media.length <= 1) return;
    setMediaIndex((current) => (current + direction + media.length) % media.length);
  };

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
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-[var(--color-surface-brand-soft)] text-7xl">
        {currentMedia?.type === "image" ? (
          <img src={currentMedia.url} alt={product.name} className="h-full w-full object-cover" />
        ) : currentMedia?.type === "video" ? (
          <video
            src={currentMedia.url}
            controls
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          product.emoji
        )}
        {media.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => changeMedia(-1)}
              className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-900 shadow-sm"
              aria-label="Mídia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => changeMedia(1)}
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-900 shadow-sm"
              aria-label="Próxima mídia"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
              {media.map((item, index) => (
                <span
                  key={`${item.type}-${item.url}`}
                  className={`h-1.5 w-5 rounded-full ${
                    index === mediaIndex ? "bg-white" : "bg-white/45"
                  }`}
                />
              ))}
            </div>
          </>
        )}
        {product.videoUrl && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand-900">
            <PlayCircle className="h-3.5 w-3.5 text-leaf-700" />
            vídeo
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            {product.category} · vendido por {product.unit}
          </p>
          <h3 className="mt-1 text-lg font-semibold leading-snug text-brand-900">{product.name}</h3>
        </div>
        <StockBadge product={product} />
      </div>

      <p className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        Produtor: {selectedProducer.name} · {selectedProducer.origin}
      </p>

      <div className="mt-4 space-y-3">
        <button
          type="button"
          onClick={() => setProfileOpen((current) => !current)}
          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
          aria-expanded={profileOpen}
        >
          <Info className="h-4 w-4 text-leaf-700" />
          {profileOpen ? "Ocultar produtor" : "Ver produtor"}
        </button>

        {product.producers.length > 1 && (
          <select
            value={producerChoice ?? ""}
            onChange={(event) => onProducerChange?.(event.target.value)}
            className="mt-3 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
          >
            <option value="">Escolha automática recomendada</option>
            {product.producers.map((producer) => (
              <option key={producer.id} value={producer.id}>
                {producer.name} · R$ {producer.price.toFixed(2)} · {formatQuantity(producer.stock)}{" "}
                {product.unit}
              </option>
            ))}
          </select>
        )}
      </div>

      {profileOpen && (
        <ProducerProfilePreview product={product} producer={selectedProducer} />
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight text-brand-900">
            R$ {selectedProducer.price.toFixed(2)}
            <span className="ml-1 text-sm font-medium text-muted-foreground">/{product.unit}</span>
          </p>
        </div>
        {qty === 0 ? (
          <button
            onClick={() => updateQuantity(Math.min(1, availableStock))}
            disabled={availableStock <= 0}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-900 px-5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {availableStock <= 0 ? "Indisponível" : "Adicionar"}
          </button>
        ) : (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              onClick={() => updateQuantity(qty - 1)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-white text-brand-900 hover:bg-secondary"
              aria-label="Diminuir"
            >
              <Minus className="h-4 w-4" />
            </button>
            <label className="min-w-0 flex-1 sm:w-28 sm:flex-none">
              <span className="sr-only">Quantidade em {product.unit}</span>
              <input
                value={formatQuantity(qty)}
                onChange={(event) => updateQuantity(parseQuantity(event.target.value))}
                inputMode="decimal"
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-center text-sm font-semibold text-brand-900 focus:border-leaf-600 focus:outline-none"
                aria-label={`Quantidade de ${product.name} em ${product.unit}`}
              />
            </label>
            <button
              onClick={() => updateQuantity(qty + 1)}
              disabled={!canIncrease}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-white text-brand-900 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
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

function ProducerProfilePreview({
  product,
  producer,
}: {
  product: Product;
  producer: Product["producers"][number];
}) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
            Perfil do produtor
          </p>
          <h4 className="mt-1 text-base font-bold text-brand-900">{producer.name}</h4>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {producer.origin}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Produtos publicados
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-leaf-100 px-3 py-1 text-xs font-semibold text-brand-900">
            {product.name}
          </span>
        </div>
      </div>
    </div>
  );
}
