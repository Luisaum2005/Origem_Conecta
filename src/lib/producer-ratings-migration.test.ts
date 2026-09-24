import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260924130000_producer_ratings.sql"),
  "utf8",
);
const screen = readFileSync(resolve(process.cwd(), "src/routes/rating.tsx"), "utf8");

describe("avaliação do comprador sobre o produtor", () => {
  it("só o comprador do pedido entregue insere", () => {
    expect(migration).toContain("where b.id=producer_ratings.buyer_id and p.user_id=auth.uid()");
    expect(migration).toContain("and o.status='entregue'");
    expect(migration).toContain("revoke all on table public.producer_ratings from public,anon");
  });

  it("a tela usa a tabela nova, não buyer_ratings (produtor avalia comprador)", () => {
    expect(screen).toContain("createProducerRating");
    expect(screen).not.toContain("@/lib/ratings");
  });
});
