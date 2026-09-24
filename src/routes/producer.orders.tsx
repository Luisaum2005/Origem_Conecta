import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Ban,
  CalendarClock,
  Clock3,
  MessageCircle,
  PackageCheck,
  Printer,
  Star,
  Truck,
} from "@/components/mobile/icons";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { NotificationBell } from "@/components/mobile/NotificationBell";
import { Sheet } from "@/components/mobile/Sheet";
import { OrderThumbs, StatusChip } from "@/components/mobile/order-ui";
import { STATUS_PROGRESS } from "@/lib/order-status";
import { DataLoadError, DataLoading } from "@/components/system/DataLoadState";
import { useAuth } from "@/lib/auth";
import { useAvailableProducts } from "@/lib/available-products";
import { formatBRL, formatCompactBRL, initials, relativeDay } from "@/lib/format";
import { getOperationWindow } from "@/lib/operation";
import {
  canCancelOrder,
  formatCancellationDeadline,
  formatDeliveryAddress,
  getProducerId,
  type SavedOrder,
  useOrders,
} from "@/lib/orders";
import { useProducerProfileDetails } from "@/lib/producer-profile";
import { createBuyerRating, readLocalRatings } from "@/lib/ratings";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/producer/orders")({
  component: () => (
    <RequireProfile allowed={["produtor"]}>
      <ProducerOrders />
    </RequireProfile>
  ),
});

const PRODUCER_ID = "produtor";
type Tab = "new" | "doing" | "done";
type Action = { kind: "confirm" | "cancel" | "complete" | "rate"; order: SavedOrder };

const producerTotal = (order: SavedOrder) =>
  order.items.reduce((sum, item) => sum + item.lineTotal, 0);

function getProducerOrders(orders: SavedOrder[], alreadyScoped: boolean, producerId?: string) {
  if (alreadyScoped) return orders.filter((order) => order.items.length > 0);
  const target = producerId || PRODUCER_ID;
  return orders
    .map((order) => ({
      ...order,
      items: order.items.filter(
        (item) => item.producerId === target || item.producerId === "produtor",
      ),
    }))
    .filter((order) => order.items.length > 0);
}

function itemsSummary(order: SavedOrder) {
  const names = [...new Set(order.items.map((item) => item.productName.split(" ")[0]))];
  const label =
    names.length <= 1
      ? (order.items[0]?.productName ?? "")
      : `${names.slice(0, -1).join(", ")} e ${names.at(-1)!.toLowerCase()}`;
  return order.items.length > 1 ? `${label} · ${order.items.length} itens` : label;
}

/** Etiqueta simples do pedido para colar na caixa (abre a impressão do navegador). */
function printLabel(order: SavedOrder, producer: string) {
  const win = window.open("", "_blank", "width=420,height=600");
  if (!win) {
    toast.error("Permita pop-ups para imprimir a etiqueta.");
    return;
  }
  const esc = (value: string) =>
    value.replace(
      /[&<>"]/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!,
    );
  win.document
    .write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiqueta #${esc(order.id)}</title>
<style>body{font-family:Inter,system-ui,sans-serif;margin:24px;color:#143d22}h1{font-size:22px;margin:0 0 4px}p{margin:2px 0;font-size:14px}ul{padding-left:18px;font-size:14px}.b{border:2px dashed #143d22;border-radius:12px;padding:16px}</style></head>
<body><div class="b"><p>Pedido #${esc(order.id)}</p><h1>${esc(order.buyerName)}</h1>
<p>${esc(formatDeliveryAddress(order.deliveryAddress))}</p><p>Entrega: ${esc(order.deliveryEta)}</p>
<ul>${order.items.map((item) => `<li>${esc(item.productName)} — ${item.quantity.toLocaleString("pt-BR")} ${esc(item.unit)}</li>`).join("")}</ul>
<p>De: ${esc(producer)}</p></div><script>window.print()</script></body></html>`);
  win.document.close();
}

function ProducerOrders() {
  const { profile, isSupabaseConfigured } = useAuth();
  const { details } = useProducerProfileDetails();
  const products = useAvailableProducts();
  const {
    orders,
    loading,
    error,
    reload,
    isOrderPending,
    updateStatus,
    confirmDelivery,
    cancelOrder,
    completeDelivery,
  } = useOrders();
  const [tab, setTab] = useState<Tab>("new");
  const [action, setAction] = useState<Action | null>(null);
  const [rated, setRated] = useState<Set<string>>(new Set());
  const operation = useMemo(() => getOperationWindow(), []);

  const producerOrders = getProducerOrders(
    orders,
    Boolean(isSupabaseConfigured && profile?.tipo === "produtor"),
    profile?.id,
  );

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    void (async () => {
      try {
        const producerId = await getProducerId(profile.id);
        if (!producerId) return;
        if (supabase && isSupabaseConfigured) {
          const { data } = await supabase
            .from("buyer_ratings")
            .select("order_id")
            .eq("producer_id", producerId);
          if (active && data)
            setRated(new Set(data.map((row: { order_id: string }) => row.order_id)));
        } else if (active) {
          setRated(
            new Set(
              readLocalRatings()
                .filter((rating) => rating.producerId === producerId)
                .map((rating) => rating.orderId),
            ),
          );
        }
      } catch (err) {
        console.error("Erro ao carregar avaliações feitas:", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [profile, isSupabaseConfigured]);

  const fresh = producerOrders.filter((order) => order.status === "Recebido");
  const doing = producerOrders.filter(
    (order) => order.status === "Em separação" || order.status === "Em entrega",
  );
  const done = producerOrders.filter(
    (order) => order.status === "Entregue" || order.status === "Cancelado",
  );
  const now = new Date();
  const monthRevenue = producerOrders
    .filter((order) => {
      const date = new Date(order.createdAt);
      return (
        order.status !== "Cancelado" &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, order) => sum + producerTotal(order), 0);
  const visible = tab === "new" ? fresh : tab === "doing" ? doing : done;

  const firstName = (details.responsibleName || profile?.nome || "").split(" ")[0];
  const place = [details.propertyName, details.location].filter(Boolean).join(" · ");
  const weekday = (date: Date) => date.toLocaleDateString("pt-BR", { weekday: "short" });

  const ship = async (order: SavedOrder) => {
    try {
      await updateStatus(order.id, "Em entrega");
      toast.success("Pedido marcado como saiu para entrega");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o pedido.");
    }
  };

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-p1-negociacoes">
        <div className="m-status" />
        <div className="m-hd">
          <Link to="/profile/producer" className="m-avatar" aria-label="Abrir perfil">
            {initials(details.propertyName || profile?.nome) || "?"}
          </Link>
          <div className="m-who">
            <b>Olá, {firstName}</b>
            <span>{place || "Complete seu perfil"}</span>
          </div>
          <NotificationBell />
        </div>

        <div className="m-kpi">
          <div className="m-card">
            <span>Novas</span>
            <b>{fresh.length}</b>
          </div>
          <div className="m-card">
            <span>Em andamento</span>
            <b>{doing.length}</b>
          </div>
          <div className="m-card">
            <span>Receita do mês</span>
            <b>{formatCompactBRL(monthRevenue)}</b>
          </div>
        </div>

        <div style={{ padding: "14px 20px 0" }}>
          <div className="m-seg" role="tablist">
            {(
              [
                ["new", "Novas", fresh.length],
                ["doing", "Andamento", doing.length],
                ["done", "Entregues", 0],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? "m-on" : undefined}
                onClick={() => setTab(key)}
              >
                {label} {count > 0 && <span>{count}</span>}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="m-pad">
            <DataLoadError message={error} onRetry={reload} />
          </div>
        ) : loading && producerOrders.length === 0 ? (
          <div className="m-pad">
            <DataLoading label="Carregando negociações..." />
          </div>
        ) : visible.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>
                {tab === "new"
                  ? "Nenhuma solicitação nova"
                  : tab === "doing"
                    ? "Nada em andamento"
                    : "Nenhuma entrega concluída"}
              </b>
              <span>Mantenha o estoque em dia para aparecer no portfólio dos compradores.</span>
            </div>
          </div>
        ) : (
          <div className="m-list">
            {visible.map((order) => {
              const pending = isOrderPending(order.id);
              const chat = {
                orderId: order.id,
                buyerId: order.buyerId,
                producerId: order.items[0]?.producerId,
              };
              return (
                <div key={order.id} className="m-oc m-card">
                  <div className="m-t">
                    <StatusChip
                      status={order.status}
                      label={order.status === "Recebido" ? "Nova" : undefined}
                    />
                    <span className="m-muted">
                      #{order.id} · {relativeDay(order.createdAt)}
                    </span>
                  </div>
                  <div className="m-b">
                    <OrderThumbs order={order} products={products} />
                    <div className="m-nm">
                      <b>{order.buyerName}</b>
                      <span>{itemsSummary(order)}</span>
                    </div>
                    <span className="m-price">{formatBRL(producerTotal(order))}</span>
                  </div>
                  {order.status !== "Cancelado" && (
                    <div className="m-prog">
                      <i
                        style={{
                          width: `${order.status === "Recebido" ? 10 : order.status === "Em separação" ? 50 : STATUS_PROGRESS[order.status]}%`,
                        }}
                      />
                    </div>
                  )}
                  {order.status === "Recebido" && (
                    <div className="m-dl">
                      <Clock3 className="lucide" aria-hidden />
                      Confirme até {weekday(operation.cutoff)}, 18h — entrega{" "}
                      {weekday(operation.delivery)}, 8h
                    </div>
                  )}
                  <div className="m-acts">
                    {order.status === "Recebido" && (
                      <>
                        <Link to="/chat" search={chat} className="m-btn m-text m-sm">
                          <MessageCircle className="lucide" aria-hidden />
                          Conversar
                        </Link>
                        {canCancelOrder(order) && (
                          <button
                            type="button"
                            className="m-btn m-secondary m-sm"
                            disabled={pending}
                            onClick={() => setAction({ kind: "cancel", order })}
                          >
                            Recusar
                          </button>
                        )}
                        <button
                          type="button"
                          className="m-btn m-primary m-sm"
                          disabled={pending}
                          onClick={() => setAction({ kind: "confirm", order })}
                        >
                          Confirmar
                        </button>
                      </>
                    )}
                    {order.status === "Em separação" && (
                      <>
                        <button
                          type="button"
                          className="m-btn m-text m-sm"
                          onClick={() =>
                            printLabel(order, details.propertyName || profile?.nome || "")
                          }
                        >
                          <Printer className="lucide" aria-hidden />
                          Etiqueta
                        </button>
                        <button
                          type="button"
                          className="m-btn m-primary m-sm"
                          disabled={pending}
                          onClick={() => void ship(order)}
                        >
                          <Truck className="lucide" aria-hidden />
                          {pending ? "Atualizando..." : "Saiu para entrega"}
                        </button>
                      </>
                    )}
                    {order.status === "Em entrega" && (
                      <>
                        <Link to="/chat" search={chat} className="m-btn m-text m-sm">
                          <MessageCircle className="lucide" aria-hidden />
                          Conversar
                        </Link>
                        <button
                          type="button"
                          className="m-btn m-primary m-sm"
                          disabled={pending}
                          onClick={() => setAction({ kind: "complete", order })}
                        >
                          <PackageCheck className="lucide" aria-hidden />
                          Concluir entrega
                        </button>
                      </>
                    )}
                    {order.status === "Entregue" &&
                      (rated.has(order.id) ? (
                        <span className="m-chip m-st-entregue">Comprador avaliado</span>
                      ) : (
                        <button
                          type="button"
                          className="m-btn m-secondary m-sm"
                          onClick={() => setAction({ kind: "rate", order })}
                        >
                          <Star className="lucide" aria-hidden />
                          Avaliar comprador
                        </button>
                      ))}
                    {order.status === "Cancelado" && (
                      <span className="m-muted m-cancel-note">
                        <Ban className="lucide" aria-hidden />
                        {order.cancellationReason ?? "Cancelado"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <OrderActionSheet
        action={action}
        onClose={() => setAction(null)}
        operation={operation}
        pending={action ? isOrderPending(action.order.id) : false}
        onConfirm={async (order, deliveryAt) => {
          await confirmDelivery(order.id, deliveryAt);
          toast.success("Pedido confirmado. Agora é separar.");
        }}
        onCancel={async (order, reason) => {
          await cancelOrder(order.id, "produtor", reason);
          toast.success("Solicitação recusada");
        }}
        onComplete={async (order, code) => {
          await completeDelivery(order.id, code);
          toast.success("Entrega concluída");
        }}
        onRate={async (order, rating, comment) => {
          if (!order.buyerId) throw new Error("Comprador não identificado neste pedido.");
          const producerId = await getProducerId(profile?.id || "");
          if (!producerId) throw new Error("Cadastro de produtor não encontrado.");
          await createBuyerRating({
            orderId: order.id,
            buyerId: order.buyerId,
            producerId,
            rating,
            comment: comment || undefined,
          });
          setRated((current) => new Set(current).add(order.id));
          toast.success("Avaliação enviada");
        }}
      />
    </>
  );
}

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function OrderActionSheet({
  action,
  onClose,
  operation,
  pending,
  onConfirm,
  onCancel,
  onComplete,
  onRate,
}: {
  action: Action | null;
  onClose: () => void;
  operation: ReturnType<typeof getOperationWindow>;
  pending: boolean;
  onConfirm: (order: SavedOrder, deliveryAt: string) => Promise<void>;
  onCancel: (order: SavedOrder, reason: string) => Promise<void>;
  onComplete: (order: SavedOrder, code: string) => Promise<void>;
  onRate: (order: SavedOrder, rating: number, comment: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [rating, setRating] = useState(5);
  const [error, setError] = useState("");
  useEffect(() => {
    setError("");
    setRating(5);
    setValue(action?.kind === "confirm" ? toLocalInput(operation.delivery) : "");
  }, [action, operation.delivery]);

  if (!action) return null;
  const { order, kind } = action;
  const hasAddress = Boolean(
    order.deliveryAddress?.addressLine && order.deliveryAddress.city && order.deliveryAddress.state,
  );
  const titles = {
    confirm: "Confirmar pedido",
    cancel: "Recusar solicitação",
    complete: "Concluir entrega",
    rate: "Avaliar comprador",
  };
  const submit = async () => {
    setError("");
    try {
      if (kind === "confirm") {
        if (!hasAddress) throw new Error("O comprador ainda não completou o endereço de entrega.");
        if (!value) throw new Error("Informe a data e a hora da entrega.");
        await onConfirm(order, value);
      } else if (kind === "cancel") {
        if (!value.trim()) throw new Error("Conte ao comprador o motivo.");
        await onCancel(order, value.trim());
      } else if (kind === "complete") {
        if (!value.trim()) throw new Error("Informe o código que o comprador recebeu.");
        await onComplete(order, value.trim());
      } else {
        await onRate(order, rating, value.trim());
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir. Tente de novo.");
    }
  };

  return (
    <Sheet
      open
      title={titles[kind]}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="m-btn m-primary"
          disabled={pending || (kind === "confirm" && !hasAddress)}
          onClick={() => void submit()}
        >
          {kind === "confirm" && <CalendarClock className="lucide" aria-hidden />}
          {pending
            ? "Enviando..."
            : kind === "confirm"
              ? hasAddress
                ? "Confirmar entrega"
                : "Aguardando endereço"
              : kind === "cancel"
                ? "Recusar solicitação"
                : kind === "complete"
                  ? "Concluir entrega"
                  : "Enviar avaliação"}
        </button>
      }
    >
      <div className="m-subcard">
        <div className="m-subcard-hd">
          <span>
            #{order.id} · {order.buyerName}
            <small className="m-sub2">
              {order.items
                .map(
                  (item) =>
                    `${item.productName} ${item.quantity.toLocaleString("pt-BR")} ${item.unit}`,
                )
                .join(" · ")}
            </small>
          </span>
        </div>
      </div>
      {kind === "confirm" && (
        <>
          <label className="m-field">
            <span>Data e hora da entrega</span>
            <div className="m-in">
              <input
                type="datetime-local"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
          </label>
          <p className="m-note">
            Endereço: {formatDeliveryAddress(order.deliveryAddress)}
            {!hasAddress && " — peça ao comprador que complete o endereço (use Conversar)."}
          </p>
        </>
      )}
      {kind === "cancel" && (
        <label className="m-field">
          <span>Motivo (até {formatCancellationDeadline(order)})</span>
          <textarea
            className="m-textarea"
            rows={3}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Ex.: sem estoque suficiente para a data"
          />
        </label>
      )}
      {kind === "complete" && (
        <label className="m-field">
          <span>Código do comprador</span>
          <div className="m-in">
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              inputMode="numeric"
              placeholder="4 dígitos"
              maxLength={8}
            />
          </div>
        </label>
      )}
      {kind === "rate" && (
        <>
          <div className="m-field">
            <span>Nota</span>
            <div className="m-opts" role="radiogroup" aria-label="Nota do comprador">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`${star} de 5`}
                  className={`m-pill${star <= rating ? " m-sel" : ""}`}
                  onClick={() => setRating(star)}
                >
                  <Star className="lucide" aria-hidden />
                  {star}
                </button>
              ))}
            </div>
          </div>
          <label className="m-field">
            <span>Comentário (opcional)</span>
            <textarea
              className="m-textarea"
              rows={3}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        </>
      )}
      {error && (
        <p className="m-field">
          <small className="m-err">{error}</small>
        </p>
      )}
    </Sheet>
  );
}
