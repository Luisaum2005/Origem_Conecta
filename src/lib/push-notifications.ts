import { assertSupabaseConfigured, throwSupabaseError } from "@/lib/supabase";

export type PushState = "unsupported" | "default" | "denied" | "enabled" | "disabled";

export type NotificationPreferences = {
  messages: boolean;
  orders: boolean;
  demands: boolean;
  ratings: boolean;
  systemNotifications: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  messages: true,
  orders: true,
  demands: true,
  ratings: true,
  systemNotifications: true,
};

export const PUSH_ONBOARDING_COMPLETED_EVENT = "origem-conecta:push-onboarding-completed";

export function completePushOnboarding(userId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PUSH_ONBOARDING_COMPLETED_EVENT, { detail: userId }));
}

export function supportsPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
function decodeKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function validateVapidPublicKey(value?: string) {
  if (!value) return "A chave pública VAPID não foi configurada.";
  try {
    const decoded = decodeKey(value.trim());
    if (decoded.length !== 65 || decoded[0] !== 4) {
      return "A chave pública VAPID possui formato inválido.";
    }
    return null;
  } catch {
    return "A chave pública VAPID não é uma chave Base64 URL válida.";
  }
}
async function persistSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("A inscrição de notificações deste navegador está incompleta.");
  }
  const { error } = await assertSupabaseConfigured().rpc("register_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent,
  });
  throwSupabaseError(error);
}

export async function getPushState(userId?: string): Promise<PushState> {
  if (!supportsPush()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription = await registration.pushManager.getSubscription();
  if (subscription && userId) await persistSubscription(subscription);
  return subscription ? "enabled" : Notification.permission === "default" ? "default" : "disabled";
}
export async function enablePush(userId: string) {
  if (!supportsPush()) throw new Error("Este navegador não oferece suporte a notificações push.");
  if (!userId) throw new Error("Usuário não identificado.");
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  const configurationError = validateVapidPublicKey(publicKey);
  if (configurationError) throw new Error(configurationError);
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      permission === "denied"
        ? "As notificações foram bloqueadas no navegador."
        : "A permissão não foi concedida.",
    );
  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeKey(publicKey!),
    }));
  await persistSubscription(subscription);
  return "enabled" as const;
}
export async function disablePush() {
  if (!supportsPush()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const client = assertSupabaseConfigured();
  const { error } = await client
    .from("push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("endpoint", subscription.endpoint);
  throwSupabaseError(error);
  await subscription.unsubscribe();
}

export async function getNotificationPreferences(userId: string) {
  const client = assertSupabaseConfigured();
  const { data, error } = await client
    .from("notification_preferences")
    .select("messages,orders,demands,ratings,system_notifications")
    .eq("user_id", userId)
    .maybeSingle();
  throwSupabaseError(error);
  if (!data) return DEFAULT_NOTIFICATION_PREFERENCES;
  return {
    messages: data.messages !== false,
    orders: data.orders !== false,
    demands: data.demands !== false,
    ratings: data.ratings !== false,
    systemNotifications: data.system_notifications !== false,
  } satisfies NotificationPreferences;
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
) {
  const client = assertSupabaseConfigured();
  const { error } = await client.from("notification_preferences").upsert(
    {
      user_id: userId,
      push_enabled: true,
      messages: preferences.messages,
      orders: preferences.orders,
      demands: preferences.demands,
      ratings: preferences.ratings,
      system_notifications: preferences.systemNotifications,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  throwSupabaseError(error);
}
