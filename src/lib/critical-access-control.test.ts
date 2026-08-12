import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/035_critical_access_control_hardening.sql"),
  "utf8",
);

describe("critical access-control hardening", () => {
  it("removes direct order and order-item mutation policies", () => {
    expect(migration).toContain('drop policy if exists "order items update by buyer"');
    expect(migration).toContain('drop policy if exists "order items delete by buyer"');
    expect(migration).toContain('drop policy if exists "buyers delete incomplete orders"');
    expect(migration).toContain('drop policy if exists "orders delete by quote producer"');
  });

  it("does not expose producer inventory anonymously", () => {
    expect(migration).toContain('drop policy if exists "inventory readable"');
    expect(migration).toContain("revoke select on public.producer_inventory from public,anon");
    expect(migration).toContain("list_active_portfolio_inventory");
    expect(migration).toContain("and not coalesce(pi.organization_paused,false)");
  });

  it("keeps the legacy producer CNPJ outside authenticated table reads", () => {
    const producerGrant = migration.match(
      /grant select \([\s\S]*?\) on public\.producers to authenticated;/,
    )?.[0];
    expect(producerGrant).toBeTruthy();
    expect(producerGrant).not.toContain("cnpj");
  });

  it("protects organization legal identity from browser updates", () => {
    expect(migration).toContain('drop policy if exists "owners update own organization data"');
    expect(migration).toContain("protect_organization_legal_identity_fields");
    expect(migration).toContain("new.cnpj is distinct from old.cnpj");
  });
});
