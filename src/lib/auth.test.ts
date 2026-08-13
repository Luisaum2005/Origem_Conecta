import {
  AuthProvider,
  buildSignupPayload,
  shouldRestoreProfileForAuthEvent,
  useAuth,
} from "@/lib/auth";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

function AuthStateProbe() {
  const { loading, profile } = useAuth();
  return createElement("span", null, `${loading}:${profile?.id ?? "none"}`);
}

describe("inicializaÃ§Ã£o segura da sessÃ£o", () => {
  it("renderiza um estado neutro e carregando antes da hidrataÃ§Ã£o", () => {
    const html = renderToStaticMarkup(
      createElement(AuthProvider, null, createElement(AuthStateProbe)),
    );

    expect(html).toContain("true:none");
  });
});

describe("eventos de sessao", () => {
  it("ignora a renovacao silenciosa que ocorre ao voltar para a aba", () => {
    expect(shouldRestoreProfileForAuthEvent("TOKEN_REFRESHED", "user-1", "user-1")).toBe(false);
    expect(shouldRestoreProfileForAuthEvent("SIGNED_IN", "user-1", "user-1")).toBe(false);
    expect(shouldRestoreProfileForAuthEvent("USER_UPDATED", "user-1", "user-1")).toBe(true);
  });
});

describe("payload transacional de cadastro", () => {
  it("não envia senha nem código administrativo aos metadados", () => {
    const payload = buildSignupPayload({
      tipo: "comprador",
      nome: "Comprador Teste",
      email: "teste@example.com",
      password: "segredo-123",
      adminInviteCode: "codigo-secreto",
      buyer: {
        nomeEmpresa: "Mercado",
        tipoEmpresa: "Supermercado",
        cnpj: "123",
        postalCode: "17800000",
        addressLine: "Rua das Flores",
        neighborhood: "Centro",
      },
    });
    expect(payload).not.toHaveProperty("password");
    expect(payload).not.toHaveProperty("adminInviteCode");
  });

  it("preserva o tipo de estabelecimento selecionado", () => {
    const payload = buildSignupPayload({
      tipo: "comprador",
      nome: "Responsável",
      email: "hotel@example.com",
      password: "12345678",
      buyer: {
        nomeEmpresa: "Hotel Central",
        tipoEmpresa: "Hotel",
        cnpj: "123",
        postalCode: "17800000",
        addressLine: "Rua das Flores",
        neighborhood: "Centro",
      },
    });
    expect(payload.buyer?.tipoEmpresa).toBe("Hotel");
  });

  it("preserva os dados operacionais completos do produtor", () => {
    const payload = buildSignupPayload({
      tipo: "produtor",
      nome: "Ana Produtora",
      email: "ana@example.com",
      password: "segredo-123",
      telefone: "14999999999",
      cidade: "Tupã",
      estado: "SP",
      producer: {
        nomePropriedade: "Sítio Boa Safra",
        responsavel: "Ana Produtora",
        cnpj: "123",
        produtos: ["Abacate"],
        commercializationMode: "own",
        caepf: "123",
        stateRegistration: "456",
        postalCode: "17600000",
        addressLine: "Estrada Rural",
        addressNumber: "10",
        addressComplement: "Km 2",
        neighborhood: "Zona Rural",
      },
    });

    expect(payload.producer).toMatchObject({
      postalCode: "17600000",
      addressLine: "Estrada Rural",
      neighborhood: "Zona Rural",
      produtos: ["Abacate"],
    });
  });
});
