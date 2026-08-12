import {
  cancelInvitation,
  deactivateMembership,
  inviteProducer,
  reviewMembership,
  setCommercialPermission,
  useMemberships,
  type Membership,
} from "@/lib/organization-memberships";
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
import { BadgeCheck, Check, MailPlus, MapPin, Search, UserCheck, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

type MemberTab = "requests" | "invites" | "active" | "inactive";
type Confirmation = {
  id: string;
  name: string;
  kind: "deactivate" | "cancel-invite";
};

const tabs: Array<{ id: MemberTab; label: string }> = [
  { id: "requests", label: "Solicitações" },
  { id: "invites", label: "Convites enviados" },
  { id: "active", label: "Associados ativos" },
  { id: "inactive", label: "Inativos" },
];

export function OrganizationMembers({ organizationId }: { organizationId: string }) {
  const { memberships, loading, error, refresh } = useMemberships(organizationId);
  const [busy, setBusy] = useState("");
  const [activeTab, setActiveTab] = useState<MemberTab>("requests");
  const [search, setSearch] = useState("");
  const [memberNumbers, setMemberNumbers] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const groups = useMemo(
    () => ({
      requests: memberships.filter((member) => member.status === "pending"),
      invites: memberships.filter((member) => member.status === "invited"),
      active: memberships.filter((member) => member.status === "active"),
      inactive: memberships.filter(
        (member) => member.status === "inactive" || member.status === "rejected",
      ),
    }),
    [memberships],
  );
  const visibleMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return groups[activeTab];
    return groups[activeTab].filter((member) =>
      [
        member.producerName,
        member.producerEmail,
        member.propertyName,
        member.location,
        ...member.products,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(query)),
    );
  }, [activeTab, groups, search]);

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    setBusy("invite");
    try {
      await inviteProducer(organizationId, email);
      toast.success("Convite enviado ao produtor.");
      event.currentTarget.reset();
      setActiveTab("invites");
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

  const confirmAction = () => {
    if (!confirmation) return;
    const current = confirmation;
    setConfirmation(null);
    if (current.kind === "cancel-invite") {
      void act(current.id, () => cancelInvitation(current.id), "Convite cancelado.");
    } else {
      void act(current.id, () => deactivateMembership(current.id), "Vínculo encerrado.");
    }
  };

  return (
    <section className="mt-6 border-t border-border pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-brand-900">Gestão de associados</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Convide produtores e controle quem pode publicar usando os dados da organização.
          </p>
        </div>
      </div>

      <form onSubmit={invite} className="mt-5 rounded-2xl bg-leaf-50 p-4">
        <label
          htmlFor={`invite-email-${organizationId}`}
          className="text-sm font-semibold text-brand-900"
        >
          Convidar produtor cadastrado
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Informe o mesmo e-mail usado pelo produtor na plataforma.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id={`invite-email-${organizationId}`}
            name="email"
            type="email"
            required
            placeholder="produtor@exemplo.com"
            className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-white px-3 text-base"
          />
          <button
            disabled={busy === "invite"}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <MailPlus className="h-5 w-5" />
            {busy === "invite" ? "Enviando..." : "Enviar convite"}
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
          Não foi possível carregar os associados. Tente recarregar a página.
        </p>
      )}

      <div className="mt-5 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2" role="tablist" aria-label="Situação dos associados">
          {tabs.map((tab) => {
            const selected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`members-panel-${organizationId}`}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
                  selected
                    ? "bg-brand-900 text-white"
                    : "border border-border bg-white text-brand-900"
                }`}
              >
                {tab.label} ({groups[tab.id].length})
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
        <label htmlFor={`member-search-${organizationId}`} className="sr-only">
          Buscar associado
        </label>
        <input
          id={`member-search-${organizationId}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, propriedade, local ou produto"
          className="h-12 w-full rounded-xl border border-border bg-white pl-10 pr-3 text-base"
        />
      </div>

      <div id={`members-panel-${organizationId}`} role="tabpanel" className="mt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-2xl bg-canvas" />
            ))}
          </div>
        ) : visibleMembers.length === 0 ? (
          <p className="rounded-2xl bg-canvas p-6 text-center text-sm text-muted-foreground">
            {search ? "Nenhum produtor corresponde à busca." : emptyMessage(activeTab)}
          </p>
        ) : (
          <ul className="space-y-3">
            {visibleMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                tab={activeTab}
                busy={busy === member.id}
                memberNumber={memberNumbers[member.id] ?? ""}
                onMemberNumberChange={(value) =>
                  setMemberNumbers((current) => ({ ...current, [member.id]: value }))
                }
                onAct={act}
                onConfirm={setConfirmation}
              />
            ))}
          </ul>
        )}
      </div>

      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => !open && setConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.kind === "cancel-invite" ? "Cancelar convite" : "Desvincular produtor"}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.kind === "cancel-invite"
                ? `O convite enviado para ${confirmation.name} será cancelado.`
                : `${confirmation?.name} deixará de publicar usando os dados da organização. Os produtos ativos vinculados serão pausados.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className="bg-red-700 text-white hover:bg-red-800"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function MemberCard({
  member,
  tab,
  busy,
  memberNumber,
  onMemberNumberChange,
  onAct,
  onConfirm,
}: {
  member: Membership;
  tab: MemberTab;
  busy: boolean;
  memberNumber: string;
  onMemberNumberChange: (value: string) => void;
  onAct: (id: string, action: () => Promise<unknown>, success: string) => Promise<void>;
  onConfirm: (confirmation: Confirmation) => void;
}) {
  return (
    <li className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold text-brand-900">
            <UserCheck className="h-5 w-5 shrink-0 text-leaf-700" /> {member.producerName}
          </p>
          <p className="mt-1 text-sm font-medium text-brand-900">{member.propertyName}</p>
          <p className="mt-1 break-all text-sm text-muted-foreground">{member.producerEmail}</p>
          {member.location && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {member.location}
            </p>
          )}
        </div>
        <StatusBadge member={member} />
      </div>

      {member.products.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Produtos informados
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {member.products.slice(0, 8).map((product) => (
              <span
                key={product}
                className="rounded-full bg-leaf-100 px-3 py-1 text-xs font-semibold text-brand-900"
              >
                {product}
              </span>
            ))}
          </div>
        </div>
      )}

      {tab === "requests" && (
        <div className="mt-4 border-t border-border pt-4">
          <label
            className="text-sm font-semibold text-brand-900"
            htmlFor={`member-number-${member.id}`}
          >
            Número de associado{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id={`member-number-${member.id}`}
            value={memberNumber}
            onChange={(event) => onMemberNumberChange(event.target.value)}
            placeholder="Ex.: 0125"
            className="mt-2 h-11 w-full rounded-xl border border-border px-3 text-base sm:max-w-xs"
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void onAct(
                  member.id,
                  () => reviewMembership(member.id, true, memberNumber),
                  "Associado aprovado.",
                )
              }
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-leaf-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Aprovar vínculo
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void onAct(
                  member.id,
                  () => reviewMembership(member.id, false),
                  "Solicitação recusada.",
                )
              }
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-brand-900 disabled:opacity-50"
            >
              <X className="h-4 w-4" /> Recusar
            </button>
          </div>
        </div>
      )}

      {tab === "invites" && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onConfirm({ id: member.id, name: member.producerName, kind: "cancel-invite" })
          }
          className="mt-4 min-h-11 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:opacity-50"
        >
          Cancelar convite
        </button>
      )}

      {tab === "active" && (
        <div className="mt-4 border-t border-border pt-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-canvas p-3">
            <input
              type="checkbox"
              checked={member.canSell}
              disabled={busy}
              onChange={(event) =>
                void onAct(
                  member.id,
                  () => setCommercialPermission(member.id, event.target.checked),
                  event.target.checked
                    ? "Produtor autorizado a publicar."
                    : "Autorização removida.",
                )
              }
              className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-brand-900)]"
            />
            <span>
              <span className="block text-sm font-semibold text-brand-900">
                Pode publicar usando os dados da organização
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                Ao ativar, este produtor pode publicar produtos com o CNPJ da organização e conduzir
                as negociações dessas publicações.
              </span>
            </span>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onConfirm({ id: member.id, name: member.producerName, kind: "deactivate" })
            }
            className="mt-3 min-h-11 rounded-xl px-2 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            Desvincular produtor
          </button>
        </div>
      )}

      {tab === "inactive" && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void onAct(
              member.id,
              () => inviteProducer(member.organizationId, member.producerEmail),
              "Novo convite enviado.",
            )
          }
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-brand-900 disabled:opacity-50"
        >
          <MailPlus className="h-4 w-4" /> Convidar novamente
        </button>
      )}
    </li>
  );
}

function StatusBadge({ member }: { member: Membership }) {
  const config = member.canSell
    ? { label: "Autorizado a publicar", className: "bg-green-100 text-green-800", icon: BadgeCheck }
    : member.status === "active"
      ? { label: "Vínculo ativo", className: "bg-leaf-100 text-brand-900", icon: UserCheck }
      : {
          label: statusLabel(member.status),
          className: "bg-secondary text-brand-900",
          icon: UserCheck,
        };
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" /> {config.label}
    </span>
  );
}

function statusLabel(status: Membership["status"]) {
  return {
    invited: "Convite enviado",
    pending: "Aguardando análise",
    active: "Ativo",
    rejected: "Solicitação recusada",
    inactive: "Vínculo inativo",
  }[status];
}

function emptyMessage(tab: MemberTab) {
  return {
    requests: "Nenhuma solicitação aguardando análise.",
    invites: "Nenhum convite aguardando resposta.",
    active: "Nenhum associado ativo nesta organização.",
    inactive: "Nenhum vínculo inativo.",
  }[tab];
}
