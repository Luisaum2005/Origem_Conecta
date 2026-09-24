import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  Share2,
  ShoppingBasket,
  Sprout,
  Star,
  Truck,
} from "@/components/mobile/icons";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { ProductFallback } from "@/components/marketplace/ProductCard";
import { formatQuantity } from "@/lib/format";
import { DataLoadError, DataLoading } from "@/components/system/DataLoadState";
import { useAvailableProductsResource } from "@/lib/available-products";
import { useCart } from "@/lib/cart";
import { preferredProducer } from "@/lib/catalog";
import { formatBRL, initials, unitLabel } from "@/lib/format";
import { useStartNegotiation } from "@/lib/negotiation";
import { getOperationWindow } from "@/lib/operation";

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

const FAVORITES_KEY = "origem-conecta-favorites";

function readFavorites(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(value?: string) {
  const date = parseDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((date.getTime() - today.getTime()) / 864e5));
}

function ProductPage() {
  const { id } = Route.useSearch();
  const router = useRouter();
  const { products, loading, error, reload } = useAvailableProductsResource();
  const product = useMemo(() => products.find((item) => item.id === id), [id, products]);
  const { cart, setQty } = useCart();
  const { negotiating, startNegotiation } = useStartNegotiation();
  const [draft, setDraft] = useState<number | null>(null);
  const [favorite, setFavorite] = useState(false);
  const operation = useMemo(() => getOperationWindow(), []);

  useEffect(() => {
    if (id) setFavorite(readFavorites().includes(id));
  }, [id]);

  if (error || !product) {
    return (
      <div className="m-screen m-s-02-produto m-pad-top">
        {error ? (
          <DataLoadError message={error} onRetry={reload} />
        ) : loading ? (
          <DataLoading label="Carregando produto..." />
        ) : (
          <div className="m-card m-empty">
            <b>Produto não encontrado</b>
            <span>
              <Link to="/portfolio">Voltar ao portfólio</Link>
            </span>
          </div>
        )}
      </div>
    );
  }

  const producer = preferredProducer(product);
  const stock = Math.max(0, producer.stock);
  const inCart = cart[product.id] ?? 0;
  const quantity = draft ?? (inCart > 0 ? inCart : Math.min(1, stock));
  const clamp = (value: number) => Math.max(0, Math.min(stock, Number(value.toFixed(2))));
  const harvest = parseDate(product.harvestDate);
  const validity = daysUntil(product.expiryDate);
  const responsible = producer.name.split(" ").slice(0, 2).join(" ");
  const weekday = operation.delivery.toLocaleDateString("pt-BR", { weekday: "short" });

  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else void router.navigate({ to: "/portfolio" });
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link do produto copiado");
      }
    } catch {
      /* compartilhamento cancelado */
    }
  };

  const toggleFavorite = () => {
    const current = readFavorites();
    const next = current.includes(product.id)
      ? current.filter((item) => item !== product.id)
      : [...current, product.id];
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    setFavorite(next.includes(product.id));
  };

  const addToList = () => {
    if (quantity <= 0) {
      toast.error("Informe uma quantidade maior que zero.");
      return;
    }
    setQty(product.id, clamp(quantity));
    setDraft(null);
    toast.success(
      <span>
        <b>
          {formatQuantity(quantity)} {unitLabel(product.unit, quantity)}
        </b>{" "}
        de {product.name.split(" ")[0].toLowerCase()} na lista
      </span>,
      { action: { label: "Desfazer", onClick: () => setQty(product.id, inCart) } },
    );
  };

  return (
    <div className="m-screen m-s-02-produto">
      <div className="m-photo">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} />
        ) : (
          <ProductFallback category={product.category} name={product.name} label={false} />
        )}
        <div className="m-veil" />
      </div>
      <div className="m-top">
        <div className="m-status" />
        <div className="m-bar">
          <button type="button" className="m-round m-glass" onClick={goBack} aria-label="Voltar">
            <ArrowLeft className="lucide" aria-hidden />
          </button>
          <span style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="m-round m-glass"
              onClick={() => void share()}
              aria-label="Compartilhar produto"
            >
              <Share2 className="lucide" aria-hidden />
            </button>
            <button
              type="button"
              className={`m-round m-glass${favorite ? " m-fav" : ""}`}
              onClick={toggleFavorite}
              aria-pressed={favorite}
              aria-label={favorite ? "Remover dos favoritos" : "Favoritar produto"}
            >
              <Heart className="lucide" aria-hidden />
            </button>
          </span>
        </div>
        {harvest && (
          <div style={{ padding: "176px 20px 0" }}>
            <span className="m-chip m-white">
              <Sprout className="lucide" aria-hidden />
              Colhida em {harvest.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
            </span>
          </div>
        )}
      </div>

      <section className="m-sheet">
        <span className="m-eyebrow">{product.category}</span>
        <h1>{product.name}</h1>
        {product.description && <p className="m-desc">{product.description}</p>}
        <div className="m-specs m-card">
          <div>
            <span>Preço/{product.unit}</span>
            <b>{formatBRL(producer.price)}</b>
          </div>
          <div>
            <span>Estoque</span>
            <b>
              {formatQuantity(stock)} <small>{unitLabel(product.unit, stock)}</small>
            </b>
          </div>
          <div>
            <span>Entrega</span>
            <b>{weekday}, 8h</b>
          </div>
          <div>
            <span>Validade</span>
            <b>{validity === null ? "—" : validity === 1 ? "1 dia" : `${validity} dias`}</b>
          </div>
        </div>
        <div className="m-prod m-card">
          <span className="m-avatar">{initials(producer.property)}</span>
          <div>
            <b>
              {producer.property}
              {producer.commercialVerificationStatus === "verified" && (
                <BadgeCheck className="lucide" aria-label="Produtor verificado" />
              )}
            </b>
            <span>
              {responsible} · {producer.origin}
            </span>
            <span className="m-kpis">
              <Truck className="lucide" aria-hidden />
              {producer.onTimeRate}% no prazo
              <Star className="lucide" aria-hidden />
              {producer.reliabilityScore.toLocaleString("pt-BR")}
            </span>
          </div>
        </div>
        <div className="m-links">
          <button
            type="button"
            className="m-btn m-text"
            disabled={negotiating}
            onClick={() => void startNegotiation(product, producer)}
          >
            <MessageCircle className="lucide" aria-hidden />
            {negotiating ? "Abrindo conversa..." : "Conversar com o produtor"}
          </button>
        </div>
      </section>

      {stock > 0 && (
        <div className="m-footer">
          <div className="m-row">
            <div className="m-stepper">
              <button
                type="button"
                onClick={() => setDraft(clamp(quantity - 1))}
                aria-label="Diminuir quantidade"
              >
                <Minus className="lucide" aria-hidden />
              </button>
              <input
                value={formatQuantity(quantity)}
                onChange={(event) => {
                  const parsed = Number(event.target.value.replace(",", "."));
                  if (Number.isFinite(parsed)) setDraft(clamp(parsed));
                }}
                inputMode="decimal"
                aria-label={`Quantidade em ${product.unit}`}
              />
              <button
                type="button"
                onClick={() => setDraft(clamp(quantity + 1))}
                aria-label="Aumentar quantidade"
              >
                <Plus className="lucide" aria-hidden />
              </button>
            </div>
            <span className="m-unit">{unitLabel(product.unit, quantity)}</span>
            <div className="m-tot">
              <span>Total estimado</span>
              <b className="m-price">{formatBRL(quantity * producer.price)}</b>
            </div>
          </div>
          <button type="button" className="m-btn m-primary" onClick={addToList}>
            <ShoppingBasket className="lucide" aria-hidden />
            {inCart > 0 ? "Atualizar na lista" : "Adicionar à lista"}
          </button>
        </div>
      )}
    </div>
  );
}
