import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  MessageCircle,
  MessageSquareText,
  Plus,
  Send,
  SlidersHorizontal,
  Trash2,
  Zap,
} from "@/components/mobile/icons";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { Sheet } from "@/components/mobile/Sheet";
import { useAuth } from "@/lib/auth";
import {
  type DemandItem,
  type DemandRequest,
  type DemandResponse,
  type DemandStatus,
  type DemandUrgency,
  useDemandRequests,
} from "@/lib/demands";
import { formatBRL, initials, unitLabel } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/orders";

type DemandsSearch = { respond?: string };

export const Route = createFileRoute("/demands")({
  validateSearch: (search: Record<string, unknown>): DemandsSearch => ({
    respond: typeof search.respond === "string" ? search.respond : undefined,
  }),
  component: () => (
    <RequireProfile allowed={["comprador", "produtor", "admin"]}>
      <DemandsHub />
    </RequireProfile>
  ),
});

const UNITS = ["kg", "unidade", "peça", "caixa", "maço", "bandeja", "pote", "litro"];
const PRODUCT_STATES = ["Indiferente", "Mais verde", "No ponto", "Maduro", "Selecionado"];
const HIDDEN_KEY = "origem-conecta-hidden-demand-responses";
type Filter = "all" | "open" | "withResponses" | "approved";

const STATUS_CHIP: Record<DemandStatus, [string, string]> = {
  Aberta: ["m-st-recebido", "Aberta"],
  Respondida: ["m-st-separacao", "Com proposta"],
  Aprovada: ["m-st-entregue", "Aprovada"],
  Cancelada: ["m-st-cancelado", "Cancelada"],
};

const qty = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const shortDate = (value: string) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
    : "";
const displayId = (id: string) => (/^DEM-/i.test(id) ? id : `DEM-${id.slice(-4).toUpperCase()}`);

function demandTitle(demand: DemandRequest) {
  if (demand.items.length === 1) {
    const [item] = demand.items;
    const state =
      item.productState && item.productState !== "Indiferente"
        ? ` ${item.productState.toLowerCase()}`
        : "";
    return `${item.productName}${state} · ${qty(item.quantity)} ${unitLabel(item.unit, item.quantity)}`;
  }
  return demand.items
    .map(
      (item, index) =>
        `${index === 0 ? item.productName : item.productName.split(" ")[0]} ${qty(item.quantity)} ${unitLabel(item.unit, item.quantity)}`,
    )
    .join(" · ");
}

function daysLeft(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 864e5);
}

function responseTotal(response: DemandResponse) {
  return response.items.filter((item) => item.canSupply).reduce((sum, item) => sum + item.price, 0);
}

function readHidden(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(HIDDEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function DemandsHub() {
  const { profile } = useAuth();
  const { respond } = Route.useSearch();
  const { demands, addDemand, respondDemand, approveResponse } = useDemandRequests();

  if (profile?.tipo === "produtor") {
    const demand = respond ? demands.find((item) => item.id === respond) : undefined;
    return demand ? (
      <RespondDemand demand={demand} respondDemand={respondDemand} producerName={profile.nome} />
    ) : (
      <ProducerDemands demands={demands} producerName={profile.nome} />
    );
  }
  return (
    <BuyerDemands
      demands={demands}
      addDemand={addDemand}
      approveResponse={approveResponse}
      buyerName={profile?.nome ?? "Comprador"}
      readOnly={profile?.tipo !== "comprador"}
    />
  );
}

function DemandHead({ demand, right }: { demand: DemandRequest; right?: React.ReactNode }) {
  const [chipClass, label] = STATUS_CHIP[demand.status];
  return (
    <div className="m-t">
      {demand.urgency === "urgente" && demand.status === "Aberta" ? (
        <>
          <span className={`m-chip ${chipClass} m-st-dot`}>{label}</span>
          <span className="m-chip m-st-cancelado m-urg">
            <Zap className="lucide" aria-hidden />
            Urgente
          </span>
        </>
      ) : (
        <>
          <span className={`m-chip ${chipClass} m-st-dot`}>{label}</span>
          {right ?? <span className="m-muted">#{displayId(demand.id)}</span>}
        </>
      )}
    </div>
  );
}

function BuyerDemands({
  demands,
  addDemand,
  approveResponse,
  buyerName,
  readOnly,
}: {
  demands: DemandRequest[];
  addDemand: ReturnType<typeof useDemandRequests>["addDemand"];
  approveResponse: ReturnType<typeof useDemandRequests>["approveResponse"];
  buyerName: string;
  readOnly: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [composing, setComposing] = useState(false);
  const [approvingId, setApprovingId] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => setHidden(readHidden()), []);

  const counts = {
    all: demands.length,
    open: demands.filter((demand) => demand.status === "Aberta").length,
    withResponses: demands.filter((demand) => demand.status === "Respondida").length,
    approved: demands.filter((demand) => demand.status === "Aprovada").length,
  };
  const visible = demands.filter((demand) => {
    if (urgentOnly && demand.urgency !== "urgente") return false;
    if (filter === "open") return demand.status === "Aberta";
    if (filter === "withResponses") return demand.status === "Respondida";
    if (filter === "approved") return demand.status === "Aprovada";
    return true;
  });

  const approve = async (demand: DemandRequest, response: DemandResponse) => {
    setApprovingId(response.id);
    try {
      const orderId = await approveResponse(demand.id, response.id);
      toast.success(`Proposta aprovada. Pedido ${orderId ? `#${orderId} ` : ""}criado.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível aprovar a proposta.");
    } finally {
      setApprovingId("");
    }
  };

  const hide = (response: DemandResponse) => {
    const next = [...hidden, response.id];
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    setHidden(next);
    toast.success(`Proposta de ${response.producerName} ocultada`, {
      description: "O produtor não é avisado. Você ainda pode aprovar outra proposta.",
      action: {
        label: "Desfazer",
        onClick: () => {
          const restored = readHidden().filter((id) => id !== response.id);
          window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(restored));
          setHidden(restored);
        },
      },
    });
  };

  const pills: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "Todas", count: counts.all },
    { key: "open", label: "Abertas", count: counts.open },
    { key: "withResponses", label: "Com proposta", count: counts.withResponses },
    { key: "approved", label: "Aprovadas" },
  ];

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-07-demandas">
        <div className="m-status" />
        <div className="m-hd m-big">
          <h1>Demandas</h1>
          <button
            type="button"
            className={`m-round${urgentOnly ? " m-active" : ""}`}
            aria-pressed={urgentOnly}
            aria-label="Mostrar só urgentes"
            title="Mostrar só urgentes"
            onClick={() => setUrgentOnly((current) => !current)}
          >
            <SlidersHorizontal className="lucide" aria-hidden />
          </button>
        </div>
        <p className="m-intro">
          {readOnly
            ? "Demandas publicadas pelos compradores."
            : "Não achou no portfólio? Publique o que precisa e os produtores mandam proposta."}
        </p>
        <div className="m-cats" role="tablist">
          {pills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              role="tab"
              aria-selected={filter === pill.key}
              className={`m-pill${filter === pill.key ? " m-on" : ""}`}
              onClick={() => setFilter(pill.key)}
            >
              {pill.label}
              {pill.count !== undefined && <span className="m-n">{pill.count}</span>}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>{demands.length ? "Nada neste filtro" : "Nenhuma demanda publicada"}</b>
              <span>
                {demands.length
                  ? "Escolha outro filtro para ver suas demandas."
                  : "Publique o que precisa e receba propostas dos produtores da região."}
              </span>
            </div>
          </div>
        ) : (
          visible.map((demand) => {
            const pending = demand.responses.filter(
              (response) => response.status === "Enviada" && !hidden.includes(response.id),
            );
            const approved = demand.responses.find((response) => response.status === "Aprovada");
            const remaining = daysLeft(demand.deliveryDate);
            return (
              <div key={demand.id} className="m-dm m-card">
                <DemandHead
                  demand={demand}
                  right={
                    demand.status === "Aprovada" ? undefined : (
                      <span className="m-muted">
                        #{displayId(demand.id)}
                        {demand.deliveryDate ? ` · entrega ${shortDate(demand.deliveryDate)}` : ""}
                      </span>
                    )
                  }
                />
                <b className="m-tt">{demandTitle(demand)}</b>
                {demand.status === "Aprovada" ? (
                  <span className="m-muted m-sub">
                    {approved?.orderId
                      ? `Virou o pedido #${approved.orderId}`
                      : `Aprovada com ${approved?.producerName ?? "o produtor"}`}
                  </span>
                ) : pending.length === 0 ? (
                  <span className="m-muted m-sub">
                    Aguardando propostas
                    {remaining !== null && remaining >= 0
                      ? ` · fecha ${remaining === 0 ? "hoje" : remaining === 1 ? "amanhã" : `em ${remaining} dias`}`
                      : ""}
                  </span>
                ) : (
                  pending.map((response) => {
                    const supplied = response.items.filter((item) => item.canSupply);
                    const single = supplied.length === 1 ? supplied[0] : null;
                    return (
                      <div key={response.id}>
                        <div className="m-prop">
                          <span className="m-avatar">{initials(response.producerName)}</span>
                          <div>
                            <b>{response.producerName}</b>
                            <span>
                              {single
                                ? `${formatBRL(single.quantity > 0 ? single.price / single.quantity : single.price)}/${single.unit} · `
                                : `${supplied.length} de ${response.items.length} itens · `}
                              <strong>{formatBRL(responseTotal(response))}</strong>
                            </span>
                          </div>
                        </div>
                        {response.notes && <p className="m-rnote">“{response.notes}”</p>}
                        {!readOnly && (
                          <div className="m-acts">
                            {response.producerId && (
                              <Link
                                to="/chat"
                                search={{ demandId: demand.id, producerId: response.producerId }}
                                className="m-btn m-text m-sm"
                              >
                                <MessageCircle className="lucide" aria-hidden />
                                Conversar
                              </Link>
                            )}
                            <button
                              type="button"
                              className="m-btn m-secondary m-sm"
                              onClick={() => hide(response)}
                            >
                              Recusar
                            </button>
                            <button
                              type="button"
                              className="m-btn m-primary m-sm"
                              disabled={approvingId === response.id}
                              onClick={() => void approve(demand, response)}
                            >
                              {approvingId === response.id ? "Aprovando..." : "Aprovar"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })
        )}

        {!readOnly && (
          <button type="button" className="m-fab" onClick={() => setComposing(true)}>
            <Plus className="lucide" aria-hidden />
            Nova demanda
          </button>
        )}
      </div>
      <NewDemandSheet
        open={composing}
        onClose={() => setComposing(false)}
        addDemand={addDemand}
        buyerName={buyerName}
      />
    </>
  );
}

function emptyItem(): DemandItem {
  return {
    id: crypto.randomUUID(),
    productName: "",
    quantity: 1,
    unit: "kg",
    productState: "Indiferente",
    notes: "",
  };
}

function parseDecimal(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function NewDemandSheet({
  open,
  onClose,
  addDemand,
  buyerName,
}: {
  open: boolean;
  onClose: () => void;
  addDemand: ReturnType<typeof useDemandRequests>["addDemand"];
  buyerName: string;
}) {
  const [items, setItems] = useState<DemandItem[]>([emptyItem()]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [urgency, setUrgency] = useState<DemandUrgency>("normal");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Pix");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const valid = items.filter((item) => item.productName.trim() && item.quantity > 0);
  const update = (id: string, patch: Partial<DemandItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const submit = async () => {
    setError("");
    if (!deliveryDate) return setError("Informe a data desejada.");
    if (!valid.length) return setError("Adicione pelo menos um produto.");
    setSending(true);
    try {
      await addDemand({
        buyerName,
        deliveryDate,
        urgency,
        paymentMethod,
        notes: notes.trim() || undefined,
        items: valid.map((item) => ({
          ...item,
          productName: item.productName.trim(),
          notes: item.notes?.trim() || undefined,
        })),
      });
      toast.success("Demanda enviada para os produtores");
      setItems([emptyItem()]);
      setDeliveryDate("");
      setUrgency("normal");
      setNotes("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a demanda.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet
      open={open}
      title="Nova demanda"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="m-btn m-primary"
          disabled={sending}
          onClick={() => void submit()}
        >
          <Send className="lucide" aria-hidden />
          {sending ? "Enviando..." : "Enviar para produtores"}
        </button>
      }
    >
      {items.map((item, index) => (
        <div key={item.id} className="m-subcard">
          <div className="m-subcard-hd">
            Produto {index + 1}
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}
                aria-label={`Remover produto ${index + 1}`}
              >
                <Trash2 className="lucide" aria-hidden />
              </button>
            )}
          </div>
          <label className="m-field">
            <span>O que você precisa</span>
            <div className="m-in">
              <input
                value={item.productName}
                onChange={(event) => update(item.id, { productName: event.target.value })}
                placeholder="Ex.: tomate italiano"
              />
            </div>
          </label>
          <div className="m-row2">
            <label className="m-field">
              <span>Quantidade</span>
              <div className="m-in">
                <input
                  value={item.quantity ? String(item.quantity).replace(".", ",") : ""}
                  onChange={(event) =>
                    update(item.id, { quantity: parseDecimal(event.target.value) })
                  }
                  inputMode="decimal"
                />
              </div>
            </label>
            <label className="m-field">
              <span>Unidade</span>
              <div className="m-in">
                <select
                  value={item.unit}
                  onChange={(event) => update(item.id, { unit: event.target.value })}
                >
                  {UNITS.map((unit) => (
                    <option key={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </label>
          </div>
          <label className="m-field">
            <span>Ponto do produto</span>
            <div className="m-in">
              <select
                value={item.productState}
                onChange={(event) => update(item.id, { productState: event.target.value })}
              >
                {PRODUCT_STATES.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>
            </div>
          </label>
        </div>
      ))}
      <button
        type="button"
        className="m-btn m-text"
        style={{ marginTop: 6 }}
        onClick={() => setItems((current) => [...current, emptyItem()])}
      >
        <Plus className="lucide" aria-hidden />
        Adicionar produto
      </button>
      <div className="m-row2">
        <label className="m-field">
          <span>Entregar até</span>
          <div className="m-in">
            <input
              type="date"
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
            />
          </div>
        </label>
        <div className="m-field">
          <span>Urgência</span>
          <div className="m-pills">
            {(["normal", "urgente"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={urgency === value}
                className={`m-pill${urgency === value ? " m-on" : ""}`}
                onClick={() => setUrgency(value)}
              >
                {value === "normal" ? "Normal" : "Urgente"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="m-field">
        <span>Pagamento</span>
        <div className="m-pills">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              aria-pressed={paymentMethod === method}
              className={`m-pill${paymentMethod === method ? " m-sel" : ""}`}
              onClick={() => setPaymentMethod(method)}
            >
              {method}
            </button>
          ))}
        </div>
      </div>
      <label className="m-field">
        <span>Observações</span>
        <textarea
          className="m-textarea"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Maturação, embalagem, horário de entrega..."
        />
        {error && <small className="m-err">{error}</small>}
      </label>
    </Sheet>
  );
}

function ProducerDemands({
  demands,
  producerName,
}: {
  demands: DemandRequest[];
  producerName: string;
}) {
  const open = demands.filter(
    (demand) => demand.status === "Aberta" || demand.status === "Respondida",
  );
  return (
    <>
      <Navbar />
      <div className="m-screen m-s-07-demandas">
        <div className="m-status" />
        <div className="m-hd m-big">
          <h1>Demandas</h1>
        </div>
        <p className="m-intro">
          Compradores da região pedindo o que não acharam no portfólio. Responda o que consegue
          entregar.
        </p>
        {open.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>Nenhuma demanda aberta</b>
              <span>Quando um comprador publicar uma demanda, ela aparece aqui.</span>
            </div>
          </div>
        ) : (
          open.map((demand) => {
            const answered = demand.responses.some(
              (response) => response.producerName === producerName,
            );
            return (
              <div key={demand.id} className="m-dm m-card">
                <DemandHead
                  demand={demand}
                  right={
                    <span className="m-muted">
                      #{displayId(demand.id)}
                      {demand.deliveryDate ? ` · entrega ${shortDate(demand.deliveryDate)}` : ""}
                    </span>
                  }
                />
                <b className="m-tt">{demandTitle(demand)}</b>
                <span className="m-muted m-sub">
                  {demand.buyerName}
                  {demand.paymentMethod ? ` · ${demand.paymentMethod}` : ""}
                </span>
                <div className="m-acts">
                  {demand.buyerId && (
                    <Link
                      to="/chat"
                      search={{ demandId: demand.id, buyerId: demand.buyerId }}
                      className="m-btn m-text m-sm"
                    >
                      <MessageCircle className="lucide" aria-hidden />
                      Conversar
                    </Link>
                  )}
                  {answered ? (
                    <span className="m-chip m-st-entregue">Proposta enviada</span>
                  ) : (
                    <Link
                      to="/demands"
                      search={{ respond: demand.id }}
                      className="m-btn m-primary m-sm"
                    >
                      Responder
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

type Line = {
  demandItemId: string;
  productName: string;
  requested: number;
  unit: string;
  canSupply: boolean;
  quantity: string;
  unitPrice: string;
};

function RespondDemand({
  demand,
  respondDemand,
  producerName,
}: {
  demand: DemandRequest;
  respondDemand: ReturnType<typeof useDemandRequests>["respondDemand"];
  producerName: string;
}) {
  const navigate = useNavigate();
  const answered = demand.responses.some((response) => response.producerName === producerName);
  const [lines, setLines] = useState<Line[]>(() =>
    demand.items.map((item) => ({
      demandItemId: item.id,
      productName: item.productName,
      requested: item.quantity,
      unit: item.unit,
      canSupply: true,
      quantity: qty(item.quantity),
      unitPrice: "",
    })),
  );
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const update = (id: string, patch: Partial<Line>) =>
    setLines((current) =>
      current.map((line) => (line.demandItemId === id ? { ...line, ...patch } : line)),
    );
  const priced = useMemo(
    () =>
      lines.map((line) => {
        const amount = parseDecimal(line.quantity);
        const price = parseDecimal(line.unitPrice);
        return { ...line, amount, total: line.canSupply ? amount * price : 0 };
      }),
    [lines],
  );
  const supplied = priced.filter((line) => line.canSupply && line.total > 0);
  const total = supplied.reduce((sum, line) => sum + line.total, 0);
  const deadline = demand.deliveryDate
    ? new Date(`${demand.deliveryDate}T12:00:00`).toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      })
    : "";

  const back = () => void navigate({ to: "/demands" });

  const submit = async () => {
    if (!supplied.length) {
      toast.error("Informe preço e quantidade de pelo menos um item.");
      return;
    }
    setSending(true);
    try {
      await respondDemand(demand.id, {
        producerName,
        notes: notes.trim() || undefined,
        items: priced.map((line) => ({
          id: crypto.randomUUID(),
          demandItemId: line.demandItemId,
          productName: line.productName,
          quantity: line.amount,
          unit: line.unit,
          price: Number(line.total.toFixed(2)),
          canSupply: line.canSupply && line.total > 0,
        })),
      });
      toast.success("Proposta enviada ao comprador");
      back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a proposta.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-p3-responder">
        <div className="m-status" />
        <div className="m-hd">
          <button type="button" className="m-round" onClick={back} aria-label="Voltar">
            <ArrowLeft className="lucide" aria-hidden />
          </button>
          <h1>Responder demanda</h1>
          <span style={{ width: "44px" }} />
        </div>
        <div className="m-dm m-card">
          <div className="m-t">
            {demand.urgency === "urgente" ? (
              <span className="m-chip m-st-cancelado">
                <Zap className="lucide" aria-hidden />
                Urgente
              </span>
            ) : (
              <span className={`m-chip ${STATUS_CHIP[demand.status][0]} m-st-dot`}>
                {STATUS_CHIP[demand.status][1]}
              </span>
            )}
            <span className="m-muted">#{displayId(demand.id)}</span>
          </div>
          <div className="m-by">
            <span className="m-avatar">{initials(demand.buyerName)}</span>
            <div>
              <b>{demand.buyerName}</b>
              <span>
                {[deadline && `entrega até ${deadline}`, demand.paymentMethod]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </div>
          {demand.notes && <p className="m-note">“{demand.notes}”</p>}
        </div>

        {answered ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>Proposta enviada</b>
              <span>O comprador vai comparar as propostas e avisar se aprovar a sua.</span>
            </div>
          </div>
        ) : (
          <>
            <h3 className="m-lb">Sua proposta</h3>
            <div className="m-lines m-card">
              {lines.map((line) => (
                <div key={line.demandItemId} className="m-li">
                  <div className="m-top">
                    <div>
                      <b>{line.productName}</b>
                      <span className="m-muted">
                        Pediram {qty(line.requested)} {unitLabel(line.unit, line.requested)}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={line.canSupply}
                      aria-label={`Atender ${line.productName}`}
                      className={`m-sw${line.canSupply ? " m-on" : ""}`}
                      onClick={() => update(line.demandItemId, { canSupply: !line.canSupply })}
                    >
                      <i />
                    </button>
                  </div>
                  {line.canSupply ? (
                    <div className="m-in">
                      <label className="m-f">
                        <span>Consigo entregar</span>
                        <b>
                          <input
                            value={line.quantity}
                            onChange={(event) =>
                              update(line.demandItemId, { quantity: event.target.value })
                            }
                            inputMode="decimal"
                            style={
                              {
                                "--w": `${Math.max(line.quantity.length, 1)}ch`,
                              } as React.CSSProperties
                            }
                            aria-label={`Quantidade de ${line.productName}`}
                          />{" "}
                          {unitLabel(line.unit, parseDecimal(line.quantity))}
                        </b>
                      </label>
                      <label className="m-f">
                        <span>Seu preço</span>
                        <b>
                          R${"\u00a0"}
                          <input
                            value={line.unitPrice}
                            onChange={(event) =>
                              update(line.demandItemId, { unitPrice: event.target.value })
                            }
                            inputMode="decimal"
                            placeholder="0,00"
                            style={
                              {
                                "--w": `${Math.max(line.unitPrice.length, 4)}ch`,
                              } as React.CSSProperties
                            }
                            aria-label={`Preço por ${line.unit} de ${line.productName}`}
                          />
                          /{line.unit}
                        </b>
                      </label>
                    </div>
                  ) : (
                    <span className="m-muted" style={{ fontSize: "12px" }}>
                      Não vou atender este item
                    </span>
                  )}
                </div>
              ))}
            </div>
            <label className="m-obs m-card">
              <MessageSquareText className="lucide" aria-hidden />
              <textarea
                rows={1}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Condições: remessas, embalagem, validade da proposta"
                aria-label="Condições da proposta"
              />
            </label>
            <div className="m-footer">
              <div className="m-sum">
                <span>
                  Total da proposta · {supplied.length} de {lines.length}{" "}
                  {lines.length === 1 ? "item" : "itens"}
                </span>
                <b className="m-price">{formatBRL(total)}</b>
              </div>
              <button
                type="button"
                className="m-btn m-primary"
                disabled={sending || !supplied.length}
                onClick={() => void submit()}
              >
                <Send className="lucide" aria-hidden />
                {sending ? "Enviando..." : "Enviar proposta"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
