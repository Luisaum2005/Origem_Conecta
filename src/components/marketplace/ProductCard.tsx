import {
  Apple,
  Carrot,
  ChevronLeft,
  ChevronRight,
  Egg,
  Leaf,
  MessageSquare,
  Minus,
  Package,
  PlayCircle,
  Plus,
  Sprout,
} from "lucide-react";
import { useState, useEffect } from "react";
import { preferredProducer, type Product } from "@/lib/catalog";
import { useStartNegotiation } from "@/lib/negotiation";
import { Link } from "@tanstack/react-router";
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

function formatPrice(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Ícone da categoria usado quando o produtor ainda não enviou foto. */
export function CategoryIcon({ category, name: productName }: { category: string; name: string }) {
  const name = `${category} ${productName}`.toLowerCase();
  const Icon = /folh|verdura|alface|cheiro|couve|rúcula|salsa/.test(name)
    ? Leaf
    : /legum|hortali|cenoura|abóbora|tomate|pepino/.test(name)
      ? Carrot
      : /frut|banana|laranja|manga|mamão/.test(name)
        ? Apple
        : /raiz|raíz|tubér|mandioca|macaxeira|batata/.test(name)
          ? Sprout
          : /ovo/.test(name)
            ? Egg
            : Package;
  return <Icon className="h-10 w-10 text-brand-600" strokeWidth={1.4} aria-hidden />;
}

export function ProductCard({
  product,
  qty,
  onChange,
}: {
  product: Product;
  qty: number;
  onChange: (qty: number) => void;
}) {
  const [mediaIndex, setMediaIndex] = useState(0);
  const selectedProducer = preferredProducer(product);
  const availableStock = Math.max(0, selectedProducer.stock);
  const step = Math.min(1, availableStock);

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
  useEffect(() => {
    setInputValue(qty > 0 ? qty.toString().replace(".", ",") : "");
  }, [qty]);

  const commit = (next: number) => {
    const confirmedQuantity = clampQuantity(next, availableStock);
    onChange(confirmedQuantity);
    return confirmedQuantity;
  };

  const handleFirstAdd = () => {
    const added = commit(step);
    toast.success(`${formatQuantity(added)} ${product.unit} de ${product.name} na lista`, {
      action: { label: "Desfazer", onClick: () => onChange(0) },
    });
  };

  const handleInputCommit = () => {
    const requestedQuantity = parseQuantity(inputValue);
    if (requestedQuantity > availableStock) {
      toast.error(
        `A quantidade máxima disponível é ${formatQuantity(availableStock)} ${product.unit}.`,
      );
    }
    commit(requestedQuantity);
  };

  const { negotiating, startNegotiation } = useStartNegotiation();
  const handleNegotiate = () => startNegotiation(product, selectedProducer);

  return (
    <article className="surface-card group flex flex-col p-1.5 transition-transform hover:-translate-y-0.5">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[15px] [background:linear-gradient(160deg,#eef8e2_0%,#d9eec4_100%)]">
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
          <CategoryIcon category={product.category} name={product.name} />
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
          </>
        )}
        {product.videoUrl && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand-900">
            <PlayCircle className="h-3.5 w-3.5 text-leaf-700" />
            vídeo
          </span>
        )}

        {availableStock <= 0 ? (
          <span className="absolute inset-x-2 bottom-2 rounded-full bg-white/95 py-2 text-center text-xs font-semibold text-muted-foreground">
            Indisponível no momento
          </span>
        ) : qty > 0 ? (
          <div className="absolute inset-x-1.5 bottom-1.5 flex h-10 items-center justify-between rounded-full bg-white/95 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => commit(qty - step)}
              className="grid h-8 w-8 place-items-center rounded-full bg-surface-brand-soft text-brand-900"
              aria-label={`Diminuir ${product.name}`}
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onBlur={handleInputCommit}
              onKeyDown={(event) => event.key === "Enter" && handleInputCommit()}
              inputMode="decimal"
              className="w-12 min-w-0 bg-transparent text-center text-sm font-semibold text-brand-900 focus:outline-none"
              aria-label={`Quantidade de ${product.name} em ${product.unit}`}
            />
            <button
              type="button"
              onClick={() => commit(qty + step)}
              className="cta-primary grid h-8 w-8 place-items-center rounded-full"
              aria-label={`Aumentar ${product.name}`}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleFirstAdd}
            className="cta-primary absolute bottom-2 right-2 grid h-10 w-10 place-items-center rounded-full"
            aria-label={`Adicionar ${product.name} à lista`}
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2 pt-3">
        <h3 className="text-[15px] font-semibold leading-snug text-brand-900">
          <Link to="/product" search={{ id: product.id }} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {selectedProducer.property} · {selectedProducer.origin}
        </p>
        {selectedProducer.sellerOrganizationName && (
          <span className="mt-1.5 inline-flex w-fit rounded-full bg-leaf-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
            Pela {selectedProducer.sellerOrganizationName}
          </span>
        )}
        <p className="mt-auto pt-2 text-base font-bold tracking-tight text-brand-900">
          {formatPrice(selectedProducer.price)}
          <span className="ml-1 text-xs font-medium text-muted-foreground">/{product.unit}</span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          {formatQuantity(availableStock)} {product.unit} disponíveis
        </p>
        <button
          type="button"
          disabled={negotiating}
          onClick={() => void handleNegotiate()}
          className="mt-2 inline-flex h-9 items-center gap-1.5 self-start rounded-full px-1 text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50"
        >
          <MessageSquare className="h-4 w-4" />
          {negotiating ? "Iniciando..." : "Negociar"}
        </button>
      </div>
    </article>
  );
}
