import { createFileRoute } from "@tanstack/react-router";
import { Eye, Search, X } from "@/components/mobile/icons";
import { useEffect, useMemo, useState } from "react";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { Sheet } from "@/components/mobile/Sheet";
import { initials, relativeDay } from "@/lib/format";
import {
  filterOrganizationConversations,
  listManagedOrganizationMessages,
  type OrganizationConversation,
  type OrganizationMessage,
  useOrganizationConversations,
} from "@/lib/organization-messages";

export const Route = createFileRoute("/organizations/messages")({
  component: () => (
    <RequireProfile roles={["gestor_organizacao"]}>
      <OrganizationMessagesPage />
    </RequireProfile>
  ),
});

type Filter = "all" | "organization" | "members";
const CHIP_STYLE = { height: "22px", fontSize: "11px", padding: "0 8px" };
const withOrganization = (conversation: OrganizationConversation) =>
  !conversation.orderId && conversation.producerName === conversation.organizationName;

function lastTime(value: string) {
  const date = new Date(value);
  if (new Date().toDateString() === date.toDateString())
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return relativeDay(value, false, true);
}

function OrganizationMessagesPage() {
  const { conversations, loading, error } = useOrganizationConversations();
  const [filter, setFilter] = useState<Filter>("all");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<OrganizationConversation | null>(null);
  const [messages, setMessages] = useState<OrganizationMessage[]>([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setMessages([]);
    listManagedOrganizationMessages(open.id)
      .then((list) => active && setMessages(list))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open]);

  const visible = useMemo(
    () =>
      filterOrganizationConversations(conversations, query, "all").filter((conversation) =>
        filter === "organization"
          ? withOrganization(conversation)
          : filter === "members"
            ? !withOrganization(conversation)
            : true,
      ),
    [conversations, filter, query],
  );
  const orgCount = conversations.filter(withOrganization).length;

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-c5-mensagens">
        <div className="m-status" />
        <div className="m-hd m-big">
          <h1>Mensagens</h1>
          <button
            type="button"
            className="m-round"
            aria-label={searching ? "Fechar busca" : "Buscar conversa"}
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
                placeholder="Comprador, associado ou pedido"
                aria-label="Buscar conversa"
              />
            </label>
          </div>
        )}
        <div className="m-note">
          <Eye className="lucide" aria-hidden />
          <span>Você acompanha as conversas dos associados sobre produtos da cooperativa.</span>
        </div>
        <div className="m-cats" role="tablist">
          {(
            [
              ["all", "Todas", 0],
              ["organization", "Com a cooperativa", orgCount],
              ["members", "Associados", 0],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`m-pill${filter === key ? " m-on" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
              {count > 0 && <span className="m-n">{count}</span>}
            </button>
          ))}
        </div>
        {error && (
          <div className="m-pad">
            <div className="m-card m-alert" role="alert">
              <span>{error}</span>
            </div>
          </div>
        )}
        {loading && conversations.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <span>Carregando conversas...</span>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>Nenhuma conversa aqui</b>
              <span>As conversas sobre produtos da organização aparecem nesta lista.</span>
            </div>
          </div>
        ) : (
          <div className="m-list2 m-card">
            {visible.map((conversation) => {
              const direct = withOrganization(conversation);
              const name = direct ? conversation.buyerName : conversation.producerName;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className="m-cv"
                  onClick={() => setOpen(conversation)}
                >
                  <span className={`m-avatar${direct ? "" : " m-l"}`}>{initials(name)}</span>
                  <div className="m-mid">
                    <div className="m-r1">
                      <b>{name}</b>
                      <span className="m-muted">{lastTime(conversation.lastMessageAt)}</span>
                    </div>
                    <span
                      className={`m-chip ${direct ? "m-leaf" : "m-st-recebido"}`}
                      style={CHIP_STYLE}
                    >
                      {direct
                        ? "Com a cooperativa"
                        : `Associado${conversation.orderId ? ` · Pedido #${conversation.orderId.replace(/^PED-/, "")}` : ""}`}
                    </span>
                    <div className="m-r2">
                      <span className="m-muted">
                        {conversation.lastMessageText ?? "Conversa iniciada"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Sheet
        open={Boolean(open)}
        title={open ? `${open.buyerName} · ${open.producerName}` : ""}
        onClose={() => setOpen(null)}
      >
        <div className="m-thread-ro">
          {messages.length === 0 && <p className="m-note">Carregando mensagens...</p>}
          {messages.map((message) => (
            <div key={message.id} className={`m-bubble m-${message.senderKind}`}>
              <b>{message.senderName}</b>
              <p>{message.body}</p>
              <time>{new Date(message.createdAt).toLocaleString("pt-BR")}</time>
            </div>
          ))}
        </div>
        <p className="m-note">Somente leitura: a conversa é entre comprador e associado.</p>
      </Sheet>
    </>
  );
}
