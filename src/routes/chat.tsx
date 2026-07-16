import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { SupportButton } from "@/components/layout/SupportButton";
import { useAuth } from "@/lib/auth";
import {
  getOrCreateConversation,
  getConversationMessages,
  sendMessage,
  markAsRead,
  subscribeToMessages,
  formatMessageTime,
  type SavedConversation,
  type SavedMessage,
} from "@/lib/chats";
import { getBuyerId, getProducerId, formatOrderDate } from "@/lib/orders";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Send,
  MessageCircle,
  AlertCircle,
  ShoppingBag,
  ClipboardList,
  Check,
  CheckCheck,
  MessageSquare,
} from "lucide-react";
import { getProduct } from "@/lib/catalog";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ChatSearch = {
  id?: string;
  orderId?: string;
  demandId?: string;
  buyerId?: string;
  producerId?: string;
  portfolioProductId?: string;
};

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): ChatSearch => {
    return {
      id: search.id as string | undefined,
      orderId: search.orderId as string | undefined,
      demandId: search.demandId as string | undefined,
      buyerId: search.buyerId as string | undefined,
      producerId: search.producerId as string | undefined,
      portfolioProductId: search.portfolioProductId as string | undefined,
    };
  },
  component: () => (
    <RequireProfile allowed={["comprador", "produtor", "admin"]}>
      <ChatRoom />
    </RequireProfile>
  ),
});

function ChatRoom() {
  const { profile, isSupabaseConfigured } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [conversation, setConversation] = useState<SavedConversation | null>(null);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const oldestMessageIdRef = useRef<string | null>(null);
  const isAtBottomRef = useRef(true);

  // Initialize conversation
  useEffect(() => {
    if (!profile?.id) return;
    let active = true;

    async function initialize() {
      setLoading(true);
      try {
        let conversationId = search.id;

        // If no direct ID but we have context, resolve or create the conversation
        if (!conversationId && (search.orderId || search.demandId || search.portfolioProductId)) {
          let buyerId = search.buyerId;
          let producerId = search.producerId;

          if (profile!.tipo === "comprador") {
            buyerId = (await getBuyerId(profile!.id)) ?? undefined;
          } else if (profile!.tipo === "produtor") {
            producerId = (await getProducerId(profile!.id)) ?? undefined;
          }

          if (!buyerId || !producerId) {
            throw new Error("Não foi possível identificar o comprador ou o produtor da conversa.");
          }

          const conv = await getOrCreateConversation({
            orderId: search.orderId,
            demandId: search.demandId,
            portfolioProductId: search.portfolioProductId,
            buyerId,
            producerId,
          });

          conversationId = conv.id;

          // Clean URL by navigating to the resolved ID
          if (active) {
            navigate({
              search: { id: conversationId },
              replace: true,
            });
            return;
          }
        }

        if (!conversationId) {
          throw new Error("Código de conversa inválido.");
        }

        // Fetch conversation details
        let convDetails: SavedConversation | null = null;
        if (supabase && isSupabaseConfigured) {
          const { data, error } = await supabase
            .from("conversations")
            .select(
              `
              id,
              order_id,
              demand_id,
              portfolio_product_id,
              conversation_context,
              buyer_id,
              producer_id,
              created_at,
              updated_at,
              last_message_at,
              orders (
                id,
                status,
                total
              ),
              demand_requests (
                id,
                buyer_name,
                delivery_date,
                notes
              ),
              buyers (
                nome_empresa
              ),
              producers (
                nome_propriedade,
                responsavel
              )
            `,
            )
            .eq("id", conversationId)
            .single();

          if (error) throw error;
          if (data) {
            interface ChatData {
              id: string;
              order_id: string | null;
              demand_id: string | null;
              portfolio_product_id: string | null;
              conversation_context: string | null;
              buyer_id: string;
              producer_id: string;
              created_at: string;
              updated_at: string;
              last_message_at: string;
              orders: {
                status: string | null;
                total: number | string | null;
              } | null;
              buyers: {
                nome_empresa: string | null;
              } | null;
              producers: {
                nome_propriedade: string | null;
                responsavel: string | null;
              } | null;
            }
            const chatData = data as unknown as ChatData;
            let otherParty = "Participante";
            if (profile!.tipo === "comprador") {
              otherParty =
                chatData.producers?.nome_propriedade ||
                chatData.producers?.responsavel ||
                "Produtor";
            } else {
              otherParty = chatData.buyers?.nome_empresa || "Comprador";
            }

            convDetails = {
              id: chatData.id,
              orderId: chatData.order_id || undefined,
              demandId: chatData.demand_id || undefined,
              portfolioProductId: chatData.portfolio_product_id || undefined,
              conversationContext: (chatData.conversation_context || "portfolio") as
                | "portfolio"
                | "demand"
                | "order",
              buyerId: chatData.buyer_id,
              producerId: chatData.producer_id,
              createdAt: chatData.created_at,
              updatedAt: chatData.updated_at,
              lastMessageAt: chatData.last_message_at,
              otherPartyName: otherParty,
              orderStatus: chatData.orders?.status || undefined,
              orderTotal: chatData.orders?.total ? Number(chatData.orders.total) : undefined,
            };
          }
        } else {
          // Local fallback details
          const { getUserConversations } = await import("@/lib/chats");
          const userConvs = await getUserConversations(profile!.id, profile!.tipo);
          convDetails = userConvs.find((c) => c.id === conversationId) || null;
        }

        if (!convDetails) {
          throw new Error("Conversa não encontrada.");
        }

        if (active) {
          setConversation(convDetails);

          // Fetch initial page of messages
          const msgs = await getConversationMessages(conversationId, 20);
          setMessages(msgs);
          setHasMore(msgs.length >= 20);
          if (msgs.length > 0) {
            oldestMessageIdRef.current = msgs[0].id;
          }

          // Mark messages as read
          await markAsRead(conversationId, profile!.id);

          setLoading(false);
          // Scroll to bottom
          setTimeout(scrollToBottom, 50);
        }
      } catch (err) {
        console.error("Erro ao abrir chat:", err);
        toast.error(err instanceof Error ? err.message : "Não foi possível carregar o chat.");
        if (active) {
          setLoading(false);
          navigate({ to: "/chats" });
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [
    search.id,
    search.orderId,
    search.demandId,
    search.buyerId,
    search.producerId,
    search.portfolioProductId,
    profile,
    isSupabaseConfigured,
    navigate,
  ]);

  // Subscribe to messages in realtime
  useEffect(() => {
    if (!conversation?.id || !profile?.id) return;

    const unsubscribe = subscribeToMessages(conversation.id, (event) => {
      if (event.eventType === "INSERT") {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m.id === event.message.id)) return prev;
          const next = [...prev, event.message];
          // Check scroll position before state update
          checkScrollAtBottom();
          return next;
        });

        // If it's a message from the other party, mark as read
        if (event.message.senderId !== profile.id) {
          void markAsRead(conversation.id, profile.id);
        }
      } else if (event.eventType === "UPDATE") {
        // Sync message updates (e.g. read status)
        setMessages((prev) =>
          prev.map((m) => (m.id === event.message.id ? { ...m, readAt: event.message.readAt } : m)),
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [conversation?.id, profile?.id]);

  // Scroll to bottom when messages update (if user was already at the bottom)
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [messages]);

  const checkScrollAtBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    // User is considered at the bottom if within 100px of bottom
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    isAtBottomRef.current = isAtBottom;
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    isAtBottomRef.current = true;
  };

  const handleScroll = async () => {
    const el = scrollRef.current;
    if (!el) return;

    checkScrollAtBottom();

    // Trigger pagination when reaching the top
    if (
      el.scrollTop === 0 &&
      hasMore &&
      !loadingMore &&
      conversation?.id &&
      oldestMessageIdRef.current
    ) {
      setLoadingMore(true);
      const preScrollHeight = el.scrollHeight;

      try {
        const older = await getConversationMessages(
          conversation.id,
          20,
          oldestMessageIdRef.current,
        );

        if (older.length > 0) {
          setMessages((prev) => [...older, ...prev]);
          oldestMessageIdRef.current = older[0].id;
          setHasMore(older.length >= 20);

          // Restore scroll position after DOM renders new messages
          setTimeout(() => {
            if (el) {
              el.scrollTop = el.scrollHeight - preScrollHeight;
            }
          }, 30);
        } else {
          setHasMore(false);
        }
      } catch (err) {
        console.error("Erro ao carregar mais mensagens:", err);
      } finally {
        setLoadingMore(false);
      }
    }
  };

  const handleSend = async () => {
    if (sending || !inputText.trim() || !conversation?.id || !profile?.id) return;
    setSending(true);

    try {
      await sendMessage(conversation.id, profile.id, inputText);
      setInputText("");
      isAtBottomRef.current = true;
      scrollToBottom();
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const isBuyer = profile?.tipo === "comprador";

  return (
    <div className="min-h-screen bg-canvas flex flex-col h-screen">
      <Navbar />

      {/* Main chat window layout */}
      <div className="flex-1 flex flex-col max-w-[800px] w-full mx-auto bg-white border-x border-border overflow-hidden h-[calc(100vh-64px)] md:h-[calc(100vh-72px)]">
        {/* Chat Header */}
        <header className="border-b border-border p-4 bg-white shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/chats"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-brand-900 hover:border-leaf-500 transition-colors shrink-0"
              aria-label="Voltar para mensagens"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-brand-900 truncate text-base leading-tight">
                {loading ? "Carregando..." : conversation?.otherPartyName}
              </h1>
              {conversation && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  {conversation.orderId ? (
                    <>
                      <ShoppingBag className="h-3 w-3 text-leaf-600 shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">
                        Negociação do Pedido #{conversation.orderId}
                      </span>
                    </>
                  ) : conversation.demandId ? (
                    <>
                      <ClipboardList className="h-3 w-3 text-amber-600 shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">
                        Negociação da Demanda #{conversation.demandId.substring(0, 8)}
                      </span>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-3 w-3 text-leaf-600 shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">
                        Negociação de Anúncio
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <SupportButton compact />
        </header>

        {/* Info panel for Order/Demand context */}
        {conversation && !loading && (conversation.orderId || conversation.demandId) && (
          <div className="bg-canvas border-b border-border p-3 shrink-0 text-xs flex flex-wrap items-center justify-between gap-3">
            {conversation.orderId ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-brand-900">Total do Pedido:</span>
                <span className="text-brand-850 font-bold">
                  R$ {conversation.orderTotal?.toFixed(2) ?? "0.00"}
                </span>
                <span className="mx-1.5 text-muted-foreground">·</span>
                <span className="font-semibold text-brand-900">Status:</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-brand-900 capitalize">
                  {conversation.orderStatus}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-brand-900 font-medium">
                  Chat vinculado a uma Demanda aberta
                </span>
              </div>
            )}

            {conversation.orderId ? (
              <Link
                to={isBuyer ? "/orders" : "/producer/orders"}
                className="font-bold text-leaf-700 hover:underline hover:text-leaf-800"
              >
                Ver pedido
              </Link>
            ) : (
              <Link
                to="/demands"
                className="font-bold text-leaf-700 hover:underline hover:text-leaf-800"
              >
                Ver demandas
              </Link>
            )}
          </div>
        )}

        {/* Info panel for Portfolio announcement context */}
        {conversation &&
          !loading &&
          conversation.portfolioProductId &&
          getProduct(conversation.portfolioProductId) &&
          getProduct(conversation.portfolioProductId)!.producers.find(
            (p) => p.id === conversation.producerId,
          ) &&
          (() => {
            const prod = getProduct(conversation.portfolioProductId!)!;
            const opt = prod.producers.find((p) => p.id === conversation.producerId)!;
            return (
              <div className="bg-leaf-50/50 border-b border-leaf-100 p-4 shrink-0 flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-leaf-100 flex items-center justify-center text-3xl overflow-hidden border border-leaf-200 shrink-0">
                  {prod.imageUrl ? (
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    prod.emoji
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-leaf-700">
                    Negociando Anúncio
                  </span>
                  <h4 className="font-bold text-brand-900 text-sm truncate leading-tight mt-0.5">
                    {prod.name}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Vendido por <span className="font-semibold text-brand-850">{opt.name}</span> (
                    {opt.property})
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-brand-900 leading-tight">
                    R$ {opt.price.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">por {prod.unit}</p>
                  <span className="inline-flex items-center rounded-full bg-leaf-100 px-2 py-0.5 text-[9px] font-bold text-brand-900 mt-1">
                    Estoque: {opt.stock.toLocaleString("pt-BR")} {prod.unit}
                  </span>
                </div>
              </div>
            );
          })()}

        {/* Message bubble flow */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-canvas/40"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="h-10 w-10 animate-bounce mb-2 text-leaf-600" />
              <p className="text-sm font-semibold">Carregando conversa...</p>
            </div>
          ) : (
            <>
              {loadingMore && (
                <div className="text-center py-2 text-xs text-muted-foreground animate-pulse">
                  Carregando mensagens anteriores...
                </div>
              )}

              {messages.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-muted-foreground">
                    Inicie a negociação enviando uma mensagem abaixo.
                  </p>
                </div>
              )}

              {messages.map((msg) => {
                const isMine = msg.senderId === profile?.id;
                const isRead = !!msg.readAt;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[85%] ${
                      isMine ? "ml-auto" : "mr-auto"
                    }`}
                  >
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm break-words whitespace-pre-wrap ${
                        isMine
                          ? "bg-brand-900 text-white rounded-tr-none shadow-xs"
                          : "bg-white text-brand-900 border border-border rounded-tl-none shadow-xs"
                      }`}
                    >
                      {msg.message}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 px-1">
                      <span className="text-[10px] text-muted-foreground">
                        {formatMessageTime(msg.createdAt)}
                      </span>
                      {isMine && (
                        <span className="text-muted-foreground">
                          {isRead ? (
                            <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Input box section */}
        <footer className="border-t border-border p-4 bg-white shrink-0">
          <div className="flex items-end gap-2 bg-canvas rounded-2xl border border-border p-2 focus-within:border-leaf-600">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value.slice(0, 2000))}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem de negociação..."
              rows={1}
              className="flex-1 max-h-24 resize-none bg-transparent py-1.5 px-2 text-sm text-brand-900 focus:outline-none focus:ring-0 leading-relaxed font-sans placeholder-muted-foreground"
              style={{ height: "auto" }}
            />
            <div className="flex flex-col justify-end shrink-0 gap-1.5">
              <span className="text-[10px] text-muted-foreground text-right px-1 select-none">
                {inputText.length}/2000
              </span>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending || !inputText.trim()}
                className="grid h-9 w-9 place-items-center rounded-xl bg-brand-900 text-white hover:bg-brand-800 disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
                aria-label="Enviar mensagem"
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
