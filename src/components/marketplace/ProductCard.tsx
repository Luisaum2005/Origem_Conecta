import { ChevronLeft, ChevronRight, Info, MapPin, PlayCircle, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
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
  selectedUnit,
  onUnitChange,
}: {
  product: Product;
  qty: number;
  onChange: (qty: number) => void;
  producerChoice?: string;
  onProducerChange?: (producerId: string) => void;
  selectedUnit: string;
  onUnitChange: (unit: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const recommended = preferredProducer(product);
  const selectedProducer =
    product.producers.find((producer) => producer.id === producerChoice) ?? recommended;
  const availableStock = Math.max(0, selectedProducer.stock);

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

  // Smooth decimal input state
  const [inputValue, setInputValue] = useState(qty > 0 ? qty.toString().replace(".", ",") : "");

  useEffect(() => {
    const parsed = Number(inputValue.replace(",", "."));
    if (parsed !== qty) {
      setInputValue(qty > 0 ? qty.toString().replace(".", ",") : "");
    }
  }, [qty]);

  const handleInputChange = (valueStr: string) => {
    setInputValue(valueStr);
    const parsed = Number(valueStr.replace(",", "."));
    if (Number.isFinite(parsed)) {
      updateQuantity(parsed);
    }
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

      <div className="mt-2.5 space-y-1 text-sm text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <span className="font-semibold text-brand-900">Produtor:</span> {selectedProducer.name}
        </p>
        <p className="flex items-center gap-1.5">
          <span className="font-semibold text-brand-900">Propriedade:</span>{" "}
          {selectedProducer.property}
        </p>
        <p className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-leaf-700" />
          <span className="font-semibold text-brand-900">Localização:</span>{" "}
          {selectedProducer.origin}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <button
          type="button"
          onClick={() => {
            alert(
              `Negociação iniciada com o produtor ${selectedProducer.name} para o produto ${product.name}. A integração com o WhatsApp / chat de negociação estará disponível em breve!`,
            );
          }}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-leaf-200 bg-leaf-50 px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500 hover:bg-leaf-100 transition-colors cursor-pointer"
        >
          <MessageSquare className="h-4 w-4 text-leaf-700" />
          Negociar
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

      <div className="mt-5 flex flex-col gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight text-brand-900">
            R$ {selectedProducer.price.toFixed(2)}
            <span className="ml-1 text-sm font-medium text-muted-foreground">/{selectedUnit}</span>
          </p>
        </div>

        {availableStock <= 0 ? (
          <div className="text-center py-2.5 rounded-xl bg-secondary text-sm font-semibold text-muted-foreground">
            Indisponível no momento
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex w-full items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(event) => handleInputChange(event.target.value)}
                  placeholder="Quantidade"
                  inputMode="decimal"
                  className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold text-brand-900 focus:border-leaf-600 focus:outline-none"
                  aria-label={`Quantidade de ${product.name}`}
                />
              </div>
              <select
                value={selectedUnit}
                onChange={(event) => onUnitChange(event.target.value)}
                className="h-11 w-28 rounded-xl border border-border bg-white px-2 text-center text-sm font-semibold text-brand-900 focus:border-leaf-600 focus:outline-none"
              >
                <option value="kg">kg</option>
                <option value="caixa">caixa</option>
                <option value="unidade">unid</option>
                <option value="cacho">cacho</option>
                <option value="pote">pote</option>
                <option value="pacote">pacote</option>
                <option value="saco">saco</option>
              </select>
            </div>

            {qty > 0 && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 border border-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-800">
                  <span className="inline-block h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                  {inputValue || "0"} {selectedUnit} = 1 item no pedido
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
