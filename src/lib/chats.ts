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
    const { data, error } = await supabase.rpc("get_or_create_conversation", {
      p_buyer_id: params.buyerId,
      p_producer_id: params.producerId,
      p_order_id: params.orderId ?? null,
      p_demand_id: params.demandId ?? null,
      p_portfolio_product_id: params.portfolioProductId ?? null,
      p_initial_message:
        params.systemMessageOnCreate && params.senderId ? params.systemMessageOnCreate : null,
    });

    if (error) throw error;

    const created = (Array.isArray(data) ? data[0] : data) as {
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
    } | null;

    if (!created) throw new Error("Não foi possível criar ou localizar a conversa.");

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
    interface ConversationSummaryRow {
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
      other_party_name: string;
      last_message_text: string | null;
      unread_count: number | string;
      order_status: string | null;
      demand_urgency: string | null;
      order_total: number | string | null;
    }

    const { data, error } = await supabase.rpc("list_user_conversations", {
      p_profile_id: profileId,
    });
    if (error) throw error;

    const rows = (data ?? []) as unknown as ConversationSummaryRow[];

    return rows.map((row) => {
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
        otherPartyName: row.other_party_name,
        lastMessageText: row.last_message_text || undefined,
        unreadCount: Number(row.unread_count || 0),
        orderStatus: row.order_status || undefined,
        demandUrgency: row.demand_urgency || undefined,
        orderTotal: row.order_total == null ? undefined : Number(row.order_total),
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
    const { error } = await supabase.rpc("mark_conversation_read", {
      p_conversation_id: conversationId,
    });

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
