import { describe, expect, it } from "vitest";
import { calculateMembershipMetrics } from "@/lib/organization-dashboard";
import type { Membership } from "@/lib/organization-memberships";

function membership(status: Membership["status"], canSell = false): Membership {
  return {
    id: crypto.randomUUID(),
    organizationId: "organization-1",
    organizationName: "Cooperativa Teste",
    producerName: "Produtor",
    producerEmail: "produtor@teste.com",
    propertyName: "Sítio Teste",
    products: [],
    status,
    canSell,
    commercializationMode: "undecided",
    activeProductsCount: 0,
    openNegotiationsCount: 0,
    createdAt: new Date().toISOString(),
  };
}

describe("calculateMembershipMetrics", () => {
  it("conta somente associados ativos autorizados para comercialização", () => {
    const result = calculateMembershipMetrics([
      membership("active", true),
      membership("active", false),
      membership("pending", true),
      membership("invited"),
      membership("inactive", true),
    ]);

    expect(result).toEqual({
      activeMembers: 2,
      pendingRequests: 1,
      invitedMembers: 1,
      authorizedMembers: 1,
    });
  });
});
