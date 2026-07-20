import {
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  PlayCircle,
  MessageSquare,
  ShoppingCart,
} from "lucide-react";
import { useState, useEffect } from "react";
import { preferredProducer, type Product } from "@/lib/catalog";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { getOrCreateConversation } from "@/lib/chats";
import { getBuyerId } from "@/lib/orders";
import { toast } from "sonner";

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
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [negotiating, setNegotiating] = useState(false);
  const [added, setAdded] = useState(false);

  const recommended = preferredProducer(product);
  const selectedProducer =
    product.producers.find((producer) => producer.id === producerChoice) ?? recommended;
  const availableStock = Math.max(0, selectedProducer.stock);

  const media = [
    product.imageUrl ? { type: "image" as const, url: product.imageUrl } : null,
    product.videoUrl ? { type: "video" as const, url: product.videoUrl } : null,
  ].filter(Boolean) as Array<{ type: "image" | "video"; url: string }>;
  const currentMedia = media[mediaIndex] ?? null;

  const changeMedia = (direction: number) => {
    if (media.length <= 1) return;
    setMediaIndex((current) => (current + direction + media.length) % media.length);
  };

  // Smooth decimal input state
  const [inputValue, setInputValue] = useState(qty > 0 ? qty.toString().replace(".", ",") : "");
  const [draftUnit, setDraftUnit] = useState(selectedUnit);

  useEffect(() => {
    setInputValue(qty > 0 ? qty.toString().replace(".", ",") : "");
  }, [qty]);

  useEffect(() => {
    setDraftUnit(selectedUnit);
  }, [selectedUnit]);

  const handleInputChange = (valueStr: string) => {
    setInputValue(valueStr);
    setAdded(false);
  };

  const handleAdd = () => {
    const requestedQuantity = parseQuantity(inputValue);
    if (requestedQuantity <= 0) {
      toast.error("Informe uma quantidade maior que zero.");
      return;
    }
    if (requestedQuantity > availableStock) {
      toast.error(
        `A quantidade máxima disponível é ${formatQuantity(availableStock)} ${product.unit}.`,
      );
      return;
    }
    const confirmedQuantity = clampQuantity(requestedQuantity, availableStock);
    onUnitChange(draftUnit);
    onChange(confirmedQuantity);
    setInputValue(String(confirmedQuantity).replace(".", ","));
    setAdded(true);
    toast.success(`${product.name} adicionado à lista de interesse.`);
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
        {selectedProducer.sellerOrganizationName && (
          <p className="rounded-lg bg-leaf-100 px-3 py-2 text-xs font-semibold text-brand-900">
            Comercialização por {selectedProducer.sellerOrganizationName}
          </p>
        )}
        {!selectedProducer.sellerOrganizationName && (
          <p className="rounded-lg bg-canvas px-3 py-2 text-xs font-semibold text-brand-900">
            {selectedProducer.commercializationMode === "own"
              ? "Negociação em nome próprio"
              : selectedProducer.commercializationMode === "organization"
                ? "Vínculo comercial com organização ainda não confirmado"
                : "Forma de comercialização ainda não informada"}
          </p>
        )}
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
          disabled={negotiating}
          onClick={() => {
            const handleNegotiate = async () => {
              if (!profile) {
                toast.error("Você precisa estar logado para negociar.");
                void navigate({ to: "/login" });
                return;
              }
              if (profile.tipo !== "comprador") {
                toast.error("Apenas compradores podem negociar produtos do portfólio.");
                return;
              }

              setNegotiating(true);
              try {
                const buyerId = await getBuyerId(profile.id);
                if (!buyerId) {
                  throw new Error("Cadastro de comprador não encontrado.");
                }

                const conv = await getOrCreateConversation({
                  portfolioProductId: product.id,
                  buyerId,
                  producerId: selectedProducer.id,
                  systemMessageOnCreate: `Você iniciou uma negociação sobre o anúncio ${product.name}.`,
                  senderId: profile.id,
                });

                void navigate({
                  to: "/chat",
                  search: { id: conv.id },
                });
              } catch (err) {
                console.error("Erro ao iniciar negociação:", err);
                toast.error(err instanceof Error ? err.message : "Erro ao iniciar negociação.");
              } finally {
                setNegotiating(false);
              }
            };
            void handleNegotiate();
          }}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-leaf-200 bg-leaf-50 px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500 hover:bg-leaf-100 transition-colors cursor-pointer disabled:opacity-50"
        >
          <MessageSquare className="h-4 w-4 text-leaf-700" />
          {negotiating ? "Iniciando..." : "Negociar"}
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
            <span className="ml-1 text-sm font-medium text-muted-foreground">/{draftUnit}</span>
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
                value={draftUnit}
                onChange={(event) => {
                  setDraftUnit(event.target.value);
                  setAdded(false);
                }}
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

            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-leaf-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-leaf-700 focus:outline-none focus:ring-2 focus:ring-leaf-300 focus:ring-offset-2"
            >
              {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
              {added ? "Adicionado" : qty > 0 ? "Atualizar interesse" : "Adicionar à lista"}
            </button>

            {qty > 0 && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 border border-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-800">
                  <span className="inline-block h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                  {formatQuantity(qty)} {selectedUnit} na lista de interesse
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
