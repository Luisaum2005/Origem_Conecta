import { assertSupabaseConfigured, throwSupabaseError } from "@/lib/supabase";

export type PushState = "unsupported" | "default" | "denied" | "enabled" | "disabled";

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
  if (!publicKey) throw new Error("A chave pública VAPID ainda não foi configurada.");
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
      applicationServerKey: decodeKey(publicKey),
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
