import { describe, expect, it } from "vitest";
import {
  getNegotiationProducers,
  type OrganizationNegotiation,
} from "@/lib/organization-negotiations";

describe("getNegotiationProducers", () => {
  it("remove nomes duplicados mantendo todos os produtores responsáveis", () => {
    const negotiation = {
      items: [
        { productName: "Laranja", quantity: 10, unit: "kg", producerName: "Ana" },
        { productName: "Limão", quantity: 5, unit: "kg", producerName: "Ana" },
        { productName: "Mel", quantity: 2, unit: "kg", producerName: "Carlos" },
      ],
    } as OrganizationNegotiation;

    expect(getNegotiationProducers(negotiation)).toEqual(["Ana", "Carlos"]);
  });
});
