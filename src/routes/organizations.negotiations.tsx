import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, SlidersHorizontal } from "@/components/mobile/icons";
import { useMemo, useState } from "react";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { Sheet } from "@/components/mobile/Sheet";
import { relativeDay, unitLabel } from "@/lib/format";
import {
  getNegotiationProducers,
  type OrganizationNegotiation,
  type OrganizationNegotiationStatus,
  useOrganizationNegotiations,
} from "@/lib/organization-negotiations";

export const Route = createFileRoute("/organizations/negotiations")({
  component: () => (
    <RequireProfile roles={["gestor_organizacao"]}>
      <OrganizationNegotiationsPage />
    </RequireProfile>
  ),
});

const STATUS: Record<OrganizationNegotiationStatus, [string, string, number]> = {
  recebido: ["m-st-recebido", "Nova", 10],
  em_separacao: ["m-st-separacao", "Em separação", 45],
  em_entrega: ["m-st-entrega", "Em entrega", 75],
  entregue: ["m-st-entregue", "Entregue", 100],
  cancelado: ["m-st-cancelado", "Cancelada", 0],
};
type Tab = "open" | "done" | "canceled";

function OrganizationNegotiationsPage() {
  const { negotiations, loading, error } = useOrganizationNegotiations();
  const [tab, setTab] = useState<Tab>("open");
  const [oldestFirst, setOldestFirst] = useState(false);
  const [selected, setSelected] = useState<OrganizationNegotiation | null>(null);

  const open = negotiations.filter(
    (item) => item.status !== "entregue" && item.status !== "cancelado",
  );
  const done = negotiations.filter((item) => item.status === "entregue");
  const canceled = negotiations.filter((item) => item.status === "cancelado");
  const now = new Date();
  const thisMonth = negotiations.filter((item) => {
    const date = new Date(item.createdAt);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;
  const visible = useMemo(() => {
    const list = tab === "open" ? open : tab === "done" ? done : canceled;
    return [...list].sort(
      (a, b) =>
        (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) *
        (oldestFirst ? 1 : -1),
    );
  }, [canceled, done, oldestFirst, open, tab]);

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-c4-negociacoes">
        <div className="m-status" />
        <div className="m-hd m-big">
          <h1>Negociações</h1>
          <button
            type="button"
            className={`m-round${oldestFirst ? " m-active" : ""}`}
            aria-pressed={oldestFirst}
            aria-label="Mostrar as mais antigas primeiro"
            title="Mais antigas primeiro"
            onClick={() => setOldestFirst((value) => !value)}
          >
            <SlidersHorizontal className="lucide" aria-hidden />
          </button>
        </div>
        <div className="m-kpi" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <div className="m-card">
            <span>Novas</span>
            <b>{negotiations.filter((item) => item.status === "recebido").length}</b>
          </div>
          <div className="m-card">
            <span>Andamento</span>
            <b>
              {
                negotiations.filter(
                  (item) => item.status === "em_separacao" || item.status === "em_entrega",
                ).length
              }
            </b>
          </div>
          <div className="m-card">
            <span>No mês</span>
            <b>{thisMonth}</b>
          </div>
        </div>
        <div style={{ padding: "14px 20px 0" }}>
          <div className="m-seg" role="tablist">
            {(
              [
                ["open", "Abertas", open.length],
                ["done", "Concluídas", 0],
                ["canceled", "Canceladas", 0],
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
        {error && (
          <div className="m-pad">
            <div className="m-card m-alert" role="alert">
              <span>{error}</span>
            </div>
          </div>
        )}
        {loading && negotiations.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <span>Carregando negociações...</span>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>Nada por aqui</b>
              <span>As vendas dos associados em nome da organização aparecem nesta lista.</span>
            </div>
          </div>
        ) : (
          <div className="m-list" style={{ marginTop: "12px" }}>
            {visible.map((item) => {
              const [chip, label, progress] = STATUS[item.status];
              return (
                <button
                  key={item.orderId}
                  type="button"
                  className="m-oc m-card"
                  onClick={() => setSelected(item)}
                >
                  <div className="m-t">
                    <span className={`m-chip ${chip} m-st-dot`}>{label}</span>
                    <span className="m-muted">
                      #{item.orderId} · {relativeDay(item.createdAt, false)}
                    </span>
                  </div>
                  <div className="m-flow">
                    <div>
                      <span>Comprador</span>
                      <b>{item.buyerName}</b>
                    </div>
                    <ArrowRight className="lucide" aria-hidden />
                    <div>
                      <span>Associado</span>
                      <b>{getNegotiationProducers(item).join(", ")}</b>
                    </div>
                  </div>
                  {item.status !== "cancelado" && (
                    <div className="m-prog">
                      <i style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  <div className="m-ft">
                    <span className="m-muted">Itens</span>
                    <b className="m-price">
                      {item.items.length} {item.items.length === 1 ? "produto" : "produtos"}
                    </b>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Sheet
        open={Boolean(selected)}
        title={`Pedido #${selected?.orderId ?? ""}`}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <p className="m-note" style={{ marginTop: 0 }}>
              {selected.buyerName} → {getNegotiationProducers(selected).join(", ")}
              {selected.deliveryLabel ? ` · entrega ${selected.deliveryLabel}` : ""}
            </p>
            {selected.items.map((line, index) => (
              <div key={index} className="m-subcard">
                <div className="m-subcard-hd">
                  <span>
                    {line.productName}
                    <small className="m-sub2">
                      {line.quantity.toLocaleString("pt-BR")} {unitLabel(line.unit, line.quantity)}{" "}
                      · {line.producerName}
                    </small>
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </Sheet>
    </>
  );
}
