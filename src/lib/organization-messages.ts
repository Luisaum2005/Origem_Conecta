import { assertSupabaseConfigured, throwSupabaseError } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

export type OrganizationConversation = {
  id: string;
  organizationId: string;
  organizationName: string;
  orderId?: string;
  buyerName: string;
  producerName: string;
  lastMessageAt: string;
  lastMessageText?: string;
  messageCount: number;
};

export type OrganizationMessage = {
  id: string;
  senderKind: "buyer" | "producer" | "participant";
  senderName: string;
  body: string;
  createdAt: string;
};

export function mapOrganizationConversation(
  row: Record<string, unknown>,
): OrganizationConversation {
  return {
    id: String(row.conversation_id),
    organizationId: String(row.organization_id),
    organizationName: String(row.organization_name ?? "Organização"),
    orderId: row.order_id ? String(row.order_id) : undefined,
    buyerName: String(row.buyer_name ?? "Comprador"),
    producerName: String(row.producer_name ?? "Produtor"),
    lastMessageAt: String(row.last_message_at),
    lastMessageText: row.last_message_text ? String(row.last_message_text) : undefined,
    messageCount: Number(row.message_count ?? 0),
  };
}

export function mapOrganizationMessage(row: Record<string, unknown>): OrganizationMessage {
  const senderKind = String(row.sender_kind);
  return {
    id: String(row.message_id),
    senderKind: senderKind === "buyer" || senderKind === "producer" ? senderKind : "participant",
    senderName: String(row.sender_name ?? "Participante"),
    body: String(row.body ?? ""),
    createdAt: String(row.created_at),
  };
}

export function filterOrganizationConversations(
  conversations: OrganizationConversation[],
  query: string,
  organizationId: string,
) {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  return conversations.filter((conversation) => {
    if (organizationId !== "all" && conversation.organizationId !== organizationId) return false;
    if (!normalized) return true;
    return [
      conversation.organizationName,
      conversation.buyerName,
      conversation.producerName,
      conversation.orderId ?? "",
      conversation.lastMessageText ?? "",
    ].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalized));
  });
}

export function useOrganizationConversations() {
  const [conversations, setConversations] = useState<OrganizationConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: queryError } = await assertSupabaseConfigured().rpc(
        "list_managed_organization_conversations",
        { p_limit: 100 },
      );
      throwSupabaseError(queryError);
      setConversations(
        (data ?? []).map((row: Record<string, unknown>) => mapOrganizationConversation(row)),
      );
      setError("");
    } catch (queryError) {
      setError(
        queryError instanceof Error
          ? queryError.message
          : "Não foi possível carregar as mensagens institucionais.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { conversations, loading, error, refresh };
}

export async function listManagedOrganizationMessages(conversationId: string) {
  const { data, error } = await assertSupabaseConfigured().rpc(
    "list_managed_organization_messages",
    { p_conversation_id: conversationId, p_limit: 200 },
  );
  throwSupabaseError(error);
  return (data ?? []).map((row: Record<string, unknown>) => mapOrganizationMessage(row));
}
