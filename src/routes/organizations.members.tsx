import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Search, Sprout, UserPlus, X } from "@/components/mobile/icons";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { Sheet } from "@/components/mobile/Sheet";
import { initials } from "@/lib/format";
import {
  cancelInvitation,
  deactivateMembership,
  inviteProducer,
  type Membership,
  reviewMembership,
  setCommercialPermission,
  updateMemberNumber,
  useMemberships,
} from "@/lib/organization-memberships";
import { useOrganizations } from "@/lib/organizations";

export const Route = createFileRoute("/organizations/members")({
  component: () => (
    <RequireProfile roles={["gestor_organizacao"]}>
      <OrganizationMembersPage />
    </RequireProfile>
  ),
});

type Tab = "active" | "pending" | "invited";

function since(value: string) {
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 864e5));
  return days === 0 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`;
}

function OrganizationMembersPage() {
  const { organizations, loading: orgLoading, error: orgError } = useOrganizations();
  const organization = organizations[0];
  const { memberships, loading, error, refresh } = useMemberships(organization?.id);
  const [tab, setTab] = useState<Tab | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<Membership | null>(null);
  const [memberNumber, setMemberNumber] = useState("");

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const match = (member: Membership) =>
      !term ||
      [member.producerName, member.propertyName, member.location ?? "", ...member.products]
        .join(" ")
        .toLowerCase()
        .includes(term);
    return {
      active: memberships.filter((member) => member.status === "active" && match(member)),
      pending: memberships.filter((member) => member.status === "pending" && match(member)),
      invited: memberships.filter((member) => member.status === "invited" && match(member)),
    };
  }, [memberships, query]);
  const current: Tab = tab ?? (groups.pending.length ? "pending" : "active");

  const act = async (id: string, action: () => Promise<void>, message: string) => {
    setBusy(id);
    try {
      await action();
      toast.success(message);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
    } finally {
      setBusy("");
    }
  };

  const activeList = (members: Membership[]) => (
    <div className="m-mems m-card">
      {members.map((member) => (
        <div key={member.id} className="m-mm">
          <button
            type="button"
            className="m-avatar m-l"
            style={{ width: "44px", height: "44px" }}
            onClick={() => {
              setSelected(member);
              setMemberNumber(member.memberNumber ?? "");
            }}
            aria-label={`Detalhes de ${member.propertyName}`}
          >
            {initials(member.propertyName)}
          </button>
          <div>
            <b>{member.propertyName}</b>
            <span>
              {member.producerName.split(" ").slice(0, 2).join(" ")} ·{" "}
              {member.activeProductsCount
                ? `${member.activeProductsCount} produtos`
                : "sem produtos"}
            </span>
          </div>
          <div className="m-cs">
            <button
              type="button"
              role="switch"
              aria-checked={member.canSell}
              aria-label={`${member.propertyName} pode vender pela organização`}
              className={`m-sw${member.canSell ? " m-on" : ""}`}
              disabled={busy === member.id}
              onClick={() =>
                void act(
                  member.id,
                  () => setCommercialPermission(member.id, !member.canSell),
                  member.canSell ? "Venda pela organização desligada" : "Venda liberada",
                )
              }
            >
              <i />
            </button>
            <em>{member.canSell ? "Vende" : "Não vende"}</em>
          </div>
        </div>
      ))}
    </div>
  );

  const pills: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: "Ativos", count: groups.active.length },
    { key: "pending", label: "Pendentes", count: groups.pending.length },
    { key: "invited", label: "Convidados", count: groups.invited.length },
  ];

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-c2-associados">
        <div className="m-status" />
        <div className="m-hd m-big">
          <h1>Associados</h1>
          <button
            type="button"
            className="m-round"
            aria-label={searching ? "Fechar busca" : "Buscar associado"}
            onClick={() => {
              setSearching((value) => !value);
              setQuery("");
            }}
          >
            {searching ? (
              <X className="lucide" aria-hidden />
            ) : (
              <Search className="lucide" aria-hidden />
            )}
          </button>
        </div>
        {searching && (
          <div style={{ padding: "14px 20px 0" }}>
            <label className="m-search">
              <Search className="lucide" aria-hidden />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome, propriedade ou produto"
                aria-label="Buscar associado"
              />
            </label>
          </div>
        )}
        <div className="m-cats" role="tablist">
          {pills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              role="tab"
              aria-selected={current === pill.key}
              className={`m-pill${current === pill.key ? " m-on" : ""}`}
              onClick={() => setTab(pill.key)}
            >
              {pill.label}
              {pill.count > 0 && <span className="m-n">{pill.count}</span>}
            </button>
          ))}
        </div>

        {(orgError || error) && (
          <div className="m-pad">
            <div className="m-card m-alert" role="alert">
              <span>{orgError || error}</span>
            </div>
          </div>
        )}
        {(orgLoading || loading) && memberships.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <span>Carregando associados...</span>
            </div>
          </div>
        ) : current === "pending" ? (
          <>
            {groups.pending.length === 0 && (
              <div className="m-pad">
                <div className="m-card m-empty">
                  <b>Nenhuma adesão pendente</b>
                  <span>Quando um produtor pedir para entrar, ele aparece aqui.</span>
                </div>
              </div>
            )}
            {groups.pending.map((member) => (
              <div key={member.id} className="m-pc m-card">
                <div className="m-t">
                  <span className="m-avatar" style={{ width: "48px", height: "48px" }}>
                    {initials(member.producerName)}
                  </span>
                  <div>
                    <b>{member.producerName}</b>
                    <span>
                      {member.propertyName}
                      {member.location ? ` · ${member.location}` : ""}
                    </span>
                    <span
                      className="m-chip m-st-separacao m-st-dot"
                      style={{ marginTop: "6px", height: "22px", fontSize: "11px" }}
                    >
                      Pediu adesão {since(member.createdAt)}
                    </span>
                  </div>
                </div>
                {member.products.length > 0 && (
                  <div className="m-info">
                    <span>
                      <Sprout className="lucide" aria-hidden />
                      {member.products
                        .slice(0, 3)
                        .join(", ")
                        .toLowerCase()
                        .replace(/^./, (c) => c.toUpperCase())}
                    </span>
                  </div>
                )}
                <div className="m-acts">
                  {member.producerPhone && (
                    <a
                      href={`https://wa.me/55${member.producerPhone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="m-btn m-text m-sm"
                    >
                      <MessageCircle className="lucide" aria-hidden />
                      Conversar
                    </a>
                  )}
                  <button
                    type="button"
                    className="m-btn m-secondary m-sm"
                    disabled={busy === member.id}
                    onClick={() =>
                      void act(
                        member.id,
                        () => reviewMembership(member.id, false),
                        "Adesão recusada",
                      )
                    }
                  >
                    Recusar
                  </button>
                  <button
                    type="button"
                    className="m-btn m-primary m-sm"
                    disabled={busy === member.id}
                    onClick={() =>
                      void act(
                        member.id,
                        () => reviewMembership(member.id, true),
                        "Associado aprovado",
                      )
                    }
                  >
                    Aprovar
                  </button>
                </div>
              </div>
            ))}
            {groups.active.length > 0 && (
              <>
                <div className="m-lb">
                  <h3>Ativos recentes</h3>
                  <button type="button" onClick={() => setTab("active")}>
                    Ver {groups.active.length}
                  </button>
                </div>
                {activeList(groups.active.slice(0, 3))}
              </>
            )}
          </>
        ) : current === "active" ? (
          groups.active.length ? (
            <div style={{ paddingTop: 12 }}>{activeList(groups.active)}</div>
          ) : (
            <div className="m-pad">
              <div className="m-card m-empty">
                <b>Nenhum associado ativo</b>
                <span>Convide produtores da região para vender pela organização.</span>
              </div>
            </div>
          )
        ) : groups.invited.length ? (
          <div className="m-mems m-card" style={{ marginTop: 12 }}>
            {groups.invited.map((member) => (
              <div key={member.id} className="m-mm">
                <span className="m-avatar m-l" style={{ width: "44px", height: "44px" }}>
                  {initials(member.producerName || member.producerEmail)}
                </span>
                <div>
                  <b>{member.producerName || member.producerEmail}</b>
                  <span>Convite enviado {since(member.createdAt)}</span>
                </div>
                <button
                  type="button"
                  className="m-btn m-text m-sm"
                  disabled={busy === member.id}
                  onClick={() =>
                    void act(member.id, () => cancelInvitation(member.id), "Convite cancelado")
                  }
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>Nenhum convite pendente</b>
              <span>Toque em “Convidar” para chamar um produtor pelo e-mail.</span>
            </div>
          </div>
        )}

        {organization && (
          <button type="button" className="m-fab" onClick={() => setInviteOpen(true)}>
            <UserPlus className="lucide" aria-hidden />
            Convidar
          </button>
        )}
      </div>

      <Sheet
        open={inviteOpen}
        title="Convidar produtor"
        onClose={() => setInviteOpen(false)}
        footer={
          <button
            type="button"
            className="m-btn m-primary"
            disabled={!email.includes("@") || busy === "invite"}
            onClick={() =>
              organization &&
              void act(
                "invite",
                () => inviteProducer(organization.id, email.trim()),
                "Convite enviado",
              ).then(() => {
                setInviteOpen(false);
                setEmail("");
              })
            }
          >
            Enviar convite
          </button>
        }
      >
        <label className="m-field">
          <span>E-mail do produtor</span>
          <div className="m-in">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="produtor@exemplo.com"
            />
          </div>
          <small>O produtor recebe o convite e aceita pelo próprio perfil.</small>
        </label>
      </Sheet>

      <Sheet
        open={Boolean(selected)}
        title={selected?.propertyName ?? ""}
        onClose={() => setSelected(null)}
        footer={
          <button
            type="button"
            className="m-btn m-primary m-danger-btn"
            disabled={!selected || busy === selected.id}
            onClick={() =>
              selected &&
              void act(
                selected.id,
                () => deactivateMembership(selected.id),
                "Vínculo encerrado",
              ).then(() => setSelected(null))
            }
          >
            Encerrar vínculo
          </button>
        }
      >
        {selected && (
          <>
            <p className="m-note">
              {selected.producerName}
              {selected.location ? ` · ${selected.location}` : ""}
              {selected.producerPhone ? ` · ${selected.producerPhone}` : ""}
            </p>
            <label className="m-field">
              <span>Número de associado</span>
              <div className="m-in">
                <input
                  value={memberNumber}
                  onChange={(event) => setMemberNumber(event.target.value)}
                />
                <button
                  type="button"
                  className="m-btn m-text m-sm"
                  onClick={() =>
                    void act(
                      selected.id,
                      () => updateMemberNumber(selected.id, memberNumber),
                      "Número salvo",
                    )
                  }
                >
                  Salvar
                </button>
              </div>
            </label>
          </>
        )}
      </Sheet>
    </>
  );
}
