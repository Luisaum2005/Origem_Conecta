import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("migration de associados gerenciados", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/044_managed_organization_members.sql"),
    "utf8",
  );

  it("exige permissão de gestão e não abre as tabelas protegidas", () => {
    expect(sql).toContain("insert into public.organization_users");
    expect(sql).toContain("public.can_manage_organization(p_organization_id)");
    expect(sql).toContain("security definer");
    expect(sql).toContain("revoke all on function");
    expect(sql).toContain("grant execute on function");
    expect(sql).toContain("update_organization_member_number");
  });

  it("retorna dados operacionais essenciais e contadores", () => {
    expect(sql).toContain("producer_phone text");
    expect(sql).toContain("commercialization_mode text");
    expect(sql).toContain("active_products_count bigint");
    expect(sql).toContain("open_negotiations_count bigint");
    expect(sql).toContain("joined_at timestamptz");
  });
});
