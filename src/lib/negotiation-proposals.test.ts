import { describe, expect, it, vi } from "vitest";
import {
  effectiveProposalStatus,
  proposalTotal,
  type NegotiationProposal,
} from "./negotiation-proposals";

function proposal(overrides: Partial<NegotiationProposal> = {}): NegotiationProposal {
  return {
    id: "proposal-1",
    conversationId: "conversation-1",
    version: 1,
    status: "pending",
    createdBy: "profile-1",
    paymentMethod: "Pix",
    deliveryMethod: "Entrega",
    expiresAt: "2026-08-25T12:00:00.000Z",
    createdAt: "2026-08-20T12:00:00.000Z",
    items: [
      {
        id: "item-1",
        inventoryId: "inventory-1",
        productName: "Acerola",
        quantity: 10,
        unit: "kg",
        unitPrice: 2.5,
        lineTotal: 25,
      },
      {
        id: "item-2",
        inventoryId: "inventory-2",
        productName: "Laranja",
        quantity: 5,
        unit: "kg",
        unitPrice: 3,
        lineTotal: 15,
      },
    ],
    ...overrides,
  };
}

describe("negotiation proposals", () => {
  it("soma todos os itens da proposta", () => {
    expect(proposalTotal(proposal())).toBe(40);
  });

  it("considera uma proposta pendente expirada pelo horário", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T12:00:00.000Z"));
    expect(effectiveProposalStatus(proposal())).toBe("expired");
    vi.useRealTimers();
  });

  it("preserva estados finais", () => {
    expect(effectiveProposalStatus(proposal({ status: "accepted" }))).toBe("accepted");
  });
});
