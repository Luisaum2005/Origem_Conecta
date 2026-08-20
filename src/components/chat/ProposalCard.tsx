import {
  effectiveProposalStatus,
  proposalTotal,
  type NegotiationProposal,
} from "@/lib/negotiation-proposals";
import { Check, Clock3, Handshake, RefreshCw, X } from "lucide-react";

const statusLabels = {
  pending: "Aguardando resposta",
  accepted: "Aceita · pedido criado",
  rejected: "Recusada",
  superseded: "Substituída",
  expired: "Expirada",
};

export function ProposalCard({
  proposal,
  currentProfileId,
  otherPartyName,
  busy,
  onAccept,
  onReject,
  onCounter,
}: {
  proposal: NegotiationProposal;
  currentProfileId?: string;
  otherPartyName?: string;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onCounter: () => void;
}) {
  const status = effectiveProposalStatus(proposal);
  const isMine = proposal.createdBy === currentProfileId;
  const canRespond = status === "pending" && !isMine;
  const canReplace = status === "pending";
  const expires = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(proposal.expiresAt));

  return (
    <article className="mx-auto w-full max-w-xl rounded-2xl border border-leaf-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-leaf-100 text-leaf-700">
            <Handshake className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
              Proposta comercial #{proposal.version}
            </p>
            <p className="mt-1 font-bold text-brand-900">
              {isMine ? "Você enviou esta proposta" : `${otherPartyName ?? "A outra parte"} enviou`}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-brand-900">
          {statusLabels[status]}
        </span>
      </div>

      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-canvas">
        {proposal.items.map((item) => (
          <li key={item.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm">
            <div>
              <p className="font-semibold text-brand-900">{item.productName}</p>
              <p className="text-xs text-muted-foreground">
                {item.quantity.toLocaleString("pt-BR")} {item.unit} · R$ {item.unitPrice.toFixed(2)}
                /{item.unit}
              </p>
              {item.sellerOrganizationName && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Comercialização: {item.sellerOrganizationName}
                </p>
              )}
            </div>
            <strong className="text-brand-900">R$ {item.lineTotal.toFixed(2)}</strong>
          </li>
        ))}
      </ul>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Pagamento</dt>
          <dd className="font-semibold text-brand-900">{proposal.paymentMethod}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Entrega/retirada</dt>
          <dd className="font-semibold text-brand-900">{proposal.deliveryMethod}</dd>
        </div>
        {proposal.deliveryAt && (
          <div>
            <dt className="text-xs text-muted-foreground">Data combinada</dt>
            <dd className="font-semibold text-brand-900">
              {new Date(proposal.deliveryAt).toLocaleString("pt-BR")}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="text-lg font-bold text-brand-900">
            R$ {proposalTotal(proposal).toFixed(2)}
          </dd>
        </div>
      </dl>
      {proposal.deliveryNotes && (
        <p className="mt-3 text-sm text-brand-900">
          <strong>Entrega:</strong> {proposal.deliveryNotes}
        </p>
      )}
      {proposal.notes && (
        <p className="mt-2 text-sm text-brand-900">
          <strong>Observações:</strong> {proposal.notes}
        </p>
      )}
      {status === "pending" && (
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" /> Válida até {expires}
        </p>
      )}

      {canRespond && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> Aceitar
          </button>
          <button
            type="button"
            onClick={onCounter}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-brand-900 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" /> Contraproposta
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" /> Recusar
          </button>
        </div>
      )}
      {canReplace && isMine && (
        <button
          type="button"
          onClick={onCounter}
          disabled={busy}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-brand-900 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" /> Substituir proposta
        </button>
      )}
    </article>
  );
}
