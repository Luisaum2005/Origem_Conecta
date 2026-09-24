import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  MessageCircle,
  Repeat,
  Search,
  ShoppingBasket,
  Star,
  Truck,
  X,
} from "@/components/mobile/icons";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { OrderThumbs, StatusChip } from "@/components/mobile/order-ui";
import {
  STATUS_PROGRESS,
  arrivalLabel,
  orderItemsLabel,
  orderProducersLabel,
} from "@/lib/order-status";
import { DataLoadError, DataLoading } from "@/components/system/DataLoadState";
import { useAvailableProducts } from "@/lib/available-products";
import { useCart } from "@/lib/cart";
import { formatBRL, formatCompactBRL, relativeDay } from "@/lib/format";
import { type SavedOrder, useOrders } from "@/lib/orders";

export const Route = createFileRoute("/orders")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Orders />
    </RequireProfile>
  ),
});

function Orders() {
  const { orders, loading, error, reload } = useOrders();
  const products = useAvailableProducts();
  const { replaceCart } = useCart();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"open" | "done">("open");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const notice = window.sessionStorage.getItem("origem-conecta-order-success");
    if (!notice) return;
    toast.success(notice);
    window.sessionStorage.removeItem("origem-conecta-order-success");
  }, []);

  const open = orders.filter(
    (order) => order.status !== "Entregue" && order.status !== "Cancelado",
  );
  const delivered = orders.filter((order) => order.status === "Entregue");
  const closed = orders.filter(
    (order) => order.status === "Entregue" || order.status === "Cancelado",
  );
  const bought = orders
    .filter((order) => order.status !== "Cancelado")
    .reduce((sum, order) => sum + order.total, 0);

  const visible = useMemo(() => {
    const list = tab === "open" ? open : closed;
    const term = query.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (order) =>
        order.id.toLowerCase().includes(term) ||
        order.items.some(
          (item) =>
            item.productName.toLowerCase().includes(term) ||
            item.producerName.toLowerCase().includes(term),
        ),
    );
  }, [closed, open, query, tab]);

  const repeatOrder = (order: SavedOrder) => {
    const available = new Set(products.map((product) => product.id));
    const nextCart: Record<string, number> = {};
    const producerChoices: Record<string, string> = {};
    for (const item of order.items) {
      if (!available.has(item.productId)) continue;
      nextCart[item.productId] = item.quantity;
      if (item.manualProducerChoice) producerChoices[item.productId] = item.producerId;
    }
    if (!Object.keys(nextCart).length) {
      toast.error("Nenhum item deste pedido está disponível no estoque atual.");
      return;
    }
    replaceCart(nextCart, producerChoices);
    toast.success("Pedido anterior carregado para revisão.");
    void navigate({ to: "/order" });
  };

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-04-solicitacoes">
        <div className="m-status" />
        <div className="m-hd m-big">
          <h1>Solicitações</h1>
          <button
            type="button"
            className="m-round"
            aria-label={searching ? "Fechar busca" : "Buscar solicitação"}
            aria-expanded={searching}
            onClick={() => {
              setSearching((current) => !current);
              setQuery("");
            }}
          >
            {searching ? (
              <X className="lucide" aria-hidden />
            ) : (
              <Search className="lucide" aria-hidden />
            )}
          </button>
        </div>
        {searching && (
          <div style={{ padding: "14px 20px 0" }}>
            <label className="m-search">
              <Search className="lucide" aria-hidden />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por produto ou número"
                aria-label="Buscar solicitação"
              />
            </label>
          </div>
        )}

        <div className="m-kpi">
          <div className="m-card">
            <span>Andamento</span>
            <b>{open.length}</b>
          </div>
          <div className="m-card">
            <span>Entregues</span>
            <b>{delivered.length}</b>
          </div>
          <div className="m-card">
            <span>Comprado</span>
            <b>{formatCompactBRL(bought)}</b>
          </div>
        </div>

        <div style={{ padding: "14px 20px 0" }}>
          <div className="m-seg" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "open"}
              className={tab === "open" ? "m-on" : undefined}
              onClick={() => setTab("open")}
            >
              Em andamento <span>{open.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "done"}
              className={tab === "done" ? "m-on" : undefined}
              onClick={() => setTab("done")}
            >
              Entregues <span>{closed.length}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="m-pad">
            <DataLoadError message={error} onRetry={reload} />
          </div>
        )}

        {loading && orders.length === 0 ? (
          <div className="m-pad">
            <DataLoading label="Carregando suas solicitações..." />
          </div>
        ) : visible.length === 0 && !error ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>
                {query
                  ? "Nada encontrado"
                  : tab === "open"
                    ? "Nenhuma solicitação em andamento"
                    : "Nenhuma entrega concluída"}
              </b>
              <span>
                {query
                  ? "Tente outro produto ou número de pedido."
                  : "Monte sua lista no portfólio e envie para os produtores."}
              </span>
              {!query && (
                <Link to="/portfolio" className="m-btn m-secondary m-sm" style={{ marginTop: 16 }}>
                  <ShoppingBasket className="lucide" aria-hidden />
                  Ver portfólio
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="m-list">
            {visible.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                products={products}
                onRepeat={() => repeatOrder(order)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function OrderCard({
  order,
  products,
  onRepeat,
}: {
  order: SavedOrder;
  products: ReturnType<typeof useAvailableProducts>;
  onRepeat: () => void;
}) {
  const firstItem = order.items[0];
  return (
    <div className="m-oc m-card">
      <div className="m-t">
        <StatusChip status={order.status} />
        <span className="m-muted">
          #{order.id} · {relativeDay(order.createdAt)}
        </span>
      </div>
      <div className="m-b">
        <OrderThumbs order={order} products={products} />
        <div className="m-nm">
          <b>{orderItemsLabel(order)}</b>
          <span>{orderProducersLabel(order)}</span>
        </div>
        <span className="m-price">{formatBRL(order.total)}</span>
      </div>
      {order.status !== "Cancelado" && (
        <div className="m-prog">
          <i style={{ width: `${STATUS_PROGRESS[order.status]}%` }} />
        </div>
      )}
      <div className="m-acts">
        {order.status === "Em entrega" ? (
          <>
            <span className="m-eta">
              <Truck className="lucide" aria-hidden />
              {arrivalLabel(order)}
            </span>
            <Link to="/tracking" search={{ id: order.id }} className="m-btn m-primary m-sm">
              Acompanhar
            </Link>
          </>
        ) : order.status === "Entregue" || order.status === "Cancelado" ? (
          <>
            <button type="button" className="m-btn m-text m-sm" onClick={onRepeat}>
              <Repeat className="lucide" aria-hidden />
              Repetir
            </button>
            {order.status === "Entregue" ? (
              <Link to="/rating" search={{ id: order.id }} className="m-btn m-secondary m-sm">
                <Star className="lucide" aria-hidden />
                Avaliar
              </Link>
            ) : (
              <Link to="/tracking" search={{ id: order.id }} className="m-btn m-secondary m-sm">
                Ver detalhes
              </Link>
            )}
          </>
        ) : (
          <>
            {firstItem && (
              <Link
                to="/chat"
                search={{ orderId: order.id, producerId: firstItem.producerId }}
                className="m-btn m-text m-sm"
              >
                <MessageCircle className="lucide" aria-hidden />
                Conversar
              </Link>
            )}
            <Link to="/tracking" search={{ id: order.id }} className="m-btn m-secondary m-sm">
              Ver detalhes
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
