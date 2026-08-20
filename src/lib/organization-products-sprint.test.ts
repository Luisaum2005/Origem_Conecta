import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("migration de supervisão de produtos", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/045_organization_product_details.sql"),
    "utf8",
  );

  it("restringe a consulta aos gestores das organizações", () => {
    expect(sql).toContain("public.can_manage_organization(o.id)");
    expect(sql).toContain("security definer");
    expect(sql).toContain("revoke all on function");
  });

  it("retorna os dados essenciais dos cartões", () => {
    expect(sql).toContain("organization_cnpj text");
    expect(sql).toContain("producer_id uuid");
    expect(sql).toContain("price numeric");
    expect(sql).toContain("image_url text");
  });

  it("notifica o produtor quando a publicação é pausada ou liberada", () => {
    expect(sql).toContain("public.create_system_notification");
    expect(sql).toContain("Publicacao pausada pela organizacao");
    expect(sql).toContain("Publicacao liberada pela organizacao");
  });
});
