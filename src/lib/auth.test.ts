import { buildSignupPayload } from "@/lib/auth";
import { describe, expect, it } from "vitest";

describe("payload transacional de cadastro", () => {
  it("não envia senha nem código administrativo aos metadados", () => {
    const payload = buildSignupPayload({
      tipo: "comprador",
      nome: "Comprador Teste",
      email: "teste@example.com",
      password: "segredo-123",
      adminInviteCode: "codigo-secreto",
      buyer: { nomeEmpresa: "Mercado", tipoEmpresa: "Supermercado", cnpj: "123" },
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
      buyer: { nomeEmpresa: "Hotel Central", tipoEmpresa: "Hotel", cnpj: "123" },
    });
    expect(payload.buyer?.tipoEmpresa).toBe("Hotel");
  });
});
