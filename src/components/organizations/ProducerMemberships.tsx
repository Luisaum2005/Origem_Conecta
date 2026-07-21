import {
  deactivateMembership,
  requestMembership,
  respondInvite,
  searchOrganizations,
  useMemberships,
  type OrganizationSearchResult,
} from "@/lib/organization-memberships";
import { Building2, Check, Search, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function ProducerMemberships() {
  const { memberships, loading, refresh } = useMemberships();
  const [organizations, setOrganizations] = useState<OrganizationSearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmExit, setConfirmExit] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        void searchOrganizations(query)
          .then(setOrganizations)
          .catch(() => setOrganizations([])),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [query]);
  const act = async (id: string, action: () => Promise<unknown>, message: string) => {
    setBusy(id);
    try {
      await action();
      toast.success(message);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setBusy("");
    }
  };
  const invites = memberships.filter((m) => m.status === "invited");
  const linkedIds = new Set(
    memberships
      .filter((m) => ["pending", "active", "invited"].includes(m.status))
      .map((m) => m.organizationId),
  );
  return (
    <section className="mt-6 rounded-2xl border border-border bg-white p-5 shadow-xs sm:p-6">
      <h2 className="inline-flex items-center gap-2 font-semibold text-brand-900">
        <Building2 className="h-5 w-5 text-leaf-700" />
        Cooperativas e associações
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Solicite vínculo ou responda aos convites recebidos.
      </p>
      {invites.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase text-orange-700">Convites</p>
          <ul className="mt-2 space-y-2">
            {invites.map((item) => (
              <li key={item.id} className="rounded-xl bg-orange-50 p-3">
                <p className="font-semibold text-brand-900">{item.organizationName}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={busy === item.id}
                    onClick={() =>
                      void act(item.id, () => respondInvite(item.id, true), "Convite aceito.")
                    }
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-leaf-600 text-xs font-semibold text-white"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Aceitar
                  </button>
                  <button
                    disabled={busy === item.id}
                    onClick={() =>
                      void act(item.id, () => respondInvite(item.id, false), "Convite recusado.")
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
        </div>
      )}
      <div className="mt-5 relative">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou CNPJ"
          className="h-11 w-full rounded-xl border border-border pl-10 pr-3 text-sm"
        />
      </div>
      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando vínculos...</p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {organizations.map((org) => {
            const membership = memberships.find((item) => item.organizationId === org.id);
            const canRequestAgain =
              membership && ["rejected", "inactive"].includes(membership.status);
            return (
              <li
                key={org.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-brand-900">{org.tradeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {org.city}/{org.state} ·{" "}
                    {org.type === "cooperativa" ? "Cooperativa" : "Associação"}
                  </p>
                </div>
                {membership && !canRequestAgain ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700">
                      {statusLabel(membership.status)}
                    </span>
                    {membership.status === "active" && (
                      <button
                        disabled={busy === membership.id}
                        onClick={() => setConfirmExit({ id: membership.id, name: org.tradeName })}
                        className="h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 disabled:opacity-50"
                      >
                        Sair
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    disabled={busy === org.id || linkedIds.has(org.id)}
                    onClick={() =>
                      void act(org.id, () => requestMembership(org.id), "Solicitação enviada.")
                    }
                    className="h-9 rounded-lg border border-leaf-500 px-3 text-xs font-semibold text-brand-900 disabled:opacity-50"
                  >
                    {canRequestAgain ? "Solicitar novamente" : "Solicitar vínculo"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <AlertDialog
        open={Boolean(confirmExit)}
        onOpenChange={(open) => !open && setConfirmExit(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair de {confirmExit?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Você deixará de comercializar pelo CNPJ desta organização.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar associado</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmExit) return;
                void act(
                  confirmExit.id,
                  () => deactivateMembership(confirmExit.id),
                  "Vínculo encerrado.",
                );
                setConfirmExit(null);
              }}
              className="bg-red-700 text-white hover:bg-red-800"
            >
              Sair da organização
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
function statusLabel(status: string) {
  return (
    (
      {
        pending: "Solicitação pendente",
        active: "Associado",
        invited: "Convite recebido",
        rejected: "Não aprovado",
        inactive: "Inativo",
      } as Record<string, string>
    )[status] ?? status
  );
}
