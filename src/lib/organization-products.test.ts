import { describe, expect, it } from "vitest";
import { isOrganizationProductOutdated } from "@/lib/organization-products";

describe("isOrganizationProductOutdated", () => {
  const now = new Date("2026-08-12T12:00:00.000Z");

  it("considera desatualizada uma publicação sem atualização há mais de 30 dias", () => {
    expect(isOrganizationProductOutdated("2026-07-01T12:00:00.000Z", now)).toBe(true);
  });

  it("mantém como atual uma publicação atualizada nos últimos 30 dias", () => {
    expect(isOrganizationProductOutdated("2026-08-01T12:00:00.000Z", now)).toBe(false);
  });
});
