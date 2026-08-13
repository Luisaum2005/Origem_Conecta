import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/037_protect_delivery_confirmation_code.sql"),
  "utf8",
);
const ordersSource = readFileSync(resolve(process.cwd(), "src/lib/orders.ts"), "utf8");

describe("delivery confirmation code protection", () => {
  it("removes direct delivery-code reads and exposes a buyer-only RPC", () => {
    expect(migration).toContain("revoke select on public.orders from public,anon,authenticated");
    expect(migration).toContain("get_my_order_delivery_codes");
    expect(migration).toContain("where p.user_id=auth.uid()");
    const safeGrant = migration.match(
      /grant select \([\s\S]*?\) on public\.orders to authenticated;/,
    )?.[0];
    expect(safeGrant).toBeTruthy();
    expect(safeGrant).not.toContain("codigo_entrega");
  });

  it("uses six-digit codes and persists lockouts without raising a rollback", () => {
    expect(migration).toContain("% 1000000");
    expect(migration).toContain("v_failed_attempts>=5");
    expect(migration).toContain("interval '15 minutes'");
    expect(migration).toContain("'success',false");
  });

  it("never selects the delivery code directly from the orders table", () => {
    const orderSelects = ordersSource.match(/"id,buyer_id[^"]+/g) ?? [];
    expect(orderSelects.length).toBeGreaterThan(0);
    expect(orderSelects.every((select) => !select.includes("codigo_entrega"))).toBe(true);
    expect(ordersSource).toContain('"get_my_order_delivery_codes"');
  });
});
