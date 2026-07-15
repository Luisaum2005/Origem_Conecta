import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { SupportButton } from "@/components/layout/SupportButton";
import { useAuth } from "@/lib/auth";
import {
  getUserConversations,
  subscribeToConversations,
  type SavedConversation,
} from "@/lib/chats";
import { formatOrderDate } from "@/lib/orders";
import { MessageSquare, Calendar, ShieldCheck, ArrowRight, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/chats")({
  component: () => (
    <RequireProfile allowed={["comprador", "produtor", "admin"]}>
      <ChatsList />
    </RequireProfile>
  ),
});

function ChatsList() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;

    async function load() {
      try {
        const data = await getUserConversations(profile!.id, profile!.tipo);
        if (active) {
          setConversations(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Erro ao carregar conversas:", err);
        if (active) setLoading(false);
      }
    }

    load();

    // Subscribe to realtime conversation updates (new messages, new chats)
    const unsubscribe = subscribeToConversations(() => {
      load();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [profile]);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[800px] px-4 py-8 pb-24 sm:px-6 sm:py-10 md:pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
              Negociações
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              Minhas Conversas
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tire dúvidas, negocie preços e combine entregas diretamente com o produtor ou
              comprador.
            </p>
          </div>
          <SupportButton compact />
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-24 animate-pulse rounded-2xl bg-white border border-border"
              />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white p-12 text-center shadow-xs">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-brand-900">
              Nenhuma negociação em andamento
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Abra um Pedido ou uma Demanda e clique no botão de conversar para iniciar uma
              negociação.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              {profile?.tipo === "comprador" && (
                <Link
                  to="/portfolio"
                  className="inline-flex h-11 items-center rounded-xl bg-brand-900 px-5 text-sm font-semibold text-white hover:bg-brand-800 transition-colors"
                >
                  Ver Portfólio
                </Link>
              )}
              <Link
                to="/demands"
                className="inline-flex h-11 items-center rounded-xl border border-border bg-white px-5 text-sm font-semibold text-brand-900 hover:bg-canvas transition-colors"
              >
                Ver Demandas
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => {
              const showBadge = (conv.unreadCount ?? 0) > 0;
              const hasOrder = !!conv.orderId;

              return (
                <Link
                  key={conv.id}
                  to="/chat"
                  search={{ id: conv.id }}
                  className="block rounded-2xl border border-border bg-white p-4 transition-all hover:border-leaf-500 hover:shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    {/* Chat avatar icon */}
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-brand-soft text-brand-850">
                      <MessageCircle className="h-6 w-6" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="truncate text-base font-bold text-brand-900">
                          {conv.otherPartyName}
                        </h2>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatOrderDate(conv.lastMessageAt)}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {conv.lastMessageText || (
                          <span className="italic">Nenhuma mensagem enviada</span>
                        )}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {hasOrder ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100">
                            Pedido #{conv.orderId}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-100">
                            Demanda #{conv.demandId?.substring(0, 8)}
                          </span>
                        )}
                        {conv.orderStatus && (
                          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-brand-900">
                            Status: {conv.orderStatus}
                          </span>
                        )}
                      </div>
                    </div>

                    {showBadge && (
                      <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-orange-600 px-1.5 text-xs font-bold leading-none text-white animate-pulse">
                        {conv.unreadCount}
                      </span>
                    )}

                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
