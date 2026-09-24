import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Ban,
  Check,
  Handshake,
  LifeBuoy,
  MessageCircle,
  Package,
  PackageCheck,
  Star,
  TriangleAlert,
  Truck,
} from "@/components/mobile/icons";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { supportHref } from "@/lib/support";
import { Sheet } from "@/components/mobile/Sheet";
import { StatusChip } from "@/components/mobile/order-ui";
import { arrivalLabel, orderItemsLabel, orderProducersLabel } from "@/lib/order-status";
import { DataLoadError, DataLoading } from "@/components/system/DataLoadState";
import { formatQuantity } from "@/lib/format";
import { relativeDay, unitLabel } from "@/lib/format";
import {
  canCancelOrder,
  formatCancellationDeadline,
  type SavedOrder,
  useOrders,
} from "@/lib/orders";

export const Route = createFileRoute("/tracking")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Tracking />
    </RequireProfile>
  ),
});

const stamp = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date().toDateString() === date.toDateString();
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return today
    ? `hoje, ${time}`
    : `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${time}`;
};

type Step = {
  label: string;
  caption: string;
  state: "done" | "now" | "next";
  icon: React.ComponentType<{ className?: string }>;
};

function buildSteps(order: SavedOrder): Step[] {
  const rank = { Recebido: 1, "Em separação": 2, "Em entrega": 3, Entregue: 5, Cancelado: 0 }[
    order.status
  ];
  const state = (index: number): Step["state"] =>
    index < rank ? "done" : index === rank ? "now" : "next";
  const city = order.deliveryAddress
    ? ` · ${order.deliveryAddress.city}, ${order.deliveryAddress.state}`
    : "";
  const eta = order.deliveryEta.match(/(\d{1,2})h\s*$/)?.[1];
  return [
    { label: "Solicitação enviada", caption: stamp(order.createdAt), state: "done", icon: Check },
    {
      label: "Confirmado pelo produtor",
      caption: order.confirmedAt ? stamp(order.confirmedAt) : "aguardando o produtor",
      state: state(1),
      icon: Handshake,
    },
    {
      label: "Em separação",
      caption: rank > 2 ? "concluída" : rank === 2 ? "o produtor está separando" : "",
      state: state(2),
      icon: Package,
    },
    {
      label: "Saiu para entrega",
      caption: order.shippedAt ? `${stamp(order.shippedAt)}${city}` : "",
      state: state(3),
      icon: Truck,
    },
    {
      label: "Entregue",
      caption: order.deliveredAt
        ? stamp(order.deliveredAt)
        : eta
          ? `previsto até ${eta}h`
          : order.deliveryEta,
      state: rank >= 5 ? "done" : "next",
      icon: PackageCheck,
    },
  ];
}

function headline(order: SavedOrder) {
  switch (order.status) {
    case "Em entrega":
      return arrivalLabel(order);
    case "Entregue":
      return `Entregue ${relativeDay(order.deliveredAt ?? order.createdAt, false)}`;
    case "Cancelado":
      return "Solicitação cancelada";
    case "Em separação":
      return "Separando seu pedido";
    default:
      return "Aguardando o produtor";
  }
}

function summary(order: SavedOrder) {
  if (order.items.length === 1) {
    const item = order.items[0];
    return `${item.productName} · ${formatQuantity(item.quantity)} ${unitLabel(item.unit, item.quantity)} · ${item.producerName}`;
  }
  return `${orderItemsLabel(order)} · ${orderProducersLabel(order)}`;
}

function Tracking() {
  const { id } = Route.useSearch();
  const { orders, loading, error, reload, isOrderPending, cancelOrder, openComplaint } =
    useOrders();
  const navigate = useNavigate();
  const router = useRouter();
  const [sheet, setSheet] = useState<"problem" | "cancel" | null>(null);
  const [text, setText] = useState("");
  const order = useMemo(
    () =>
      orders.find((item) => item.id === id) ??
      orders.find((item) => item.status !== "Entregue" && item.status !== "Cancelado") ??
      orders[0],
    [id, orders],
  );

  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else void navigate({ to: "/orders" });
  };

  if (!order) {
    return (
      <>
        <Navbar />
        <div className="m-screen m-s-05-acompanhamento">
          <div className="m-status" />
          <div className="m-hd">
            <button type="button" className="m-round" onClick={goBack} aria-label="Voltar">
              <ArrowLeft className="lucide" aria-hidden />
            </button>
            <h1>Acompanhamento</h1>
            <span style={{ width: 44 }} />
          </div>
          <div className="m-pad">
            {error ? (
              <DataLoadError message={error} onRetry={reload} />
            ) : loading ? (
              <DataLoading label="Carregando pedido..." />
            ) : (
              <div className="m-card m-empty">
                <b>Nenhum pedido para acompanhar</b>
                <span>Envie uma lista de interesse para acompanhar a entrega por aqui.</span>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  const pending = isOrderPending(order.id);
  const steps = buildSteps(order);
  const firstItem = order.items[0];
  const chatSearch = { orderId: order.id, producerId: firstItem?.producerId };

  const submitSheet = async () => {
    const value = text.trim();
    if (!value) return;
    try {
      if (sheet === "cancel") {
        await cancelOrder(order.id, "comprador", value);
        toast.success("Solicitação cancelada");
      } else {
        await openComplaint(order.id, value);
        toast.success("Problema enviado. A operação vai acompanhar este pedido.");
      }
      setSheet(null);
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar. Tente novamente.");
    }
  };

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-05-acompanhamento">
        <div className="m-status" />
        <div className="m-hd">
          <button type="button" className="m-round" onClick={goBack} aria-label="Voltar">
            <ArrowLeft className="lucide" aria-hidden />
          </button>
          <h1>Pedido #{order.id}</h1>
          <a
            href={supportHref}
            target={supportHref.startsWith("http") ? "_blank" : undefined}
            rel={supportHref.startsWith("http") ? "noreferrer" : undefined}
            className="m-round"
            aria-label="Falar com o suporte"
          >
            <LifeBuoy className="lucide" aria-hidden />
          </a>
        </div>

        <div className="m-hero m-card">
          <StatusChip status={order.status} />
          <h2>{headline(order)}</h2>
          <p>{summary(order)}</p>
          {order.status === "Cancelado" ? (
            <p className="m-cancel">
              Cancelada por {order.canceledBy ?? "usuário"}:{" "}
              {order.cancellationReason ?? "sem motivo informado"}
            </p>
          ) : order.status === "Entregue" ? (
            order.receiptCode && (
              <div className="m-code">
                <div>
                  <span>Recibo</span>
                  <b>{order.receiptCode}</b>
                </div>
                <p>Guarde este número para conferência.</p>
              </div>
            )
          ) : (
            <div className="m-code">
              <div>
                <span>Código de entrega</span>
                <b>{order.deliveryCode ?? "····"}</b>
              </div>
              <p>Mostre ao entregador na hora de receber.</p>
            </div>
          )}
        </div>

        {order.status !== "Cancelado" && (
          <div className="m-tl m-card">
            {steps.map((step) => {
              const Icon = step.state === "done" ? Check : step.icon;
              return (
                <div key={step.label} className={`m-stp m-${step.state}`}>
                  <span className="m-dotc">
                    <Icon className="lucide" aria-hidden />
                  </span>
                  <div>
                    <b>{step.label}</b>
                    {step.caption && <span>{step.caption}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {order.complaint && (
          <div className="m-pad">
            <div className="m-card m-alert">
              <TriangleAlert className="lucide" aria-hidden />
              <span>
                Problema reportado: {order.complaint}
                {order.complaintStatus ? ` · ${order.complaintStatus.toLowerCase()}` : ""}
              </span>
            </div>
          </div>
        )}

        {order.status !== "Cancelado" && (
          <div className="m-footer">
            {/* A entrega é concluída pelo produtor com o código acima (secure_complete_order). */}
            {order.status === "Entregue" ? (
              <Link to="/rating" search={{ id: order.id }} className="m-btn m-primary">
                <Star className="lucide" aria-hidden />
                Avaliar entrega
              </Link>
            ) : (
              <Link to="/chat" search={chatSearch} className="m-btn m-primary">
                <MessageCircle className="lucide" aria-hidden />
                Conversar com o produtor
              </Link>
            )}
            <div className="m-two">
              {order.status === "Recebido" || order.status === "Em separação" ? (
                canCancelOrder(order) ? (
                  <button
                    type="button"
                    className="m-btn m-text"
                    style={{ color: "var(--m-danger-700)" }}
                    onClick={() => setSheet("cancel")}
                  >
                    <Ban className="lucide" aria-hidden />
                    Cancelar
                  </button>
                ) : (
                  <span />
                )
              ) : order.status === "Entregue" ? (
                <Link to="/chat" search={chatSearch} className="m-btn m-text">
                  <MessageCircle className="lucide" aria-hidden />
                  Conversar
                </Link>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="m-btn m-text"
                style={{ color: "var(--m-danger-700)" }}
                onClick={() => setSheet("problem")}
              >
                <TriangleAlert className="lucide" aria-hidden />
                Reportar problema
              </button>
            </div>
          </div>
        )}
      </div>

      <Sheet
        open={sheet !== null}
        title={sheet === "cancel" ? "Cancelar solicitação" : "Reportar problema"}
        onClose={() => setSheet(null)}
        footer={
          <button
            type="button"
            className="m-btn m-primary"
            disabled={!text.trim() || pending}
            onClick={() => void submitSheet()}
          >
            {sheet === "cancel" ? "Confirmar cancelamento" : "Enviar para a operação"}
          </button>
        }
      >
        <label className="m-lbl" htmlFor="tracking-text">
          {sheet === "cancel"
            ? `Motivo do cancelamento (até ${formatCancellationDeadline(order)})`
            : "O que aconteceu com a entrega?"}
        </label>
        <textarea
          id="tracking-text"
          className="m-textarea"
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            sheet === "cancel"
              ? "Conte ao produtor por que vai cancelar"
              : "Produto não chegou, veio diferente, em falta..."
          }
        />
      </Sheet>
    </>
  );
}
