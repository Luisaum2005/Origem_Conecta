import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, SquarePen } from "@/components/mobile/icons";
import { useEffect, useMemo, useState } from "react";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { Sheet } from "@/components/mobile/Sheet";
import { useAuth } from "@/lib/auth";
import {
  getUserConversations,
  subscribeToConversations,
  type SavedConversation,
} from "@/lib/chats";
import { initials, relativeDay } from "@/lib/format";

export const Route = createFileRoute("/chats")({
  component: () => (
    <RequireProfile allowed={["comprador", "produtor", "admin"]}>
      <ChatsList />
    </RequireProfile>
  ),
});

type Filter = "all" | "unread" | "orders" | "demands";

const CHIP_STYLE = { height: "22px", fontSize: "11px", padding: "0 8px" };

/** Cor do chip pelo status do pedido (mesmas cores dos cards de solicitação). */
function orderChip(status?: string) {
  const value = (status ?? "").toLowerCase();
  if (value.includes("cancel")) return "m-st-cancelado";
  if (value.includes("entregue") || value.includes("conclu")) return "m-st-entregue";
  if (value.includes("entrega") || value.includes("saiu")) return "m-st-entrega";
  if (value.includes("separ") || value.includes("confirm")) return "m-st-separacao";
  return "m-st-recebido";
}

function displayDemandId(id: string) {
  return /^DEM-/i.test(id) ? id : `DEM-${id.slice(-4).toUpperCase()}`;
}

function lastTime(value: string) {
  const date = new Date(value);
  if (new Date().toDateString() === date.toDateString())
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return relativeDay(value, false, true);
}

function ChatsList() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const buyer = profile?.tipo === "comprador";

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    const load = () =>
      getUserConversations(profile.id, profile.tipo)
        .then((data) => {
          if (active) setConversations(data);
        })
        .catch((error) => console.error("Erro ao carregar conversas:", error))
        .finally(() => active && setLoading(false));
    void load();
    const unsubscribe = subscribeToConversations(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [profile]);

  const unread = conversations.filter((conv) => (conv.unreadCount ?? 0) > 0).length;
  const primaryContact = conversations[0]?.otherPartyName;
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return conversations.filter((conv) => {
      if (filter === "unread" && !(conv.unreadCount ?? 0)) return false;
      if (filter === "orders" && !conv.orderId) return false;
      if (filter === "demands" && !conv.demandId) return false;
      if (!term) return true;
      return [conv.otherPartyName, conv.lastMessageText, conv.orderId, conv.demandId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [conversations, filter, query]);

  const pills: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "Todas" },
    { key: "unread", label: "Não lidas", count: unread },
    { key: "orders", label: "Pedidos" },
    { key: "demands", label: "Demandas" },
  ];

  return (
    <>
      <Navbar />
      <div className={`m-screen ${buyer ? "m-s-08-conversas" : "m-s-p4-mensagens"}`}>
        <div className="m-status" />
        <div className="m-hd m-big">
          <h1>Mensagens</h1>
          <button
            type="button"
            className="m-round"
            aria-label="Nova conversa"
            onClick={() => setHelpOpen(true)}
          >
            <SquarePen className="lucide" aria-hidden />
          </button>
        </div>
        <div style={{ padding: "12px 20px 0" }}>
          <label className="m-search">
            <Search className="lucide" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={buyer ? "Buscar produtor ou pedido" : "Buscar comprador ou pedido"}
              aria-label="Buscar conversa"
            />
          </label>
        </div>
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
              {pill.count ? <span className="m-n">{pill.count}</span> : null}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="m-list m-card" aria-busy="true">
            {[1, 2, 3].map((n) => (
              <div key={n} className="m-cv m-skel">
                <span className="m-avatar m-l" />
                <div className="m-mid" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>{conversations.length ? "Nenhuma conversa aqui" : "Nenhuma conversa ainda"}</b>
              <span>
                {conversations.length
                  ? "Tente outro filtro ou busca."
                  : buyer
                    ? "Abra um produto e toque em Conversar com o produtor."
                    : "Os compradores aparecem aqui quando negociam com você."}
              </span>
            </div>
          </div>
        ) : (
          <div className="m-list m-card">
            {visible.map((conv) => {
              const count = conv.unreadCount ?? 0;
              const name = conv.otherPartyName ?? "Participante";
              const avatar = (
                <span className={`m-avatar${name === primaryContact ? "" : " m-l"}`}>
                  {initials(name)}
                </span>
              );
              return (
                <Link key={conv.id} to="/chat" search={{ id: conv.id }} className="m-cv">
                  {buyer ? <div className="m-avw">{avatar}</div> : avatar}
                  <div className="m-mid">
                    <div className="m-r1">
                      <b>{name}</b>
                      <span className="m-muted">{lastTime(conv.lastMessageAt)}</span>
                    </div>
                    {conv.orderId ? (
                      <span className={`m-chip ${orderChip(conv.orderStatus)}`} style={CHIP_STYLE}>
                        Pedido #{conv.orderId}
                      </span>
                    ) : conv.demandId ? (
                      <span
                        className={`m-chip ${conv.demandUrgency === "urgente" ? "m-st-cancelado" : "m-st-separacao"}`}
                        style={CHIP_STYLE}
                      >
                        Demanda #{displayDemandId(conv.demandId)}
                      </span>
                    ) : (
                      <span className="m-chip m-leaf" style={CHIP_STYLE}>
                        Direto
                      </span>
                    )}
                    <div className="m-r2">
                      <span className={count ? "m-strong" : "m-muted"}>
                        {conv.lastMessageText ?? "Conversa iniciada"}
                      </span>
                      {count > 0 && <span className="m-un">{count}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Sheet
        open={helpOpen}
        title="Nova conversa"
        onClose={() => setHelpOpen(false)}
        footer={
          <button
            type="button"
            className="m-btn m-primary"
            onClick={() => {
              setHelpOpen(false);
              void navigate({ to: buyer ? "/portfolio" : "/demands" });
            }}
          >
            {buyer ? "Ver portfólio" : "Ver demandas"}
          </button>
        }
      >
        <p className="m-note">
          {buyer
            ? "As conversas começam a partir de um produto, pedido ou demanda. Abra um produto e toque em “Conversar com o produtor”."
            : "As conversas começam quando um comprador negocia com você ou quando você responde uma demanda."}
        </p>
      </Sheet>
    </>
  );
}
