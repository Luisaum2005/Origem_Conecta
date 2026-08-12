import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import {
  filterOrganizationConversations,
  listManagedOrganizationMessages,
  useOrganizationConversations,
  type OrganizationConversation,
  type OrganizationMessage,
} from "@/lib/organization-messages";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, MessageSquare, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/organizations/messages")({
  component: () => (
    <RequireProfile roles={["gestor_organizacao"]}>
      <OrganizationMessagesPage />
    </RequireProfile>
  ),
});

function OrganizationMessagesPage() {
  const { conversations, loading, error, refresh } = useOrganizationConversations();
  const [search, setSearch] = useState("");
  const [organizationId, setOrganizationId] = useState("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [messages, setMessages] = useState<OrganizationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const transcriptRef = useRef<HTMLElement>(null);
  const organizations = useMemo(
    () =>
      Array.from(
        new Map(
          conversations.map((conversation) => [
            conversation.organizationId,
            conversation.organizationName,
          ]),
        ),
      ),
    [conversations],
  );
  const visibleConversations = useMemo(
    () => filterOrganizationConversations(conversations, search, organizationId),
    [conversations, organizationId, search],
  );
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId);

  useEffect(() => {
    if (selectedId || visibleConversations.length === 0) return;
    setSelectedId(visibleConversations[0].id);
  }, [selectedId, visibleConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let active = true;
    setMessagesLoading(true);
    setMessagesError("");
    void listManagedOrganizationMessages(selectedId)
      .then((result) => {
        if (active) setMessages(result);
      })
      .catch((queryError: unknown) => {
        if (!active) return;
        setMessagesError(
          queryError instanceof Error ? queryError.message : "Não foi possível abrir a conversa.",
        );
      })
      .finally(() => {
        if (active) setMessagesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selectConversation = (conversationId: string) => {
    setSelectedId(conversationId);
    window.setTimeout(() => transcriptRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  };

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-8 pb-24 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Gestão institucional
        </p>
        <h1 className="mt-2 text-3xl font-bold text-brand-900">Mensagens da organização</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Acompanhe conversas ligadas a negociações realizadas pela organização. O comprador e o
          produtor continuam sendo os responsáveis pelas respostas.
        </p>

        <aside className="mt-6 flex gap-3 rounded-2xl border border-leaf-200 bg-leaf-50 p-4 text-sm leading-relaxed text-brand-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-leaf-700" />
          <p>
            Esta área é somente para acompanhamento. Conversas pessoais do produtor e negociações
            feitas com dados próprios não são exibidas.
          </p>
        </aside>

        <section className="mt-6 rounded-2xl border border-border bg-white p-4 shadow-xs">
          <h2 className="font-bold text-brand-900">Localizar conversa</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_260px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              <label htmlFor="organization-message-search" className="sr-only">
                Buscar conversa
              </label>
              <input
                id="organization-message-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar comprador, produtor ou mensagem"
                className="h-12 w-full rounded-xl border border-border pl-10 pr-3 text-base"
              />
            </div>
            <label htmlFor="message-organization" className="sr-only">
              Organização
            </label>
            <select
              id="message-organization"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="h-12 rounded-xl border border-border bg-white px-3 text-base text-brand-900"
            >
              <option value="all">Todas as organizações</option>
              {organizations.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-800" role="alert">
            <p>Não foi possível carregar as mensagens da organização.</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-2 font-semibold underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[380px_1fr]">
          <section
            aria-label="Conversas institucionais"
            className="overflow-hidden rounded-2xl border border-border bg-white shadow-xs"
          >
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-bold text-brand-900">Conversas</h2>
              <p className="text-xs text-muted-foreground">
                {visibleConversations.length} encontrada
                {visibleConversations.length === 1 ? "" : "s"}
              </p>
            </div>
            {loading ? (
              <div className="space-y-3 p-4" aria-label="Carregando conversas">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-24 animate-pulse rounded-xl bg-secondary" />
                ))}
              </div>
            ) : visibleConversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="mx-auto h-9 w-9 text-leaf-700" />
                <p className="mt-3 font-semibold text-brand-900">Nenhuma conversa encontrada</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  As conversas aparecerão quando houver mensagens em negociações da organização.
                </p>
              </div>
            ) : (
              <ul className="max-h-[620px] divide-y divide-border overflow-y-auto">
                {visibleConversations.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    selected={conversation.id === selectedId}
                    onSelect={() => selectConversation(conversation.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section
            ref={transcriptRef}
            aria-label="Histórico da conversa"
            className="overflow-hidden rounded-2xl border border-border bg-white shadow-xs"
          >
            {!selectedConversation ? (
              <div className="p-10 text-center">
                <Eye className="mx-auto h-10 w-10 text-leaf-700" />
                <h2 className="mt-3 text-lg font-bold text-brand-900">Selecione uma conversa</h2>
                <p className="mt-1 text-sm text-muted-foreground">O histórico aparecerá aqui.</p>
              </div>
            ) : (
              <>
                <ConversationHeader conversation={selectedConversation} />
                <div className="min-h-72 space-y-4 bg-canvas p-4 sm:p-5">
                  {messagesLoading ? (
                    <div className="space-y-3" aria-label="Carregando mensagens">
                      {[1, 2, 3].map((item) => (
                        <div key={item} className="h-20 animate-pulse rounded-xl bg-white" />
                      ))}
                    </div>
                  ) : messagesError ? (
                    <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">
                      {messagesError}
                    </p>
                  ) : messages.length === 0 ? (
                    <p className="rounded-xl bg-white p-5 text-center text-sm text-muted-foreground">
                      Ainda não há mensagens nesta conversa.
                    </p>
                  ) : (
                    messages.map((message) => <MessageBubble key={message.id} message={message} />)
                  )}
                </div>
                <p className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
                  Modo de acompanhamento: responda pelo perfil do produtor participante.
                </p>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function ConversationRow({
  conversation,
  selected,
  onSelect,
}: {
  conversation: OrganizationConversation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`min-h-28 w-full px-4 py-3 text-left transition-colors ${selected ? "bg-leaf-50" : "hover:bg-secondary"}`}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="font-bold text-brand-900">{conversation.buyerName}</span>
          <time className="shrink-0 text-[11px] text-muted-foreground">
            {formatCompactDate(conversation.lastMessageAt)}
          </time>
        </span>
        <span className="mt-1 block text-xs font-semibold text-leaf-700">
          {conversation.organizationName} · {conversation.producerName}
        </span>
        <span className="mt-2 block truncate text-sm text-muted-foreground">
          {conversation.lastMessageText ?? "Conversa iniciada"}
        </span>
      </button>
    </li>
  );
}

function ConversationHeader({ conversation }: { conversation: OrganizationConversation }) {
  return (
    <header className="border-b border-border p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase text-leaf-700">
        {conversation.organizationName}
      </p>
      <h2 className="mt-1 text-xl font-bold text-brand-900">{conversation.buyerName}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Produtor responsável: {conversation.producerName}
      </p>
      {conversation.orderId && (
        <p className="mt-1 text-xs text-muted-foreground">
          Solicitação #{conversation.orderId.slice(0, 8).toUpperCase()}
        </p>
      )}
    </header>
  );
}

function MessageBubble({ message }: { message: OrganizationMessage }) {
  const producer = message.senderKind === "producer";
  return (
    <article
      className={`max-w-[88%] rounded-2xl border border-border bg-white p-3 shadow-xs ${producer ? "ml-auto" : "mr-auto"}`}
    >
      <p className="text-xs font-semibold text-leaf-700">{message.senderName}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-brand-900">
        {message.body}
      </p>
      <time className="mt-2 block text-[11px] text-muted-foreground">
        {new Date(message.createdAt).toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </time>
    </article>
  );
}

function formatCompactDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
