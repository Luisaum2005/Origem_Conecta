import { validateOrganizationSettings, type OrganizationSettings } from "@/lib/organizations";
import { describe, expect, it } from "vitest";

const validSettings: OrganizationSettings = {
  tradeName: "Cooperativa Verde",
  email: "contato@cooperativa.com.br",
  phone: "(14) 99999-9999",
  addressLine: "Rua das Flores",
  addressNumber: "100",
  addressComplement: "",
  neighborhood: "Centro",
  city: "Tupã",
  state: "SP",
  postalCode: "17600-000",
  responsibleName: "Maria Silva",
  responsibleRole: "Presidente",
};

describe("organization settings", () => {
  it("accepts complete contact and address data", () => {
    expect(validateOrganizationSettings(validSettings)).toBe("");
  });

  it("rejects invalid contact information", () => {
    expect(validateOrganizationSettings({ ...validSettings, email: "email-invalido" })).toContain(
      "e-mail",
    );
    expect(validateOrganizationSettings({ ...validSettings, phone: "123" })).toContain("telefone");
  });

  it("rejects invalid postal code and state", () => {
    expect(validateOrganizationSettings({ ...validSettings, postalCode: "123" })).toContain("CEP");
    expect(validateOrganizationSettings({ ...validSettings, state: "São Paulo" })).toContain("UF");
  });
});
