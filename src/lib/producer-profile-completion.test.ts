import { describe, expect, it } from "vitest";
import { hasMissingProducerProducts } from "@/lib/producer-profile";

describe("pendência de produtos do produtor", () => {
  it("mantém a pendência enquanto nenhum produto foi informado", () => {
    expect(hasMissingProducerProducts({ products: [] })).toBe(true);
  });

  it("resolve a pendência quando existe ao menos um produto", () => {
    expect(hasMissingProducerProducts({ products: ["Abacate"] })).toBe(false);
  });
});
