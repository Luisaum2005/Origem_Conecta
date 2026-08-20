import { supabase } from "@/lib/supabase";
import type { PaymentMethod } from "@/lib/orders";

export type ProposalStatus = "pending" | "accepted" | "rejected" | "superseded" | "expired";
export type DeliveryMethod = "Entrega" | "Retirada" | "A combinar";

export type ProposalInventoryItem = {
  inventoryId: string;
  productName: string;
  unit: string;
  availableQuantity: number;
  announcedPrice: number;
  imageUrl?: string;
  sellerOrganizationId?: string;
  sellerOrganizationName?: string;
  sellerOrganizationCnpj?: string;
};

export type NegotiationProposalItem = {
  id: string;
  inventoryId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  sellerOrganizationId?: string;
  sellerOrganizationName?: string;
  sellerOrganizationCnpj?: string;
};

export type NegotiationProposal = {
  id: string;
  conversationId: string;
  version: number;
  status: ProposalStatus;
  createdBy: string;
  supersedesId?: string;
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  deliveryAt?: string;
  deliveryNotes?: string;
  notes?: string;
  expiresAt: string;
  respondedAt?: string;
  respondedBy?: string;
  orderId?: string;
  createdAt: string;
  items: NegotiationProposalItem[];
};

export type ProposalDraft = {
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  deliveryAt?: string;
  deliveryNotes?: string;
  notes?: string;
  expiresAt: string;
  items: Array<{ inventoryId: string; quantity: number; unitPrice: number }>;
};

type ProposalRow = {
  id: string;
  conversation_id: string;
  version: number;
  status: ProposalStatus;
  created_by: string;
  supersedes_id: string | null;
  payment_method: PaymentMethod;
  delivery_method: DeliveryMethod;
  delivery_at: string | null;
  delivery_notes: string | null;
  notes: string | null;
  expires_at: string;
  responded_at: string | null;
  responded_by: string | null;
  order_id: string | null;
  created_at: string;
  negotiation_proposal_items: Array<{
    id: string;
    inventory_id: string;
    product_name: string;
    quantity: number | string;
    unit: string;
    unit_price: number | string;
    line_total: number | string;
    seller_organization_id: string | null;
    seller_organization_name: string | null;
    seller_organization_cnpj: string | null;
  }> | null;
};

function requireSupabase() {
  if (!supabase) throw new Error("As propostas comerciais precisam da conexão com o Supabase.");
  return supabase;
}

function mapProposal(row: ProposalRow): NegotiationProposal {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    version: row.version,
    status: row.status,
    createdBy: row.created_by,
    supersedesId: row.supersedes_id ?? undefined,
    paymentMethod: row.payment_method,
    deliveryMethod: row.delivery_method,
    deliveryAt: row.delivery_at ?? undefined,
    deliveryNotes: row.delivery_notes ?? undefined,
    notes: row.notes ?? undefined,
    expiresAt: row.expires_at,
    respondedAt: row.responded_at ?? undefined,
    respondedBy: row.responded_by ?? undefined,
    orderId: row.order_id ?? undefined,
    createdAt: row.created_at,
    items: (row.negotiation_proposal_items ?? []).map((item) => ({
      id: item.id,
      inventoryId: item.inventory_id,
      productName: item.product_name,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total),
      sellerOrganizationId: item.seller_organization_id ?? undefined,
      sellerOrganizationName: item.seller_organization_name ?? undefined,
      sellerOrganizationCnpj: item.seller_organization_cnpj ?? undefined,
    })),
  };
}

export async function listNegotiationProposals(
  conversationId: string,
): Promise<NegotiationProposal[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("negotiation_proposals")
    .select("*,negotiation_proposal_items(*)")
    .eq("conversation_id", conversationId)
    .order("version", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as ProposalRow[]).map(mapProposal);
}

export async function listProposalInventory(
  conversationId: string,
): Promise<ProposalInventoryItem[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("list_conversation_proposal_inventory", {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    inventoryId: String(row.inventory_id),
    productName: String(row.product_name),
    unit: String(row.unit),
    availableQuantity: Number(row.available_quantity),
    announcedPrice: Number(row.announced_price),
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    sellerOrganizationId: row.seller_organization_id
      ? String(row.seller_organization_id)
      : undefined,
    sellerOrganizationName: row.seller_organization_name
      ? String(row.seller_organization_name)
      : undefined,
    sellerOrganizationCnpj: row.seller_organization_cnpj
      ? String(row.seller_organization_cnpj)
      : undefined,
  }));
}

export async function createNegotiationProposal(conversationId: string, draft: ProposalDraft) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_negotiation_proposal", {
    p_conversation_id: conversationId,
    p_proposal: {
      paymentMethod: draft.paymentMethod,
      deliveryMethod: draft.deliveryMethod,
      deliveryAt: draft.deliveryAt || null,
      deliveryNotes: draft.deliveryNotes || null,
      notes: draft.notes || null,
      expiresAt: draft.expiresAt,
    },
    p_items: draft.items,
  });
  if (error) throw error;
  return data as { id: string; version: number };
}

export async function acceptNegotiationProposal(proposalId: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("accept_negotiation_proposal", {
    p_proposal_id: proposalId,
  });
  if (error) throw error;
  return data as { proposalId: string; orderId: string; createdAt: string };
}

export async function rejectNegotiationProposal(proposalId: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("reject_negotiation_proposal", {
    p_proposal_id: proposalId,
  });
  if (error) throw error;
  return data as { id: string; status: "rejected" };
}

export function subscribeToNegotiationProposals(conversationId: string, onChange: () => void) {
  if (!supabase) return () => undefined;
  const channel = supabase
    .channel(`negotiation_proposals:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "negotiation_proposals",
        filter: `conversation_id=eq.${conversationId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase?.removeChannel(channel);
  };
}

export function proposalTotal(proposal: NegotiationProposal) {
  return proposal.items.reduce((total, item) => total + item.lineTotal, 0);
}

export function effectiveProposalStatus(proposal: NegotiationProposal): ProposalStatus {
  if (proposal.status === "pending" && new Date(proposal.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }
  return proposal.status;
}
