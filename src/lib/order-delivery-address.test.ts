import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatDeliveryAddress } from "@/lib/orders";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/038_order_delivery_address_and_producer_chat.sql"),
  "utf8",
);

describe("endereço de entrega do pedido", () => {
  it("formata o endereço completo para a operação do produtor", () => {
    expect(
      formatDeliveryAddress({
        addressLine: "Rua das Flores",
        addressNumber: "123",
        addressComplement: "Sala 2",
        neighborhood: "Centro",
        city: "Adamantina",
        state: "SP",
      }),
    ).toBe("Rua das Flores, 123 - Sala 2 - Centro - Adamantina, SP");
  });

  it("não apresenta um endereço parcial como se estivesse completo", () => {
    expect(formatDeliveryAddress({ addressLine: "", city: "Adamantina", state: "SP" })).toBe(
      "Endereço de entrega não informado",
    );
  });

  it("mantém o endereço fora da leitura direta da tabela de pedidos", () => {
    expect(migration).toContain("get_my_order_delivery_addresses");
    expect(migration).toContain("from public.order_items oi");
    expect(migration).toContain("where oi.order_id=o.id and p.user_id=auth.uid()");
    expect(migration).toContain("Complete o endereço de entrega no seu perfil");
  });
});
