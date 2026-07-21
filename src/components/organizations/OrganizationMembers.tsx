import {
  deactivateMembership,
  inviteProducer,
  reviewMembership,
  setCommercialPermission,
  useMemberships,
} from "@/lib/organization-memberships";
import { Check, MailPlus, UserCheck, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

export function OrganizationMembers({ organizationId }: { organizationId: string }) {
  const { memberships, loading, error, refresh } = useMemberships(organizationId);
  const [busy, setBusy] = useState("");
  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    setBusy("invite");
    try {
      await inviteProducer(organizationId, email);
      toast.success("Convite enviado ao produtor.");
      event.currentTarget.reset();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível convidar.");
    } finally {
      setBusy("");
    }
  };
  const act = async (id: string, action: () => Promise<unknown>, success: string) => {
    setBusy(id);
    try {
      await action();
      toast.success(success);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
    } finally {
      setBusy("");
    }
  };
  const pending = memberships.filter((m) => m.status === "pending");
  const active = memberships.filter((m) => m.status === "active");
  return (
    <section className="mt-6 border-t border-border pt-5">
      <h3 className="font-semibold text-brand-900">Associados</h3>
      <form onSubmit={invite} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          name="email"
          type="email"
          required
          placeholder="E-mail do produtor cadastrado"
          className="h-11 min-w-0 flex-1 rounded-xl border border-border px-3 text-sm"
        />
        <button
          disabled={busy === "invite"}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          <MailPlus className="h-4 w-4" />
          Convidar
        </button>
      </form>
      {error && <p className="mt-3 text-xs text-[var(--color-error-fg)]">{error}</p>}
      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando associados...</p>
      ) : (
        <>
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Solicitações ({pending.length})
            </p>
            {pending.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {pending.map((member) => (
                  <li key={member.id} className="rounded-xl bg-canvas p-3">
                    <p className="text-sm font-semibold text-brand-900">
                      {member.producerName} · {member.propertyName}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.producerEmail}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        disabled={busy === member.id}
                        onClick={() =>
                          void act(
                            member.id,
                            () => reviewMembership(member.id, true),
                            "Associado aprovado.",
                          )
                        }
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-leaf-600 text-xs font-semibold text-white"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Aprovar
                      </button>
                      <button
                        disabled={busy === member.id}
                        onClick={() =>
                          void act(
                            member.id,
                            () => reviewMembership(member.id, false),
                            "Solicitação recusada.",
                          )
                        }
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-border text-xs font-semibold"
                      >
                        <X className="h-3.5 w-3.5" />
                        Recusar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Ativos ({active.length})
            </p>
            {active.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhum associado ativo.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {active.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas p-3"
                  >
                    <div>
                      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-900">
                        <UserCheck className="h-4 w-4 text-leaf-700" />
                        {member.producerName}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.propertyName}</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-brand-900">
                      <input
                        type="checkbox"
                        checked={member.canSell}
                        disabled={busy === member.id}
                        onChange={(event) =>
                          void act(
                            member.id,
                            () => setCommercialPermission(member.id, event.target.checked),
                            "Permissão comercial atualizada.",
                          )
                        }
                        className="h-4 w-4 accent-[var(--color-brand-900)]"
                      />
                      Pode comercializar pela organização
                    </label>
                    <button
                      type="button"
                      disabled={busy === member.id}
                      onClick={() => {
                        if (window.confirm("Encerrar o vínculo deste associado?"))
                          void act(
                            member.id,
                            () => deactivateMembership(member.id),
                            "Vínculo encerrado.",
                          );
                      }}
                      className="text-xs font-semibold text-[var(--color-error-fg)] hover:underline"
                    >
                      Desvincular
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
