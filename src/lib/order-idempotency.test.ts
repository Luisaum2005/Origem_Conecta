import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/041_idempotent_portfolio_order_creation.sql"),
  "utf8",
);

describe("idempotencia de pedidos no banco", () => {
  it("persiste uma chave unica por comprador antes de retornar o pedido", () => {
    expect(migration).toContain("primary key (buyer_id,idempotency_key)");
    expect(migration).toContain("order_creation_requests");
    expect(migration).toContain(
      "to_regprocedure('public.secure_create_portfolio_order_once(jsonb,jsonb)')",
    );
  });

  it("retorna o pedido existente antes de chamar a criacao interna", () => {
    const existingLookup = migration.indexOf("from public.order_creation_requests");
    const internalCreate = migration.indexOf("v_result:=public.secure_create_portfolio_order_once");

    expect(existingLookup).toBeGreaterThan(-1);
    expect(internalCreate).toBeGreaterThan(existingLookup);
  });

  it("preserva o fluxo de clientes antigos que ainda nao enviam a chave", () => {
    expect(migration).toContain("Older deployed clients did not send a request key");
    expect(migration).toContain(
      "return public.secure_create_portfolio_order_once(p_order,p_items)",
    );
  });
});
