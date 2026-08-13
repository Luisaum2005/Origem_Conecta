import { describe, expect, it } from "vitest";
import {
  isNavigationItemActive,
  isOrganizationContext,
  isOrganizationDashboardPath,
  organizationNavigation,
  producerAreaNavigationItem,
} from "@/lib/organization-navigation";

describe("navegação da organização", () => {
  it("renderiza o painel somente na rota principal", () => {
    expect(isOrganizationDashboardPath("/organizations")).toBe(true);
    expect(isOrganizationDashboardPath("/organizations/")).toBe(true);
    expect(isOrganizationDashboardPath("/organizations/members")).toBe(false);
    expect(isOrganizationDashboardPath("/organizations/products")).toBe(false);
  });

  it("mantém as páginas institucionais dentro do contexto da organização", () => {
    expect(isOrganizationContext("/organizations/messages", true)).toBe(true);
    expect(isOrganizationContext("/profile/organization", true)).toBe(true);
    expect(isOrganizationContext("/profile/producer", true)).toBe(false);
  });

  it("possui destinos distintos e permite voltar à área do produtor", () => {
    const destinations = organizationNavigation.map((item) => item.to);

    expect(new Set(destinations).size).toBe(destinations.length);
    expect(destinations).toContain("/organizations/members");
    expect(destinations).toContain("/organizations/products");
    expect(destinations).toContain("/organizations/negotiations");
    expect(destinations).toContain("/organizations/messages");
    expect(producerAreaNavigationItem.to).toBe("/profile/producer");
  });

  it("destaca somente a seção correspondente", () => {
    expect(isNavigationItemActive("/organizations/products", "/organizations", true)).toBe(false);
    expect(
      isNavigationItemActive("/organizations/products", "/organizations/products", false),
    ).toBe(true);
  });
});
