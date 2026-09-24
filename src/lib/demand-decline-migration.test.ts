import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260924120000_decline_demand_response.sql"),
  "utf8",
);

describe("recusa de proposta de demanda", () => {
  it("só o comprador dono da demanda recusa, e só propostas ainda enviadas", () => {
    expect(migration).toContain("v_response.status<>'enviada'");
    expect(migration).toContain("where b.id=v_demand.buyer_id and p.user_id=auth.uid()");
    expect(migration).toContain("for update");
  });

  it("não fica exposta a usuários anônimos", () => {
    expect(migration).toContain(
      "revoke all on function public.secure_decline_demand_response(uuid) from public,anon",
    );
    expect(migration).toContain(
      "grant execute on function public.secure_decline_demand_response(uuid) to authenticated",
    );
  });

  it("reabre a demanda sem outras propostas e avisa o produtor", () => {
    expect(migration).toContain("update public.demand_requests set status='aberta'");
    expect(migration).toContain("'Proposta recusada'");
  });
});
