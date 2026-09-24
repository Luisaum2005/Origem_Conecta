import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { ProductFallback } from "@/components/marketplace/ProductCard";
import { MoreMenu } from "@/components/mobile/Sheet";
import { StatusChip } from "@/components/mobile/order-ui";
import { orderItemsLabel } from "@/lib/order-status";
import { useAvailableProducts } from "@/lib/available-products";
import { useDemandRequests } from "@/lib/demands";
import { useOrders } from "@/lib/orders";
import { ProposalCard } from "@/components/chat/ProposalCard";
import { ProposalComposer } from "@/components/chat/ProposalComposer";
import { useAuth } from "@/lib/auth";
import {
  getOrCreateConversation,
  getConversationMessages,
  sendMessage,
  sendAudioMessage,
  markAsRead,
  subscribeToMessages,
  formatMessageTime,
  type SavedConversation,
  type SavedMessage,
} from "@/lib/chats";
import { getBuyerId, getProducerId } from "@/lib/orders";
import { supabase } from "@/lib/supabase";
import {
  acceptNegotiationProposal,
  createNegotiationProposal,
  effectiveProposalStatus,
  listNegotiationProposals,
  listProposalInventory,
  rejectNegotiationProposal,
  proposalTotal,
  subscribeToNegotiationProposals,
  type NegotiationProposal,
  type ProposalDraft,
  type ProposalInventoryItem,
} from "@/lib/negotiation-proposals";
import {
  AlertCircle,
  ArrowLeft,
  Handshake,
  Mic,
  Plus,
  Send,
  Square,
  Trash2,
} from "@/components/mobile/icons";
import { getProduct } from "@/lib/catalog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { formatBRL, initials } from "@/lib/format";

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioPreview, setAudioPreview] = useState<{
    blob: Blob;
    url: string;
    durationSeconds: number;
  } | null>(null);
  const [proposals, setProposals] = useState<NegotiationProposal[]>([]);
  const [proposalInventory, setProposalInventory] = useState<ProposalInventoryItem[]>([]);
  const [proposalComposerOpen, setProposalComposerOpen] = useState(false);
  const [counterProposal, setCounterProposal] = useState<NegotiationProposal | undefined>();
  const [proposalBusy, setProposalBusy] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState("");
  const { orders } = useOrders();
  const { demands } = useDemandRequests();
  const availableProducts = useAvailableProducts();

  const scrollRef = useRef<HTMLDivElement>(null);
  const oldestMessageIdRef = useRef<string | null>(null);
  const isAtBottomRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingSecondsRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const releaseMicrophone = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      releaseMicrophone();
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioPreview?.url) URL.revokeObjectURL(audioPreview.url);
    };
  }, [audioPreview]);

  // Initialize conversation
  useEffect(() => {
    if (!profile?.id) return;
    let active = true;

    async function initialize() {
      setLoading(true);
      try {
        let conversationId = search.id;

        // If no direct ID but we have context, resolve or create the conversation
        if (
          !conversationId &&
          (search.orderId ||
            search.demandId ||
            search.portfolioProductId ||
            search.buyerId ||
            search.producerId)
        ) {
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
                | "order"
                | "direct",
              buyerId: chatData.buyer_id,
              producerId: chatData.producer_id,
              createdAt: chatData.created_at,
              updatedAt: chatData.updated_at,
              lastMessageAt: chatData.last_message_at,
              otherPartyName: otherParty,
              otherPartyDetail:
                profile!.tipo === "comprador" &&
                chatData.producers?.responsavel &&
                chatData.producers.responsavel !== otherParty
                  ? chatData.producers.responsavel.split(" ").slice(0, 2).join(" ")
                  : undefined,
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

  const reloadProposals = useCallback(async () => {
    if (!conversation?.id || !supabase || !isSupabaseConfigured) return;
    setProposalLoading(true);
    try {
      const [nextProposals, nextInventory] = await Promise.all([
        listNegotiationProposals(conversation.id),
        conversation.orderId ? Promise.resolve([]) : listProposalInventory(conversation.id),
      ]);
      setProposals(nextProposals);
      const accepted = [...nextProposals].reverse().find((proposal) => proposal.orderId);
      if (accepted?.orderId) {
        setConversation((current) =>
          current
            ? {
                ...current,
                orderId: accepted.orderId,
                conversationContext: "order",
                orderStatus: current.orderStatus ?? "recebido",
                orderTotal: proposalTotal(accepted),
              }
            : current,
        );
        setProposalInventory([]);
      } else {
        setProposalInventory(nextInventory);
      }
      setProposalError("");
    } catch (error) {
      console.error("Erro ao carregar propostas:", error);
      setProposalError(
        error instanceof Error ? error.message : "Não foi possível carregar as propostas.",
      );
    } finally {
      setProposalLoading(false);
    }
  }, [conversation?.id, conversation?.orderId, isSupabaseConfigured]);

  useEffect(() => {
    if (!conversation?.id) return;
    void reloadProposals();
    return subscribeToNegotiationProposals(conversation.id, () => void reloadProposals());
  }, [conversation?.id, reloadProposals]);

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

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  };

  const startRecording = async () => {
    if (sending || isRecording || audioPreview) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Este navegador não oferece suporte à gravação de áudio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        clearRecordingTimer();
        releaseMicrophone();
        setIsRecording(false);
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size > 0) {
          setAudioPreview({
            blob,
            url: URL.createObjectURL(blob),
            durationSeconds: Math.max(1, recordingSecondsRef.current),
          });
        }
      });

      recorder.start(250);
      setIsRecording(true);
      recordingTimerRef.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
        if (recordingSecondsRef.current >= 120) stopRecording();
      }, 1000);
    } catch (err) {
      releaseMicrophone();
      console.error("Erro ao acessar o microfone:", err);
      toast.error("Não foi possível acessar o microfone. Confira a permissão do navegador.");
    }
  };

  const discardAudio = () => {
    if (isRecording) stopRecording();
    setAudioPreview(null);
  };

  const handleSendAudio = async () => {
    if (sending || !audioPreview || !conversation?.id || !profile?.id) return;
    setSending(true);
    try {
      await sendAudioMessage(
        conversation.id,
        profile.id,
        audioPreview.blob,
        audioPreview.durationSeconds,
      );
      setAudioPreview(null);
      isAtBottomRef.current = true;
      scrollToBottom();
    } catch (err) {
      console.error("Erro ao enviar áudio:", err);
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o áudio.");
    } finally {
      setSending(false);
    }
  };

  const formatRecordingTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const openProposalComposer = (initialProposal?: NegotiationProposal) => {
    setCounterProposal(initialProposal);
    setProposalComposerOpen(true);
  };

  const submitProposal = async (draft: ProposalDraft) => {
    if (!conversation?.id) return;
    setProposalBusy(true);
    setProposalError("");
    try {
      await createNegotiationProposal(conversation.id, draft);
      setProposalComposerOpen(false);
      setCounterProposal(undefined);
      await reloadProposals();
      toast.success(counterProposal ? "Contraproposta enviada." : "Proposta enviada.");
      isAtBottomRef.current = true;
      setTimeout(scrollToBottom, 50);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível enviar a proposta.";
      setProposalError(message);
      toast.error(message);
      throw error;
    } finally {
      setProposalBusy(false);
    }
  };

  const acceptProposal = async (proposal: NegotiationProposal) => {
    if (
      !window.confirm(
        "Ao aceitar, um pedido será criado com estes valores e o estoque será reservado. Deseja continuar?",
      )
    )
      return;
    setProposalBusy(true);
    setProposalError("");
    try {
      const result = await acceptNegotiationProposal(proposal.id);
      setConversation((current) =>
        current
          ? {
              ...current,
              orderId: result.orderId,
              conversationContext: "order",
              orderStatus: "recebido",
              orderTotal: proposal.items.reduce((total, item) => total + item.lineTotal, 0),
            }
          : current,
      );
      await reloadProposals();
      toast.success("Proposta aceita e pedido criado.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível aceitar a proposta.";
      setProposalError(message);
      toast.error(message);
    } finally {
      setProposalBusy(false);
    }
  };

  const rejectProposal = async (proposal: NegotiationProposal) => {
    if (!window.confirm("Deseja recusar esta proposta? A conversa continuará disponível.")) return;
    setProposalBusy(true);
    setProposalError("");
    try {
      await rejectNegotiationProposal(proposal.id);
      await reloadProposals();
      toast.success("Proposta recusada.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível recusar a proposta.";
      setProposalError(message);
      toast.error(message);
    } finally {
      setProposalBusy(false);
    }
  };

  const isBuyer = profile?.tipo === "comprador";
  const activeProposal = [...proposals]
    .reverse()
    .find((proposal) => effectiveProposalStatus(proposal) === "pending");
  const timeline = useMemo(
    () =>
      [
        ...messages.map((message) => ({
          type: "message" as const,
          createdAt: message.createdAt,
          message,
        })),
        ...proposals.map((proposal) => ({
          type: "proposal" as const,
          createdAt: proposal.createdAt,
          proposal,
        })),
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages, proposals],
  );

  const contextOrder = conversation?.orderId
    ? orders.find((order) => order.id === conversation.orderId)
    : undefined;
  const contextDemand = conversation?.demandId
    ? demands.find((demand) => demand.id === conversation.demandId)
    : undefined;
  const contextProduct = conversation?.portfolioProductId
    ? (availableProducts.find((product) => product.id === conversation.portfolioProductId) ??
      getProduct(conversation.portfolioProductId))
    : undefined;
  const contextPhoto = contextOrder
    ? availableProducts.find((product) =>
        contextOrder.items.some((item) => item.productId === product.id && product.imageUrl),
      )?.imageUrl
    : contextProduct?.imageUrl;
  const dayLabel = (value: string) => {
    const date = new Date(value);
    const diff = Math.round(
      (new Date(new Date().toDateString()).getTime() - new Date(date.toDateString()).getTime()) /
        864e5,
    );
    return diff === 0
      ? "Hoje"
      : diff === 1
        ? "Ontem"
        : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };
  const quickReplies = isBuyer
    ? ["Combinado 👍", "Qual o valor final?", "Pode trocar?"]
    : ["Combinado 👍", "Saiu para entrega", "Vou confirmar o estoque"];
  const canPropose = Boolean(conversation) && !proposalLoading && proposalInventory.length > 0;

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-09-conversa">
        <div className="m-status" />
        <div className="m-hd">
          <Link to="/chats" className="m-round" aria-label="Voltar para mensagens">
            <ArrowLeft className="lucide" aria-hidden />
          </Link>
          <div className="m-who">
            <span className="m-avatar">{initials(conversation?.otherPartyName) || "…"}</span>
            <div>
              <b>{loading ? "Carregando..." : conversation?.otherPartyName}</b>
              <span>
                {conversation?.otherPartyDetail
                  ? conversation.otherPartyDetail
                  : conversation?.orderId
                    ? `Pedido #${conversation.orderId}`
                    : conversation?.demandId
                      ? "Negociação de demanda"
                      : conversation?.portfolioProductId
                        ? "Negociação de produto"
                        : "Negociação direta"}
              </span>
            </div>
          </div>
          <span style={{ width: 44 }} />
        </div>

        {conversation && !loading && (contextOrder || contextDemand || contextProduct) && (
          <div className="m-ctx m-card">
            {contextPhoto ? (
              <img src={contextPhoto} alt="" />
            ) : (
              <ProductFallback
                category={contextProduct?.category ?? ""}
                name={contextProduct?.name ?? contextOrder?.items[0]?.productName ?? ""}
                className="m-ctxf"
                label={false}
              />
            )}
            <div>
              {contextOrder ? (
                <StatusChip status={contextOrder.status} />
              ) : contextDemand ? (
                <span className="m-chip m-st-separacao m-st-dot">Demanda</span>
              ) : (
                <span className="m-chip m-leaf">Produto</span>
              )}
              <b>
                {contextOrder
                  ? `#${contextOrder.id} · ${orderItemsLabel(contextOrder)}`
                  : contextDemand
                    ? contextDemand.items.map((item) => item.productName).join(", ")
                    : `${contextProduct!.name} · ${formatBRL(contextProduct!.producers[0]?.price ?? 0)}/${contextProduct!.unit}`}
              </b>
            </div>
            {contextOrder ? (
              <Link
                to={isBuyer ? "/tracking" : "/producer/orders"}
                search={isBuyer ? { id: contextOrder.id } : undefined}
                className="m-btn m-text m-sm"
              >
                Ver
              </Link>
            ) : contextDemand ? (
              <Link to="/demands" className="m-btn m-text m-sm">
                Ver
              </Link>
            ) : (
              <Link to="/product" search={{ id: contextProduct!.id }} className="m-btn m-text m-sm">
                Ver
              </Link>
            )}
          </div>
        )}

        {proposalError && (
          <div className="m-pad">
            <div role="alert" className="m-card m-alert">
              <AlertCircle className="lucide" aria-hidden />
              <span>{proposalError}</span>
            </div>
          </div>
        )}

        <div ref={scrollRef} onScroll={handleScroll} className="m-thread">
          {loading ? (
            <span className="m-day">Carregando conversa...</span>
          ) : (
            <>
              {loadingMore && <span className="m-day">Carregando mensagens anteriores...</span>}
              {timeline.length === 0 && (
                <span className="m-day">Envie a primeira mensagem para começar a negociar</span>
              )}
              {timeline.map((event, index) => {
                const previous = timeline[index - 1];
                const day =
                  !previous || dayLabel(previous.createdAt) !== dayLabel(event.createdAt) ? (
                    <span key={`day-${event.createdAt}`} className="m-day">
                      {dayLabel(event.createdAt)}
                    </span>
                  ) : null;
                if (event.type === "proposal") {
                  return [
                    day,
                    <ProposalCard
                      key={`proposal-${event.proposal.id}`}
                      proposal={event.proposal}
                      currentProfileId={profile?.id}
                      otherPartyName={conversation?.otherPartyName}
                      orderHref={isBuyer ? "/orders" : "/producer/orders"}
                      busy={proposalBusy}
                      onAccept={() => void acceptProposal(event.proposal)}
                      onReject={() => void rejectProposal(event.proposal)}
                      onCounter={() => openProposalComposer(event.proposal)}
                    />,
                  ];
                }
                const msg = event.message;
                const isMine = msg.senderId === profile?.id;
                return [
                  day,
                  <div key={msg.id} className={`m-msg${isMine ? " m-me" : ""}`}>
                    {msg.messageType === "audio" ? (
                      msg.audioUrl ? (
                        <audio
                          controls
                          preload="metadata"
                          src={msg.audioUrl}
                          aria-label={`Mensagem de áudio de ${msg.audioDurationSeconds ?? 0} segundos`}
                        />
                      ) : (
                        <p>Áudio indisponível</p>
                      )
                    ) : (
                      <p>{msg.message}</p>
                    )}
                    <span>
                      {formatMessageTime(msg.createdAt)}
                      {isMine && (msg.readAt ? " ✓✓" : " ✓")}
                    </span>
                  </div>,
                ];
              })}
              {!loading && (
                <div className="m-quick">
                  {quickReplies.map((reply) => (
                    <button
                      key={reply}
                      type="button"
                      className="m-pill"
                      onClick={() => setInputText(reply)}
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="m-composer">
          {isRecording ? (
            <>
              <span className="m-rec" aria-hidden />
              <div className="m-in" role="status">
                Gravando · {formatRecordingTime(recordingSeconds)} / 2:00
              </div>
              <button
                type="button"
                className="m-round m-mic"
                onClick={stopRecording}
                aria-label="Parar gravação"
              >
                <Square className="lucide" aria-hidden />
              </button>
            </>
          ) : audioPreview ? (
            <>
              <button
                type="button"
                className="m-round"
                onClick={discardAudio}
                disabled={sending}
                aria-label="Descartar áudio"
              >
                <Trash2 className="lucide" aria-hidden />
              </button>
              <div className="m-in m-audio">
                <audio
                  controls
                  preload="metadata"
                  src={audioPreview.url}
                  aria-label="Ouvir áudio antes de enviar"
                />
              </div>
              <button
                type="button"
                className="m-round m-mic"
                onClick={() => void handleSendAudio()}
                disabled={sending}
                aria-label="Enviar áudio"
              >
                <Send className="lucide" aria-hidden />
              </button>
            </>
          ) : (
            <>
              <MoreMenu
                label="Mais ações"
                icon={<Plus className="lucide" aria-hidden />}
                items={[
                  {
                    label: canPropose
                      ? activeProposal
                        ? activeProposal.createdBy === profile?.id
                          ? "Substituir proposta"
                          : "Fazer contraproposta"
                        : "Fazer proposta"
                      : proposalLoading
                        ? "Carregando produtos..."
                        : "Proposta indisponível (sem produto)",
                    icon: <Handshake className="lucide" aria-hidden />,
                    onSelect: () => {
                      if (canPropose) openProposalComposer(activeProposal);
                    },
                  },
                ]}
              />
              <label className="m-in">
                <textarea
                  aria-label="Mensagem da negociação"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value.slice(0, 2000))}
                  onKeyDown={handleKeyDown}
                  placeholder="Escreva uma mensagem…"
                  rows={1}
                />
              </label>
              {inputText.trim() ? (
                <button
                  type="button"
                  className="m-round m-mic"
                  onClick={() => void handleSend()}
                  disabled={sending}
                  aria-label="Enviar mensagem"
                >
                  <Send className="lucide" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  className="m-round m-mic"
                  onClick={() => void startRecording()}
                  disabled={sending}
                  aria-label="Gravar mensagem de áudio"
                >
                  <Mic className="lucide" aria-hidden />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <ProposalComposer
        open={proposalComposerOpen}
        onOpenChange={(open) => {
          setProposalComposerOpen(open);
          if (!open) setCounterProposal(undefined);
        }}
        inventory={proposalInventory}
        initialProposal={counterProposal}
        preferredInventoryId={conversation?.portfolioProductId}
        submitting={proposalBusy}
        onSubmit={submitProposal}
      />
    </>
  );
}
