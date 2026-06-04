import { createFileRoute } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/auth";
import {
  type MarketReference,
  type MarketTrend,
  useMarketReferences,
} from "@/lib/market-references";
import { type QuoteRequest, type QuoteStatus, useQuoteRequests } from "@/lib/quote-requests";
import {
  CheckCircle2,
  ClipboardList,
  Minus,
  Send,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import React, { useMemo, useState } from "react";

export const Route = createFileRoute("/quotes")({
  component: () => (
    <RequireProfile>
      <Quotes />
    </RequireProfile>
  ),
});

function Quotes() {
  const { profile } = useAuth();
  const { quotes, addQuote, respondQuote, updateStatus } = useQuoteRequests();
  const { references, saveReference, removeReference } = useMarketReferences();

  const openQuotes = quotes.filter((quote) => quote.status === "Aberta");
  const answeredQuotes = quotes.filter((quote) => quote.status === "Respondida");
  const approvedQuotes = quotes.filter((quote) => quote.status === "Aprovada");

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-8 pb-24 sm:px-8 sm:py-10 md:pb-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Referências manuais CEASA, CONAB e CEPEA
        </p>
        <div className="mt-2">
          <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">Cotações</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {profile?.tipo === "produtor"
              ? "Responda solicitações abertas e acompanhe propostas enviadas."
              : profile?.tipo === "admin"
                ? "Acompanhe solicitações, respostas dos produtores e decisões dos compradores."
                : "Solicite cotações aos produtores e compare com referências de mercado cadastradas pelo admin."}
          </p>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Metric icon={ClipboardList} label="Solicitações" value={`${quotes.length}`} />
          <Metric icon={Send} label="Abertas" value={`${openQuotes.length}`} />
          <Metric
            icon={CheckCircle2}
            label={profile?.tipo === "admin" ? "Aprovadas" : "Aceitas"}
            value={`${profile?.tipo === "admin" ? approvedQuotes.length : answeredQuotes.length}`}
          />
        </section>

        {profile?.tipo === "produtor" ? (
          <ProducerQuotes quotes={quotes} producerName={profile.nome} respondQuote={respondQuote} />
        ) : profile?.tipo === "admin" ? (
          <AdminQuotes quotes={quotes} />
        ) : (
          <BuyerQuotes
            quotes={quotes}
            buyerName={profile?.nome ?? "Comprador"}
            addQuote={addQuote}
            updateStatus={updateStatus}
          />
        )}

        <MarketReferences
          editable={profile?.tipo === "admin"}
          references={references}
          saveReference={saveReference}
          removeReference={removeReference}
        />
      </main>
    </div>
  );
}

function BuyerQuotes({
  quotes,
  buyerName,
  addQuote,
  updateStatus,
}: {
  quotes: QuoteRequest[];
  buyerName: string;
  addQuote: ReturnType<typeof useQuoteRequests>["addQuote"];
  updateStatus: ReturnType<typeof useQuoteRequests>["updateStatus"];
}) {
  const [draft, setDraft] = useState({
    productName: "",
    quantity: "",
    unit: "kg",
    deliveryDate: "",
    targetPrice: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canSubmit = draft.productName && draft.quantity && draft.unit;

  const submitQuote = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      await addQuote({
        buyerName,
        productName: draft.productName,
        quantity: draft.quantity,
        unit: draft.unit,
        deliveryDate: draft.deliveryDate,
        targetPrice: draft.targetPrice,
        notes: draft.notes,
      });
      setDraft({
        productName: "",
        quantity: "",
        unit: "kg",
        deliveryDate: "",
        targetPrice: "",
        notes: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a solicitação.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id: string, status: QuoteStatus) => {
    setError("");
    try {
      await updateStatus(id, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a solicitação.");
    }
  };

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Panel title="Nova solicitação" icon={Send}>
        <div className="grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-brand-900">Produto</span>
            <input
              value={draft.productName}
              onChange={(event) => setDraft({ ...draft, productName: event.target.value })}
              placeholder="Digite o produto desejado"
              className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <TextInput
              label="Quantidade"
              value={draft.quantity}
              onChange={(quantity) => setDraft({ ...draft, quantity })}
              placeholder="50"
              type="number"
            />
            <TextInput
              label="Unidade"
              value={draft.unit}
              onChange={(unit) => setDraft({ ...draft, unit })}
              placeholder="kg"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Entrega desejada"
              value={draft.deliveryDate}
              onChange={(deliveryDate) => setDraft({ ...draft, deliveryDate })}
              type="date"
            />
            <TextInput
              label="Preço alvo"
              value={draft.targetPrice}
              onChange={(targetPrice) => setDraft({ ...draft, targetPrice })}
              placeholder="R$ 18,00"
            />
          </div>
          <label className="block">
            <span className="text-sm font-medium text-brand-900">Observações</span>
            <textarea
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              placeholder="Ex: entrega semanal, embalagem especifica, padrao de maturacao..."
              className="mt-2 min-h-[96px] w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
            />
          </label>
          {error && (
            <p className="rounded-xl bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={submitQuote}
            disabled={!canSubmit || saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-900 px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:bg-[var(--color-surface-disabled)] disabled:text-[var(--text-disabled)]"
          >
            <Send className="h-4 w-4" />
            {saving ? "Salvando..." : "Enviar solicitação"}
          </button>
        </div>
      </Panel>

      <Panel title="Minhas solicitações" icon={ClipboardList}>
        <QuoteList empty="Nenhuma solicitação enviada ainda.">
          {quotes.map((quote) => (
            <QuoteCard key={quote.id} quote={quote}>
              {quote.status === "Respondida" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void changeStatus(quote.id, "Aprovada")}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-leaf-600 bg-leaf-600 px-3 text-sm font-semibold text-white hover:bg-leaf-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => void changeStatus(quote.id, "Recusada")}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
                  >
                    <XCircle className="h-4 w-4 text-[var(--color-error-fg)]" />
                    Recusar
                  </button>
                </div>
              )}
            </QuoteCard>
          ))}
        </QuoteList>
      </Panel>
    </section>
  );
}

function ProducerQuotes({
  quotes,
  producerName,
  respondQuote,
}: {
  quotes: QuoteRequest[];
  producerName: string;
  respondQuote: ReturnType<typeof useQuoteRequests>["respondQuote"];
}) {
  const actionable = quotes.filter((quote) => quote.status === "Aberta");
  const history = quotes.filter((quote) => quote.status !== "Aberta");
  const [responses, setResponses] = useState<
    Record<string, { producerName: string; responsePrice: string; responseNotes: string }>
  >({});
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const sendResponse = async (
    id: string,
    response: { producerName: string; responsePrice: string; responseNotes: string },
  ) => {
    setSavingId(id);
    setError("");
    try {
      await respondQuote(id, response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aceitar a solicitação.");
    } finally {
      setSavingId("");
    }
  };

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Panel title="Solicitações abertas" icon={Send}>
        {error && (
          <p className="mb-4 rounded-xl bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]">
            {error}
          </p>
        )}
        <QuoteList empty="Nenhuma solicitação aberta no momento.">
          {actionable.map((quote) => {
            const response = responses[quote.id] ?? {
              producerName,
              responsePrice: "",
              responseNotes: "",
            };
            return (
              <QuoteCard key={quote.id} quote={quote}>
                <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[120px_1fr]">
                  <TextInput
                    label="Preço"
                    value={response.responsePrice}
                    onChange={(responsePrice) =>
                      setResponses((current) => ({
                        ...current,
                        [quote.id]: { ...response, responsePrice },
                      }))
                    }
                    placeholder="18.50"
                  />
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-medium text-brand-900">Observação</span>
                    <textarea
                      value={response.responseNotes}
                      onChange={(event) =>
                        setResponses((current) => ({
                          ...current,
                          [quote.id]: { ...response, responseNotes: event.target.value },
                        }))
                      }
                      placeholder="Condicoes, validade da proposta e disponibilidade..."
                      className="mt-2 min-h-[84px] w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void sendResponse(quote.id, response)}
                    disabled={!response.responsePrice || savingId === quote.id}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-leaf-600 px-4 text-sm font-semibold text-white hover:bg-leaf-700 disabled:bg-[var(--color-surface-disabled)] disabled:text-[var(--text-disabled)] sm:col-span-2 sm:w-fit"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {savingId === quote.id ? "Aceitando..." : "Aceitar solicitação"}
                  </button>
                </div>
              </QuoteCard>
            );
          })}
        </QuoteList>
      </Panel>

      <Panel title="Solicitações aceitas" icon={ClipboardList}>
        <QuoteList empty="As solicitações aceitas aparecem aqui.">
          {history.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} compact />
          ))}
        </QuoteList>
      </Panel>
    </section>
  );
}

function AdminQuotes({ quotes }: { quotes: QuoteRequest[] }) {
  return (
    <section className="mt-8">
      <Panel title="Monitoramento de solicitações" icon={ClipboardList}>
        <QuoteList empty="Nenhuma solicitação cadastrada ainda.">
          {quotes.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} compact />
          ))}
        </QuoteList>
      </Panel>
    </section>
  );
}

function QuoteList({ empty, children }: { empty: string; children: React.ReactNode }) {
  const childArray = useMemo(() => React.Children.toArray(children), [children]);
  if (!childArray.length) {
    return <p className="rounded-xl bg-canvas p-4 text-sm text-muted-foreground">{empty}</p>;
  }
  return <ul className="space-y-4">{childArray}</ul>;
}

function QuoteCard({
  quote,
  children,
  compact = false,
}: {
  quote: QuoteRequest;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <li className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
            Solicitação #{quote.id}
          </p>
          <h3 className="mt-1 text-lg font-bold text-brand-900">{quote.productName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {quote.quantity} {quote.unit} - {quote.buyerName}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(quote.status)}`}
        >
          {quote.status}
        </span>
      </div>

      <dl
        className={`mt-4 grid gap-3 rounded-xl bg-canvas p-4 text-sm ${compact ? "" : "sm:grid-cols-3"}`}
      >
        <Mini label="Entrega" value={quote.deliveryDate || "A combinar"} />
        <Mini label="Preço alvo" value={quote.targetPrice || "Sem alvo"} />
        <Mini label="Observações" value={quote.notes || "Sem observações"} />
      </dl>

      {quote.status !== "Aberta" && (
        <div className="mt-4 rounded-xl border border-border bg-canvas p-4">
          <p className="text-sm font-semibold text-brand-900">
            {quote.producerName || "Produtor"} - R$ {Number(quote.responsePrice || 0).toFixed(2)}/
            {quote.unit}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {quote.responseNotes || "Sem detalhes adicionais."}
          </p>
        </div>
      )}

      {children}
    </li>
  );
}

function MarketReferences({
  editable,
  references,
  saveReference,
  removeReference,
}: {
  editable: boolean;
  references: MarketReference[];
  saveReference: (reference: MarketReference) => void;
  removeReference: (id: string) => void;
}) {
  const [draft, setDraft] = useState<MarketReference>({
    id: "",
    productName: "",
    unit: "kg",
    ceasa: "",
    conab: "",
    cepea: "",
    trend: "flat",
    variation: "",
    updatedAt: new Date().toISOString().slice(0, 10),
  });
  const canSave = draft.productName && draft.unit;

  const submit = () => {
    if (!canSave) return;
    saveReference(draft);
    setDraft({
      id: "",
      productName: "",
      unit: "kg",
      ceasa: "",
      conab: "",
      cepea: "",
      trend: "flat",
      variation: "",
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <section className="mt-8">
      <Panel title="Referencias de mercado" icon={TrendingUp}>
        <p className="mb-4 text-sm text-muted-foreground">
          Estes valores são informativos e devem ser atualizados manualmente pelo admin a partir das
          fontes CEASA/CEAGESP, CONAB e CEPEA.
        </p>
        {editable && (
          <div className="mb-5 rounded-2xl border border-border bg-canvas p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TextInput
                label="Produto"
                value={draft.productName}
                onChange={(productName) => setDraft({ ...draft, productName })}
                placeholder="Ex: Laranja Pera Rio"
              />
              <TextInput
                label="Unidade"
                value={draft.unit}
                onChange={(unit) => setDraft({ ...draft, unit })}
                placeholder="kg"
              />
              <TextInput
                label="CEASA/CEAGESP"
                value={draft.ceasa}
                onChange={(ceasa) => setDraft({ ...draft, ceasa })}
                placeholder="4.80"
              />
              <TextInput
                label="CONAB"
                value={draft.conab}
                onChange={(conab) => setDraft({ ...draft, conab })}
                placeholder="4.60"
              />
              <TextInput
                label="CEPEA"
                value={draft.cepea}
                onChange={(cepea) => setDraft({ ...draft, cepea })}
                placeholder="1280.25"
              />
              <TextInput
                label="Variação"
                value={draft.variation}
                onChange={(variation) => setDraft({ ...draft, variation })}
                placeholder="+1,2%"
              />
              <label className="block">
                <span className="text-sm font-medium text-brand-900">Tendência</span>
                <select
                  value={draft.trend}
                  onChange={(event) =>
                    setDraft({ ...draft, trend: event.target.value as MarketTrend })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
                >
                  <option value="flat">Estável</option>
                  <option value="up">Alta</option>
                  <option value="down">Queda</option>
                </select>
              </label>
              <button
                type="button"
                onClick={submit}
                disabled={!canSave}
                className="inline-flex h-11 items-center justify-center self-end rounded-xl bg-brand-900 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {draft.id ? "Salvar referencia" : "Adicionar referencia"}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-surface-subtle text-left">
                <th className="px-5 py-4 font-semibold text-brand-900">Produto</th>
                <th className="px-5 py-4 font-semibold text-brand-900">CEASA/CEAGESP</th>
                <th className="px-5 py-4 font-semibold text-brand-900">CONAB</th>
                <th className="px-5 py-4 font-semibold text-brand-900">CEPEA</th>
                <th className="px-5 py-4 font-semibold text-brand-900">Variação</th>
                {editable && (
                  <th className="px-5 py-4 text-right font-semibold text-brand-900">Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {references.map((row, index) => {
                const { Icon, color, bg, label } = trendMeta(row.trend);
                return (
                  <tr
                    key={row.id}
                    className={`border-t border-border ${index % 2 ? "bg-canvas" : "bg-white"}`}
                  >
                    <td className="px-5 py-4 font-medium text-brand-900">
                      {row.productName}
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        Atualizado em {row.updatedAt}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-brand-900">
                      {formatMarketPrice(row.ceasa, row.unit)}
                    </td>
                    <td className="px-5 py-4 text-brand-900">
                      {formatMarketPrice(row.conab, row.unit)}
                    </td>
                    <td className="px-5 py-4 text-brand-900">
                      {formatMarketPrice(row.cepea, row.unit)}
                    </td>
                    <td className={`px-5 py-4 font-semibold ${color}`}>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${bg}`}
                      >
                        <Icon className="h-4 w-4" />
                        {label} {row.variation}
                      </span>
                    </td>
                    {editable && (
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => setDraft(row)}
                            className="h-9 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-brand-900 hover:border-leaf-500"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => removeReference(row.id)}
                            className="h-9 rounded-lg border border-[var(--color-error-bg)] bg-white px-3 text-xs font-semibold text-[var(--color-error-fg)] hover:bg-[var(--color-error-bg)]"
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}

function formatMarketPrice(value: string, unit: string) {
  const price = Number(String(value || "").replace(",", "."));
  return price > 0 ? `R$ ${price.toFixed(2)}/${unit}` : "-";
}

function trendMeta(t: MarketTrend) {
  if (t === "up") {
    return {
      Icon: TrendingUp,
      color: "text-[var(--color-success-fg)]",
      bg: "bg-[var(--color-success-bg)]",
      label: "Alta",
    };
  }
  if (t === "down") {
    return {
      Icon: TrendingDown,
      color: "text-[var(--color-warning-fg)]",
      bg: "bg-[var(--color-warning-bg)]",
      label: "Queda",
    };
  }
  return { Icon: Minus, color: "text-muted-foreground", bg: "bg-surface-muted", label: "Estável" };
}

function statusClass(status: QuoteStatus) {
  if (status === "Aberta") return "bg-orange-100 text-orange-700";
  if (status === "Respondida") return "bg-[var(--color-info-bg)] text-[var(--color-info-fg)]";
  if (status === "Aprovada") return "bg-[var(--color-success-bg)] text-[var(--color-success-fg)]";
  return "bg-[var(--color-error-bg)] text-[var(--color-error-fg)]";
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-brand-900">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
      />
    </label>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-xs sm:p-6">
      <h2 className="inline-flex items-center gap-2 text-base font-semibold text-brand-900">
        <Icon className="h-4 w-4 text-leaf-700" />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-100 text-brand-700">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-brand-900">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-brand-900">{value}</dd>
    </div>
  );
}
