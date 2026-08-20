import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/046_missing_producer_products_notification.sql"),
  "utf8",
);
const notificationsSource = readFileSync(
  resolve(process.cwd(), "src/lib/notifications.ts"),
  "utf8",
);
const profileSource = readFileSync(
  resolve(process.cwd(), "src/routes/profile.producer.tsx"),
  "utf8",
);
const pushSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/send-push-notification/index.ts"),
  "utf8",
);

describe("notificação de produtos pendentes", () => {
  it("mantém uma única notificação e a resolve quando os produtos são informados", () => {
    expect(migration).toContain("producer:missing-products:");
    expect(migration).toContain("on conflict(user_id,idempotency_key) do update");
    expect(migration).toContain("set resolved_at=coalesce(resolved_at,now())");
    expect(migration).toContain("update of categorias_atendidas");
  });

  it("oculta notificações resolvidas e direciona para o editor de produtos", () => {
    expect(notificationsSource).toContain('.is("resolved_at", null)');
    expect(migration).toContain("/profile/producer?edit=products");
    expect(profileSource).toContain('new URLSearchParams(window.location.search).get("edit")');
    expect(profileSource).toContain("focusProductsOnLoad={editProductsRequested}");
    expect(pushSource).toContain("if (notification.resolved_at)");
  });
});
