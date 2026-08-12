import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/036_high_priority_flow_hardening.sql"),
  "utf8",
);

describe("high priority flow hardening", () => {
  it("prevents browser-created or deleted application identities", () => {
    expect(migration).toContain('drop policy if exists "profiles own row"');
    expect(migration).toContain('drop policy if exists "producers own insert"');
    expect(migration).toContain('drop policy if exists "buyers own data"');
    expect(migration).toContain("profiles_one_per_auth_user");
    expect(migration).toContain("require_organization_creator_producer");
    expect(migration).toContain("protect_producer_commercial_verification");
  });

  it("moves demand creation and responses into atomic functions", () => {
    expect(migration).toContain("secure_create_demand");
    expect(migration).toContain("secure_respond_demand");
    expect(migration).toContain('drop policy if exists "Comprador atualiza propria demanda"');
  });

  it("does not expose one producer's proposal to another", () => {
    expect(migration).toContain("response items visible to participants");
    expect(migration).toContain("producers read open or own quote requests");
  });

  it("enforces file and message limits in backend services", () => {
    expect(migration).toContain("messages_nonblank");
    expect(migration).toContain("file_size_limit=31457280");
    expect(migration).toContain("allowed_mime_types");
  });
});
