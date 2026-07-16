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
export async function getPushState(): Promise<PushState> {
  if (!supportsPush()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? "enabled" : Notification.permission === "default" ? "default" : "disabled";
}
export async function enablePush(userId: string) {
  if (!supportsPush()) throw new Error("Este navegador não oferece suporte a notificações push.");
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
  const json = subscription.toJSON();
  const { error } = await assertSupabaseConfigured().from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
      is_active: true,
      failure_count: 0,
    },
    { onConflict: "endpoint" },
  );
  throwSupabaseError(error);
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
