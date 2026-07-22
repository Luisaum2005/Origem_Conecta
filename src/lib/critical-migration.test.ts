import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/027_secure_multi_producer_orders.sql"),
  "utf8",
);

describe("critical order integrity migration", () => {
  it("removes public and anonymous access from delivery completion", () => {
    expect(migration).toContain(
      "revoke all on function public.secure_complete_order(uuid,text) from public,anon",
    );
    expect(migration).toContain(
      "grant execute on function public.secure_complete_order(uuid,text) to authenticated",
    );
  });

  it("reserves inventory during portfolio checkout and restores it on cancellation", () => {
    expect(migration).toContain("set quantidade_disponivel=quantidade_disponivel-v_qty");
    expect(migration).toContain("set quantidade_disponivel=quantidade_disponivel+v_item.qty");
  });

  it("does not accept a delivery fee supplied by the browser", () => {
    expect(migration).toContain("v_delivery:=0");
    expect(migration).not.toContain("p_order->>'delivery'");
  });

  it("tracks delivery separately for every producer", () => {
    expect(migration).toContain("producer_confirmed_at");
    expect(migration).toContain("producer_shipped_at");
    expect(migration).toContain("producer_delivered_at");
    expect(migration).toContain("producer_id=v_producer_id");
  });

  it("validates organization payloads in the database", () => {
    expect(migration).toContain("not public.is_valid_cnpj(v_cnpj)");
    expect(migration).toContain("Este tipo de conta nao pode criar uma organizacao.");
    expect(migration).toContain("Dados da organizacao invalidos ou incompletos.");
  });
});
