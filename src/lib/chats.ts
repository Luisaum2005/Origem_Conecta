import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { getBuyerId, getProducerId } from "./orders";

export type SavedConversation = {
  id: string;
  orderId?: string;
  demandId?: string;
  portfolioProductId?: string;
  conversationContext?: "portfolio" | "demand" | "order";
  buyerId: string;
  producerId: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;

  // Joined details (computed/loaded dynamically)
  otherPartyName?: string;
  lastMessageText?: string;
  unreadCount?: number;
  orderStatus?: string;
  demandUrgency?: string;
  orderTotal?: number;
};

export type SavedMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  message: string;
  createdAt: string;
  readAt?: string;
};

const CONVERSATIONS_STORAGE_KEY = "origem-conecta-conversations";
const MESSAGES_STORAGE_KEY = "origem-conecta-messages";

// Custom event emitter for localStorage reactivity
class ChatEmitter extends EventTarget {
  notifyNewMessage(
    conversationId: string,
    message: SavedMessage,
    eventType: "INSERT" | "UPDATE" = "INSERT",
  ) {
    this.dispatchEvent(
      new CustomEvent("message", { detail: { conversationId, message, eventType } }),
    );
  }
  notifyConversationChange() {
    this.dispatchEvent(new CustomEvent("conversation_change"));
  }
}
export const chatEmitter = new ChatEmitter();

export function readLocalConversations(): SavedConversation[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as SavedConversation[];
  } catch {
    return [];
  }
}

export function writeLocalConversations(conversations: SavedConversation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
  chatEmitter.notifyConversationChange();
}

export function readLocalMessages(): SavedMessage[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(MESSAGES_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as SavedMessage[];
  } catch {
    return [];
  }
}

export function writeLocalMessages(messages: SavedMessage[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
}

export async function getOrCreateConversation(params: {
  orderId?: string;
  demandId?: string;
  portfolioProductId?: string;
  buyerId: string;
  producerId: string;
  systemMessageOnCreate?: string;
  senderId?: string;
}): Promise<SavedConversation> {
  if (supabase) {
    let query = supabase.from("conversations").select("*");
    if (params.orderId) {
      query = query.eq("order_id", params.orderId);
    } else if (params.demandId) {
      query = query.eq("demand_id", params.demandId);
    } else if (params.portfolioProductId) {
      query = query.eq("portfolio_product_id", params.portfolioProductId);
    }

    const { data: existing, error: fetchError } = await query
      .eq("buyer_id", params.buyerId)
      .eq("producer_id", params.producerId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (existing) {
      return {
        id: existing.id,
        orderId: existing.order_id || undefined,
        demandId: existing.demand_id || undefined,
        portfolioProductId: existing.portfolio_product_id || undefined,
        conversationContext: (existing.conversation_context || "portfolio") as
          | "portfolio"
          | "demand"
          | "order",
        buyerId: existing.buyer_id,
        producerId: existing.producer_id,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
        lastMessageAt: existing.last_message_at,
      };
    }

    // Create a new conversation
    const contextValue = params.orderId ? "order" : params.demandId ? "demand" : "portfolio";

    const { data: created, error: createError } = await supabase
      .from("conversations")
      .insert({
        order_id: params.orderId || null,
        demand_id: params.demandId || null,
        portfolio_product_id: params.portfolioProductId || null,
        conversation_context: contextValue,
        buyer_id: params.buyerId,
        producer_id: params.producerId,
      })
      .select()
      .single();

    if (createError) throw createError;

    // Send first message if provided
    if (params.systemMessageOnCreate && params.senderId) {
      const { error: msgError } = await supabase.from("messages").insert({
        conversation_id: created.id,
        sender_id: params.senderId,
        message: params.systemMessageOnCreate,
      });
      if (msgError) {
        console.warn("Erro ao inserir mensagem automática:", msgError);
      } else {
        created.last_message_at = new Date().toISOString();
      }
    }

    return {
      id: created.id,
      orderId: created.order_id || undefined,
      demandId: created.demand_id || undefined,
      portfolioProductId: created.portfolio_product_id || undefined,
      conversationContext: (created.conversation_context || "portfolio") as
        | "portfolio"
        | "demand"
        | "order",
      buyerId: created.buyer_id,
      producerId: created.producer_id,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
      lastMessageAt: created.last_message_at,
    };
  } else {
    // Local storage fallback
    const local = readLocalConversations();
    const existing = local.find(
      (c) =>
        (params.orderId
          ? c.orderId === params.orderId
          : params.demandId
            ? c.demandId === params.demandId
            : c.portfolioProductId === params.portfolioProductId) &&
        c.buyerId === params.buyerId &&
        c.producerId === params.producerId,
    );

    if (existing) return existing;

    const newConv: SavedConversation = {
      id: Math.random().toString(36).substring(2, 11),
      orderId: params.orderId,
      demandId: params.demandId,
      portfolioProductId: params.portfolioProductId,
      conversationContext: params.orderId ? "order" : params.demandId ? "demand" : "portfolio",
      buyerId: params.buyerId,
      producerId: params.producerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
    };

    local.push(newConv);
    writeLocalConversations(local);

    // Send first message if provided
    if (params.systemMessageOnCreate && params.senderId) {
      const allMsgs = readLocalMessages();
      const firstMsg: SavedMessage = {
        id: Math.random().toString(36).substring(2, 11),
        conversationId: newConv.id,
        senderId: params.senderId,
        message: params.systemMessageOnCreate,
        createdAt: new Date().toISOString(),
      };
      allMsgs.push(firstMsg);
      writeLocalMessages(allMsgs);

      newConv.lastMessageAt = firstMsg.createdAt;
      const idx = local.findIndex((c) => c.id === newConv.id);
      if (idx !== -1) {
        local[idx].lastMessageAt = firstMsg.createdAt;
        writeLocalConversations(local);
      }
    }

    return newConv;
  }
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  messageText: string,
): Promise<SavedMessage> {
  const trimmed = messageText.trim();
  if (!trimmed) throw new Error("A mensagem não pode ser vazia.");
  if (trimmed.length > 2000) throw new Error("A mensagem excede o limite de 2.000 caracteres.");

  if (supabase) {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        message: trimmed,
      })
      .select()
      .single();

    if (error) throw error;

    const msg: SavedMessage = {
      id: data.id,
      conversationId: data.conversation_id,
      senderId: data.sender_id,
      message: data.message,
      createdAt: data.created_at,
      readAt: data.read_at || undefined,
    };

    chatEmitter.notifyNewMessage(conversationId, msg, "INSERT");
    return msg;
  } else {
    // Local fallback
    const all = readLocalMessages();
    const newMsg: SavedMessage = {
      id: Math.random().toString(36).substring(2, 11),
      conversationId,
      senderId,
      message: trimmed,
      createdAt: new Date().toISOString(),
    };

    all.push(newMsg);
    writeLocalMessages(all);

    // Update conversation last_message_at
    const convs = readLocalConversations();
    const idx = convs.findIndex((c) => c.id === conversationId);
    if (idx !== -1) {
      convs[idx].lastMessageAt = newMsg.createdAt;
      convs[idx].updatedAt = new Date().toISOString();
      writeLocalConversations(convs);
    }

    chatEmitter.notifyNewMessage(conversationId, newMsg, "INSERT");
    return newMsg;
  }
}

export async function getConversationMessages(
  conversationId: string,
  limit = 20,
  beforeMessageId?: string,
): Promise<SavedMessage[]> {
  if (supabase) {
    let query = supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (beforeMessageId) {
      const { data: pivot } = await supabase
        .from("messages")
        .select("created_at")
        .eq("id", beforeMessageId)
        .single();
      if (pivot) {
        query = query.lt("created_at", pivot.created_at);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? [])
      .map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        message: row.message,
        createdAt: row.created_at,
        readAt: row.read_at || undefined,
      }))
      .reverse(); // Reverse to chronological order for UI bubble flow
  } else {
    // Local fallback
    let all = readLocalMessages().filter((m) => m.conversationId === conversationId);

    if (beforeMessageId) {
      const pivot = all.find((m) => m.id === beforeMessageId);
      if (pivot) {
        all = all.filter(
          (m) => new Date(m.createdAt).getTime() < new Date(pivot.createdAt).getTime(),
        );
      }
    }

    // Sort descending to get latest page, slice, then sort ascending for UI
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const page = all.slice(0, limit);
    page.reverse();
    return page;
  }
}

export async function getUserConversations(
  profileId: string,
  profileType: "comprador" | "produtor" | "admin",
): Promise<SavedConversation[]> {
  if (supabase) {
    const selectString = `
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
        total,
        buyer_name
      ),
      demand_requests (
        id,
        buyer_name,
        delivery_date,
        urgency
      ),
      buyers (
        id,
        nome_empresa,
        profile_id,
        profiles (
          nome
        )
      ),
      producers (
        id,
        nome_propriedade,
        responsavel,
        profile_id,
        profiles (
          nome
        )
      )
    `;

    let query = supabase.from("conversations").select(selectString);

    if (profileType === "comprador") {
      const bId = await getBuyerId(profileId);
      if (!bId) return [];
      query = query.eq("buyer_id", bId);
    } else if (profileType === "produtor") {
      const pId = await getProducerId(profileId);
      if (!pId) return [];
      query = query.eq("producer_id", pId);
    }

    const { data: convs, error: convsError } = await query.order("last_message_at", {
      ascending: false,
    });

    if (convsError) throw convsError;
    if (!convs || convs.length === 0) return [];

    // Fetch latest messages and unread counts
    const convIds = convs.map((c) => c.id);
    const { data: msgsData, error: msgsError } = await supabase
      .from("messages")
      .select("conversation_id, message, created_at, sender_id, read_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });

    if (msgsError) throw msgsError;

    interface DbMessageInfoRow {
      conversation_id: string;
      message: string;
      created_at: string;
      sender_id: string;
      read_at: string | null;
    }

    const msgs = (msgsData ?? []) as unknown as DbMessageInfoRow[];

    interface ConversationRow {
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
        id: string;
        status: string;
        total: number;
        buyer_name: string;
      } | null;
      demand_requests: {
        id: string;
        buyer_name: string;
        delivery_date: string;
        urgency: string;
      } | null;
      buyers: {
        id: string;
        nome_empresa: string | null;
        profile_id: string;
        profiles: {
          nome: string;
        } | null;
      } | null;
      producers: {
        id: string;
        nome_propriedade: string | null;
        responsavel: string | null;
        profile_id: string;
        profiles: {
          nome: string;
        } | null;
      } | null;
    }

    const typedConvs = (convs ?? []) as unknown as ConversationRow[];

    return typedConvs.map((row) => {
      // Find latest message text
      const latest = msgs?.find((m) => m.conversation_id === row.id);
      const localUnreads =
        msgs?.filter(
          (m) => m.conversation_id === row.id && m.sender_id !== profileId && m.read_at === null,
        ) || [];

      // Determine other party name
      let otherParty = "Participante";
      if (profileType === "comprador") {
        otherParty = row.producers?.nome_propriedade || row.producers?.responsavel || "Produtor";
      } else {
        otherParty = row.buyers?.nome_empresa || row.buyers?.profiles?.nome || "Comprador";
      }

      return {
        id: row.id,
        orderId: row.order_id || undefined,
        demandId: row.demand_id || undefined,
        portfolioProductId: row.portfolio_product_id || undefined,
        conversationContext: (row.conversation_context || "portfolio") as
          | "portfolio"
          | "demand"
          | "order",
        buyerId: row.buyer_id,
        producerId: row.producer_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastMessageAt: row.last_message_at,
        otherPartyName: otherParty,
        lastMessageText: latest?.message || undefined,
        unreadCount: localUnreads.length,
        orderStatus: row.orders?.status || undefined,
        demandUrgency: row.demand_requests?.urgency || undefined,
        orderTotal: row.orders?.total ? Number(row.orders.total) : undefined,
      };
    });
  } else {
    // Local fallback
    const bId = profileType === "comprador" ? await getBuyerId(profileId) : null;
    const pId = profileType === "produtor" ? await getProducerId(profileId) : null;

    let convs = readLocalConversations();
    if (profileType === "comprador") {
      convs = convs.filter((c) => c.buyerId === bId);
    } else if (profileType === "produtor") {
      convs = convs.filter((c) => c.producerId === pId);
    }

    const messages = readLocalMessages();

    // Mock other names from local storage profile list or set default
    const result = convs.map((c) => {
      const convMsgs = messages.filter((m) => m.conversationId === c.id);
      convMsgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latest = convMsgs[0];
      const unreadCount = convMsgs.filter((m) => m.senderId !== profileId && !m.readAt).length;

      let otherParty = "Participante";
      if (profileType === "comprador") {
        otherParty = `Produtor (ID: ${c.producerId.substring(0, 4)})`;
      } else {
        otherParty = `Estabelecimento (ID: ${c.buyerId.substring(0, 4)})`;
      }

      return {
        ...c,
        otherPartyName: otherParty,
        lastMessageText: latest?.message || undefined,
        unreadCount,
      };
    });

    result.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
    return result;
  }
}

export async function markAsRead(conversationId: string, profileId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", profileId)
      .is("read_at", null);

    if (error) throw error;
  } else {
    // Local fallback
    const all = readLocalMessages();
    let changed = false;
    const updated = all.map((m) => {
      if (m.conversationId === conversationId && m.senderId !== profileId && !m.readAt) {
        changed = true;
        return { ...m, readAt: new Date().toISOString() };
      }
      return m;
    });

    if (changed) {
      writeLocalMessages(updated);
      // Trigger update for real-time sync locally
      chatEmitter.notifyNewMessage(conversationId, {} as SavedMessage, "UPDATE");
    }
  }
}

export function subscribeToMessages(
  conversationId: string,
  onEvent: (event: { eventType: "INSERT" | "UPDATE"; message: SavedMessage }) => void,
) {
  if (supabase) {
    const channel = supabase
      .channel(`chat_messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          interface DbMessageRow {
            id: string;
            conversation_id: string;
            sender_id: string;
            message: string;
            created_at: string;
            read_at: string | null;
          }

          const row = (payload.new || payload.old) as unknown as DbMessageRow;
          if (!row || !row.id) return;
          onEvent({
            eventType: payload.eventType as "INSERT" | "UPDATE",
            message: {
              id: row.id,
              conversationId: row.conversation_id,
              senderId: row.sender_id,
              message: row.message || "",
              createdAt: row.created_at,
              readAt: row.read_at || undefined,
            },
          });
        },
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  } else {
    // Local event emitter
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.conversationId === conversationId) {
        onEvent({
          eventType: detail.eventType || "INSERT",
          message: detail.message,
        });
      }
    };
    chatEmitter.addEventListener("message", handler);
    return () => {
      chatEmitter.removeEventListener("message", handler);
    };
  }
}

export function subscribeToConversations(onChange: () => void) {
  if (supabase) {
    const channel = supabase
      .channel("chat_conversations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          onChange();
        },
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  } else {
    chatEmitter.addEventListener("conversation_change", onChange);
    return () => {
      chatEmitter.removeEventListener("conversation_change", onChange);
    };
  }
}

export function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
