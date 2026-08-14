import { describe, expect, it } from "vitest";
import { mapMembership } from "@/lib/organization-memberships";

describe("mapMembership", () => {
  it("mapeia os dados institucionais retornados ao produtor convidado", () => {
    const membership = mapMembership({
      id: "membership-1",
      organization_id: "organization-1",
      organization_name: "Cooperativa Vale Verde",
      organization_type: "cooperativa",
      organization_city: "Tupã",
      organization_state: "SP",
      producer_name: "João Produtor",
      producer_email: "joao@example.com",
      property_name: "Sítio Boa Vista",
      producer_location: "Tupã, SP",
      products: ["Abacate"],
      status: "invited",
      member_number: null,
      can_sell: false,
      created_at: "2026-08-14T12:00:00Z",
    });

    expect(membership).toMatchObject({
      organizationName: "Cooperativa Vale Verde",
      organizationType: "cooperativa",
      organizationCity: "Tupã",
      organizationState: "SP",
      status: "invited",
    });
  });
});
