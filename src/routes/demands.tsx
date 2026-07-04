import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { SupportButton } from "@/components/layout/SupportButton";
import { useAuth } from "@/lib/auth";
import {
  type DemandItem,
  type DemandRequest,
  type DemandResponse,
  type DemandResponseItem,
  type DemandUrgency,
  useDemandRequests,
} from "@/lib/demands";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/orders";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Plus,
  Send,
  ShoppingBag,
  Trash2,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/demands")({
  component: () => (
    <RequireProfile allowed={["comprador", "produtor", "admin"]}>
      <DemandsHub />
    </RequireProfile>
  ),
});

const units = ["kg", "unidade", "peça", "caixa", "maço", "bandeja", "pote", "litro"];
const productStates = ["Indiferente", "Mais verde", "No ponto", "Maduro", "Selecionado"];
type DemandFilter = "all" | "open" | "withResponses" | "approved";

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

function DemandsHub() {
  const { profile } = useAuth();
  const { demands, addDemand, respondDemand, approveResponse } = useDemandRequests();

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-6 pb-24 sm:px-8 sm:py-10 md:pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={profile?.tipo === "produtor" ? "/producer/orders" : "/portfolio"}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <SupportButton compact />
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Hub de demandas
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              Demandas de compra
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              O comprador informa o que precisa e os produtores enviam propostas para atender.
            </p>
          </div>
        </div>

        {profile?.tipo === "comprador" && (
          <BuyerDemandView
            demands={demands}
            addDemand={addDemand}
            approveResponse={approveResponse}
            buyerName={profile.nome}
          />
        )}

        {profile?.tipo === "produtor" && (
          <ProducerDemandView demands={demands} respondDemand={respondDemand} producerName={profile.nome} />
        )}

        {profile?.tipo === "admin" && <AdminDemandView demands={demands} />}
      </main>
    </div>
  );
}

function BuyerDemandView({
  demands,
  addDemand,
  approveResponse,
  buyerName,
}: {
  demands: DemandRequest[];
  addDemand: ReturnType<typeof useDemandRequests>["addDemand"];
  approveResponse: ReturnType<typeof useDemandRequests>["approveResponse"];
  buyerName: string;
}) {
  const [items, setItems] = useState<DemandItem[]>([emptyItem()]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [urgency, setUrgency] = useState<DemandUrgency>("normal");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Pix");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const validItems = items.filter((item) => item.productName.trim() && item.quantity > 0);

  const createDemand = async () => {
    setError("");
    setMessage("");
    if (!deliveryDate) {
      setError("Informe a data desejada.");
      return;
    }
    if (!validItems.length) {
      setError("Adicione pelo menos um produto.");
      return;
    }
    try {
      await addDemand({
        buyerName,
        deliveryDate,
        urgency,
        paymentMethod,
        paymentNotes: paymentNotes.trim() || undefined,
        notes: notes.trim() || undefined,
        items: validItems.map((item) => ({
          ...item,
          productName: item.productName.trim(),
          notes: item.notes?.trim() || undefined,
        })),
      });
      setItems([emptyItem()]);
      setDeliveryDate("");
      setUrgency("normal");
      setPaymentMethod("Pix");
      setPaymentNotes("");
      setNotes("");
      setMessage("Demanda enviada para os produtores.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a demanda.");
    }
  };

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Panel
        title="Criar demanda"
        icon={Send}
        description="Use quando precisar de um produto urgente, fora do portfólio ou em maior quantidade."
      >
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data desejada">
              <input
                type="date"
                value={deliveryDate}
                onChange={(event) => setDeliveryDate(event.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Urgência">
              <select
                value={urgency}
                onChange={(event) => setUrgency(event.target.value as DemandUrgency)}
                className="form-input"
              >
                <option value="normal">Normal</option>
                <option value="urgente">Urgente</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Forma de pagamento">
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className="form-input"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Observação do pagamento">
              <input
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
                placeholder="Ex: Pix na entrega"
                className="form-input"
              />
            </Field>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <DemandItemEditor
                key={item.id}
                item={item}
                index={index}
                onChange={(next) =>
                  setItems((current) =>
                    current.map((currentItem) => (currentItem.id === item.id ? next : currentItem)),
                  )
                }
                onRemove={() =>
                  setItems((current) =>
                    current.length === 1 ? [emptyItem()] : current.filter((currentItem) => currentItem.id !== item.id),
                  )
                }
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setItems((current) => [...current, emptyItem()])}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-brand-900 hover:border-leaf-500 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Adicionar produto
          </button>

          <Field label="Observações gerais">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Ex: padrão de maturação, embalagem, horário preferido..."
              className="form-input min-h-[92px] py-3"
            />
          </Field>

          {error && <Alert tone="error">{error}</Alert>}
          {message && <Alert tone="success">{message}</Alert>}

          <button
            type="button"
            onClick={() => void createDemand()}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-900 px-5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            <Send className="h-4 w-4" />
            Enviar para produtores
          </button>
        </div>
      </Panel>

      <Panel
        title="Acompanhar demandas"
        icon={ClipboardList}
        description="Veja as propostas recebidas e aprove a melhor para gerar o pedido."
      >
        <DemandList demands={demands} approveResponse={approveResponse} />
      </Panel>
    </div>
  );
}

function ProducerDemandView({
  demands,
  respondDemand,
  producerName,
}: {
  demands: DemandRequest[];
  respondDemand: ReturnType<typeof useDemandRequests>["respondDemand"];
  producerName: string;
}) {
  const openDemands = demands.filter((demand) => demand.status === "Aberta" || demand.status === "Respondida");

  return (
    <section className="mt-8 grid gap-4">
      <div className="rounded-2xl border border-border bg-white p-4 shadow-xs sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Novas oportunidades
        </p>
        <h2 className="mt-1 text-xl font-bold text-brand-900">Responda o que consegue entregar</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Confira quantidade, unidade, data e pagamento. Sua proposta deve ser o valor total para o que você vai fornecer.
        </p>
      </div>
      {openDemands.length === 0 ? (
        <Empty title="Nenhuma demanda aberta" text="Quando compradores dispararem demandas, elas aparecem aqui." />
      ) : (
        openDemands.map((demand) => (
          <ProducerDemandCard
            key={demand.id}
            demand={demand}
            producerName={producerName}
            respondDemand={respondDemand}
          />
        ))
      )}
    </section>
  );
}

function AdminDemandView({ demands }: { demands: DemandRequest[] }) {
  return (
    <section className="mt-8 grid gap-4">
      {demands.map((demand) => (
        <DemandCard key={demand.id} demand={demand} />
      ))}
      {demands.length === 0 && (
        <Empty title="Nenhuma demanda criada" text="As demandas dos compradores aparecerão aqui." />
      )}
    </section>
  );
}

function DemandItemEditor({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: DemandItem;
  index: number;
  onChange: (item: DemandItem) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-canvas p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-brand-900">Produto {index + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--color-error-bg)] bg-white px-3 text-xs font-semibold text-[var(--color-error-fg)]"
        >
          <Trash2 className="h-4 w-4" />
          Remover
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <Field label="Produto">
          <input
            value={item.productName}
            onChange={(event) => onChange({ ...item, productName: event.target.value })}
            placeholder="Digite o produto desejado"
            className="form-input"
          />
        </Field>
        <Field label="Quantidade">
          <input
            value={item.quantity === 0 ? "" : String(item.quantity)}
            onChange={(event) => onChange({ ...item, quantity: parseDecimal(event.target.value) })}
            inputMode="decimal"
            className="form-input"
          />
        </Field>
        <Field label="Unidade">
          <select
            value={item.unit}
            onChange={(event) => onChange({ ...item, unit: event.target.value })}
            className="form-input"
          >
            {units.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Estado do produto">
          <select
            value={item.productState}
            onChange={(event) => onChange({ ...item, productState: event.target.value })}
            className="form-input"
          >
            {productStates.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Observação">
          <input
            value={item.notes ?? ""}
            onChange={(event) => onChange({ ...item, notes: event.target.value })}
            placeholder="Opcional"
            className="form-input"
          />
        </Field>
      </div>
    </div>
  );
}

function DemandList({
  demands,
  approveResponse,
}: {
  demands: DemandRequest[];
  approveResponse: ReturnType<typeof useDemandRequests>["approveResponse"];
}) {
  const [approvingId, setApprovingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState<DemandFilter>("all");

  const openCount = demands.filter((demand) => demand.status === "Aberta").length;
  const withResponsesCount = demands.filter((demand) => demand.responses.length > 0).length;
  const approvedCount = demands.filter((demand) => demand.status === "Aprovada").length;
  const filteredDemands = demands.filter((demand) => {
    if (activeFilter === "open") return demand.status === "Aberta";
    if (activeFilter === "withResponses") return demand.responses.length > 0;
    if (activeFilter === "approved") return demand.status === "Aprovada";
    return true;
  });

  const approve = async (demandId: string, responseId: string) => {
    setApprovingId(responseId);
    setError("");
    setMessage("");
    try {
      const orderId = await approveResponse(demandId, responseId);
      setMessage(`Proposta aprovada e pedido ${orderId ? `#${orderId}` : ""} criado.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aprovar a proposta.");
    } finally {
      setApprovingId("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MiniStat
          label="Abertas"
          value={openCount}
          active={activeFilter === "open"}
          onClick={() => setActiveFilter("open")}
        />
        <MiniStat
          label="Com propostas"
          value={withResponsesCount}
          active={activeFilter === "withResponses"}
          onClick={() => setActiveFilter("withResponses")}
        />
        <MiniStat
          label="Pedidos"
          value={approvedCount}
          active={activeFilter === "approved"}
          onClick={() => setActiveFilter("approved")}
        />
      </div>
      {activeFilter !== "all" && (
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-semibold text-brand-900 hover:border-leaf-500 sm:w-auto"
        >
          Limpar filtro
        </button>
      )}
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {filteredDemands.map((demand) => (
        <DemandCard key={demand.id} demand={demand}>
          {demand.responses.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-brand-900">Respostas dos produtores</p>
              {demand.responses.map((response) => (
                <ResponseSummary
                  key={response.id}
                  response={response}
                  action={
                    demand.status !== "Aprovada" && response.status === "Enviada" ? (
                      <button
                        type="button"
                        disabled={approvingId === response.id}
                        onClick={() => void approve(demand.id, response.id)}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-900 px-3 text-sm font-semibold text-white hover:bg-brand-800 sm:w-auto"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {approvingId === response.id ? "Aprovando..." : "Aprovar proposta"}
                      </button>
                    ) : null
                  }
                />
              ))}
            </div>
          )}
        </DemandCard>
      ))}
      {demands.length === 0 && (
        <Empty title="Nenhuma demanda enviada" text="Dispare uma demanda para todos os produtores verem." />
      )}
      {demands.length > 0 && filteredDemands.length === 0 && (
        <Empty title="Nenhuma demanda nesse filtro" text="Limpe o filtro ou escolha outra categoria para ver suas demandas." />
      )}
    </div>
  );
}

function ProducerDemandCard({
  demand,
  producerName,
  respondDemand,
}: {
  demand: DemandRequest;
  producerName: string;
  respondDemand: ReturnType<typeof useDemandRequests>["respondDemand"];
}) {
  const alreadyResponded = demand.responses.some((response) => response.producerName === producerName);
  const [items, setItems] = useState<DemandResponseItem[]>(
    demand.items.map((item) => ({
      id: crypto.randomUUID(),
      demandItemId: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      price: 0,
      canSupply: true,
      notes: "",
    })),
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const requestedItems = useMemo(
    () => new Map(demand.items.map((item) => [item.id, item])),
    [demand.items],
  );

  const sendResponse = async () => {
    setError("");
    setMessage("");
    if (demand.status === "Aprovada") {
      setError("Essa demanda já foi aceita por outro produtor.");
      return;
    }
    if (!items.some((item) => item.canSupply && item.price > 0)) {
      setError("Informe a oferta total para pelo menos um item que você consegue atender.");
      return;
    }
    try {
      await respondDemand(demand.id, {
        producerName,
        notes: notes.trim() || undefined,
        items: items.map((item) => ({ ...item, notes: item.notes?.trim() || undefined })),
      });
      setMessage("Resposta enviada ao comprador.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível responder a demanda.");
    }
  };

  return (
    <DemandCard demand={demand}>
      {alreadyResponded ? (
        <Alert tone="success">Sua resposta já foi enviada para essa demanda.</Alert>
      ) : (
        <div className="mt-4 rounded-2xl border border-border bg-canvas p-4">
          <p className="text-sm font-semibold text-brand-900">Sua proposta</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Marque os itens que consegue atender e informe o valor total para a quantidade oferecida.
          </p>
          <div className="mt-3 space-y-3">
            {items.map((item) => {
              const requested = item.demandItemId ? requestedItems.get(item.demandItemId) : undefined;
              return (
                <div key={item.id} className="rounded-xl border border-border bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-brand-900">{item.productName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pedido do comprador: {(requested?.quantity ?? item.quantity).toLocaleString("pt-BR")} {item.unit}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 rounded-full bg-surface-brand-soft px-3 py-2 text-xs font-bold text-brand-900">
                      <input
                        type="checkbox"
                        checked={item.canSupply}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((currentItem) =>
                              currentItem.id === item.id
                                ? { ...currentItem, canSupply: event.target.checked }
                                : currentItem,
                            ),
                          )
                        }
                        className="h-4 w-4 accent-[var(--color-brand-900)]"
                      />
                      Consigo atender
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label={`Quantidade que vou entregar (${item.unit})`}>
                      <input
                        value={item.quantity === 0 ? "" : String(item.quantity)}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((currentItem) =>
                              currentItem.id === item.id
                                ? { ...currentItem, quantity: parseDecimal(event.target.value) }
                                : currentItem,
                            ),
                          )
                        }
                        inputMode="decimal"
                        className="form-input"
                      />
                    </Field>
                    <Field label="Minha oferta total">
                      <input
                        value={item.price ? String(item.price) : ""}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((currentItem) =>
                              currentItem.id === item.id
                                ? { ...currentItem, price: parseDecimal(event.target.value) }
                                : currentItem,
                            ),
                          )
                        }
                        inputMode="decimal"
                        placeholder={`R$ pelas ${item.quantity.toLocaleString("pt-BR")} ${item.unit}`}
                        className="form-input"
                      />
                    </Field>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Exemplo: se o comprador pediu 60 bandejas, informe o valor pelas 60 bandejas.
                  </p>
                </div>
              );
            })}
          </div>
          <Field label="Condições da proposta">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Ex: disponibilidade, embalagem, validade da proposta..."
              className="form-input mt-2 min-h-[92px] py-3"
            />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          {message && <Alert tone="success">{message}</Alert>}
          <button
            type="button"
            onClick={() => void sendResponse()}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 text-sm font-semibold text-white hover:bg-brand-800 sm:w-auto"
          >
            <Send className="h-4 w-4" />
            Enviar proposta
          </button>
        </div>
      )}
    </DemandCard>
  );
}

function DemandCard({ demand, children }: { demand: DemandRequest; children?: React.ReactNode }) {
  const totalResponses = demand.responses.length;
  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
            Demanda #{shortId(demand.id)}
          </p>
          <h2 className="mt-1 text-lg font-bold text-brand-900">{demandTitle(demand)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{demandSubtitle(demand)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Entrega desejada: {formatDate(demand.deliveryDate)} · Pagamento: {demand.paymentMethod ?? "A combinar"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-surface-brand-soft px-3 py-1 text-xs font-bold text-brand-900">
            {demand.status}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
            demand.urgency === "urgente"
              ? "bg-orange-100 text-orange-800"
              : "bg-leaf-100 text-brand-900"
          }`}>
            {demand.urgency === "urgente" && <Zap className="h-3 w-3" />}
            {demand.urgency === "urgente" ? "Urgente" : "Normal"}
          </span>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-canvas">
        {demand.items.map((item) => (
          <li key={item.id} className="p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-brand-900">{item.productName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.quantity.toLocaleString("pt-BR")} {item.unit} · Estado: {item.productState}
                </p>
              </div>
              {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <p>{totalResponses} proposta{totalResponses === 1 ? "" : "s"} recebida{totalResponses === 1 ? "" : "s"}</p>
        {demand.notes && <p>{demand.notes}</p>}
      </div>
      {children}
    </article>
  );
}

function ResponseSummary({ response, action }: { response: DemandResponse; action?: React.ReactNode }) {
  const total = useMemo(
    () => response.items.filter((item) => item.canSupply).reduce((sum, item) => sum + item.price, 0),
    [response.items],
  );
  return (
    <div className="rounded-xl border border-border bg-canvas p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-brand-900">{response.producerName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {response.status} · Proposta total R$ {total.toFixed(2)}
          </p>
        </div>
        {action}
      </div>
      <ul className="mt-3 space-y-2 text-sm text-brand-900">
        {response.items
          .filter((item) => item.canSupply)
          .map((item) => {
            const unitPrice = item.quantity > 0 ? item.price / item.quantity : item.price;
            return (
              <li key={item.id}>
                <span className="font-semibold">{item.productName}</span>: entrega{" "}
                {item.quantity.toLocaleString("pt-BR")} {item.unit} por R$ {item.price.toFixed(2)}
                <span className="text-muted-foreground"> · equivalente R$ {unitPrice.toFixed(2)}/{item.unit}</span>
              </li>
            );
          })}
      </ul>
      {response.notes && <p className="mt-3 text-xs text-muted-foreground">{response.notes}</p>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border px-3 py-2 text-left transition hover:border-leaf-500 hover:bg-surface-brand-soft ${
        active
          ? "border-leaf-500 bg-surface-brand-soft ring-2 ring-leaf-200"
          : "border-border bg-canvas"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-brand-900">{value}</p>
    </button>
  );
}

function demandTitle(demand: DemandRequest) {
  const firstItem = demand.items[0];
  if (!firstItem) return "Demanda sem produtos";
  if (demand.items.length === 1) {
    return `${firstItem.productName} - ${firstItem.quantity.toLocaleString("pt-BR")} ${firstItem.unit}`;
  }
  return `${demand.items.length} produtos solicitados`;
}

function demandSubtitle(demand: DemandRequest) {
  const productNames = demand.items.map((item) => item.productName).filter(Boolean);
  const productPreview = productNames.slice(0, 2).join(", ");
  const extra = productNames.length > 2 ? ` e mais ${productNames.length - 2}` : "";
  return `Pedido por ${demand.buyerName}${productPreview ? ` · ${productPreview}${extra}` : ""}`;
}

function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-brand-900">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Panel({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-xs sm:p-6">
      <h2 className="inline-flex items-center gap-2 text-base font-semibold text-brand-900">
        <Icon className="h-4 w-4 text-leaf-700" />
        {title}
      </h2>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Alert({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-xl px-4 py-3 text-sm font-semibold ${
        tone === "success"
          ? "border border-leaf-200 bg-leaf-50 text-brand-900"
          : "border border-[var(--color-error-bg)] bg-[var(--color-error-bg)] text-[var(--color-error-fg)]"
      }`}
    >
      {children}
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-8 text-center">
      <ShoppingBag className="mx-auto h-10 w-10 text-leaf-700" />
      <h3 className="mt-4 text-base font-semibold text-brand-900">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function parseDecimal(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string) {
  if (!value) return "A combinar";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}
