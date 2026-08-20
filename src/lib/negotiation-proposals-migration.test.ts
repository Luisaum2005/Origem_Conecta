import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/050_chat_negotiation_proposals.sql"),
  "utf8",
).toLowerCase();

describe("chat negotiation proposal migration", () => {
  it("mantém apenas uma proposta pendente por conversa", () => {
    expect(migration).toContain("negotiation_proposals_one_pending_idx");
    expect(migration).toContain("where status='pending'");
  });

  it("impede o autor de aceitar ou recusar a própria proposta", () => {
    expect(migration).toContain("v_proposal.created_by=v_profile.id");
    expect(migration).toContain("você não pode recusar a própria proposta");
    expect(migration).toContain("a proposta já está aceita por quem a enviou");
  });

  it("reserva estoque e cria o pedido dentro do aceite", () => {
    expect(migration).toContain("create or replace function public.accept_negotiation_proposal");
    expect(migration).toContain("insert into public.orders");
    expect(migration).toContain("quantidade_disponivel=quantidade_disponivel-v_item.quantity");
    expect(migration).toContain("update public.conversations set order_id=v_order.id");
  });

  it("não expõe as mutações para usuários anônimos", () => {
    expect(migration).toContain(
      "revoke all on function public.create_negotiation_proposal(uuid,jsonb,jsonb) from public,anon",
    );
    expect(migration).toContain(
      "grant execute on function public.accept_negotiation_proposal(uuid) to authenticated",
    );
  });
});
