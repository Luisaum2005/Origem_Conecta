import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/042_secure_producer_profile.sql"),
  "utf8",
);
const profileSource = readFileSync(resolve(process.cwd(), "src/lib/producer-profile.ts"), "utf8");

describe("private producer profile access", () => {
  it("loads private address fields only through an authenticated own-profile RPC", () => {
    expect(migration).toContain("get_my_producer_profile");
    expect(migration).toContain("where p.user_id=auth.uid() and pr.ativo");
    expect(migration).toContain("security definer");
    expect(migration).not.toContain("grant select (postal_code");
    expect(profileSource).toContain('rpc("get_my_producer_profile")');
  });

  it("updates the profile atomically through the scoped RPC", () => {
    expect(migration).toContain("secure_update_my_producer_profile");
    expect(migration).toContain("where p.user_id=auth.uid() and pr.ativo");
    expect(migration).toContain("Perfil de produtor nao encontrado.");
    expect(profileSource).toContain('rpc("secure_update_my_producer_profile"');
  });
});
