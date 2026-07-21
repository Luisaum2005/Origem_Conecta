import { assertSupabaseConfigured, supabase, throwSupabaseError } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

export type AppNotification = {
  id: string;
  type: "message" | "order" | "demand" | "rating" | "system";
  title: string;
  body: string;
  url: string;
  readAt: string | null;
  createdAt: string;
};

function mapNotification(row: Record<string, unknown>): AppNotification {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    type: row.type as AppNotification["type"],
    title: String(row.title),
    body: String(row.body),
    url: typeof data.url === "string" ? data.url : "/",
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
  };
}

export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase && userId));
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setNotifications([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: loadError } = await supabase
        .from("notifications")
        .select("id,type,title,body,data,read_at,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      throwSupabaseError(loadError);
      setNotifications((data ?? []).map(mapNotification));
    } catch (loadError) {
      console.error("Não foi possível carregar as notificações.", loadError);
      setError("Não foi possível carregar as notificações. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    void refresh();
    if (!supabase || !userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [refresh, userId]);
  const markRead = async (id: string) => {
    try {
      const client = assertSupabaseConfigured();
      const { error: updateError } = await client.rpc("mark_notification_read", {
        p_notification_id: id,
      });
      throwSupabaseError(updateError);
      setNotifications((items) =>
        items.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
      return true;
    } catch (updateError) {
      console.error("Não foi possível marcar a notificação como lida.", updateError);
      setError("Não foi possível atualizar a notificação.");
      return false;
    }
  };
  const markAllRead = async () => {
    try {
      const client = assertSupabaseConfigured();
      const { error: updateError } = await client.rpc("mark_all_notifications_read");
      throwSupabaseError(updateError);
      const now = new Date().toISOString();
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? now })));
      return true;
    } catch (updateError) {
      console.error("Não foi possível marcar todas as notificações como lidas.", updateError);
      setError("Não foi possível atualizar as notificações.");
      return false;
    }
  };
  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.readAt).length,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  };
}
