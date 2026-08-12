import {
  filterOrganizationConversations,
  mapOrganizationConversation,
} from "@/lib/organization-messages";
import { describe, expect, it } from "vitest";

const conversations = [
  mapOrganizationConversation({
    conversation_id: "conversation-1",
    organization_id: "organization-1",
    organization_name: "Cooperativa Verde",
    order_id: "order-1",
    buyer_name: "Mercado Central",
    producer_name: "Sítio Esperança",
    last_message_at: "2026-08-12T12:00:00Z",
    last_message_text: "Podemos entregar amanhã",
    message_count: "3",
  }),
];

describe("organization messages", () => {
  it("maps numeric message counts returned by Postgres", () => {
    expect(conversations[0].messageCount).toBe(3);
  });

  it("searches buyer, producer, organization and message content", () => {
    expect(filterOrganizationConversations(conversations, "esperança", "all")).toHaveLength(1);
    expect(filterOrganizationConversations(conversations, "amanhã", "all")).toHaveLength(1);
    expect(filterOrganizationConversations(conversations, "inexistente", "all")).toHaveLength(0);
  });

  it("limits results to the selected organization", () => {
    expect(filterOrganizationConversations(conversations, "", "organization-2")).toHaveLength(0);
  });
});
