import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const headers = { "content-type": "application/json" };
Deno.serve(async (request) => {
  if (request.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  const expectedSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (!expectedSecret || request.headers.get("x-push-webhook-secret") !== expectedSecret)
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  try {
    const body = await request.json();
    const notificationId = body.notificationId ?? body.record?.id;
    if (!notificationId) throw new Error("notificationId ausente");
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@origemconecta.com.br";
    if (!vapidPublic || !vapidPrivate) throw new Error("VAPID não configurado");
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select("id,user_id,type,title,body,data")
      .eq("id", notificationId)
      .single();
    if (notificationError || !notification)
      throw notificationError ?? new Error("Notificação não encontrada");
    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", notification.user_id)
      .maybeSingle();
    const preferenceKey =
      notification.type === "message"
        ? "messages"
        : notification.type === "order"
          ? "orders"
          : notification.type === "demand"
            ? "demands"
            : notification.type === "rating"
              ? "ratings"
              : null;
    if (
      preferences &&
      (!preferences.push_enabled || (preferenceKey && !preferences[preferenceKey]))
    ) {
      await supabase
        .from("notifications")
        .update({ push_status: "skipped", push_attempted_at: new Date().toISOString() })
        .eq("id", notification.id);
      return new Response(JSON.stringify({ sent: 0, skipped: true }), { headers });
    }
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth,failure_count")
      .eq("user_id", notification.user_id)
      .eq("is_active", true);
    if (subscriptionsError) throw subscriptionsError;
    webpush.setVapidDetails(subject, vapidPublic, vapidPrivate);
    let sent = 0;
    let failed = 0;
    let attempts = 0;
    const failureMessages: string[] = [];
    await Promise.all(
      (subscriptions ?? []).map(async (subscription) => {
        let delivered = false;
        let lastError: unknown;
        let lastStatus = 0;
        for (let attempt = 1; attempt <= 3 && !delivered; attempt++) {
          attempts++;
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              JSON.stringify({
                title: notification.title,
                body: notification.body,
                url: notification.data?.url ?? "/",
                notificationId: notification.id,
              }),
              { TTL: 3600 },
            );
            delivered = true;
          } catch (error) {
            lastError = error;
            lastStatus =
              typeof error === "object" && error && "statusCode" in error
                ? Number(error.statusCode)
                : 0;
            if (lastStatus === 404 || lastStatus === 410) break;
            if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 250));
          }
        }
        if (delivered) {
          sent += 1;
          await supabase
            .from("push_subscriptions")
            .update({
              failure_count: 0,
              last_success_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", subscription.id);
        } else {
          failed += 1;
          const detail =
            lastError instanceof Error
              ? lastError.message
              : `Falha HTTP ${lastStatus || "desconhecida"}`;
          failureMessages.push(detail.slice(0, 300));
          await supabase
            .from("push_subscriptions")
            .update({
              is_active: lastStatus === 404 || lastStatus === 410 ? false : true,
              failure_count: subscription.failure_count ? subscription.failure_count + 1 : 1,
              last_failure_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", subscription.id);
        }
      }),
    );
    const status =
      sent && failed ? "partial" : sent ? "sent" : subscriptions?.length ? "failed" : "skipped";
    await supabase
      .from("notifications")
      .update({
        push_status: status,
        push_attempted_at: new Date().toISOString(),
        push_attempt_count: attempts,
        push_last_error: failureMessages.length ? failureMessages.join(" | ").slice(0, 1000) : null,
      })
      .eq("id", notification.id);
    return new Response(JSON.stringify({ sent, failed, status }), { headers });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers },
    );
  }
});
