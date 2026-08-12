import { assertSupabaseConfigured, throwSupabaseError } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

export type OrganizationNegotiationStatus =
  | "recebido"
  | "em_separacao"
  | "em_entrega"
  | "entregue"
  | "cancelado";

export type OrganizationNegotiationItem = {
  productName: string;
  quantity: number;
  unit: string;
  producerId?: string;
  producerName: string;
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
};

export type OrganizationNegotiation = {
  orderId: string;
  organizationId: string;
  organizationName: string;
  buyerName: string;
  status: OrganizationNegotiationStatus;
  createdAt: string;
  deliveryLabel?: string;
  items: OrganizationNegotiationItem[];
};

function mapItem(value: unknown): OrganizationNegotiationItem {
  const item = (value ?? {}) as Record<string, unknown>;
  return {
    productName: String(item.productName ?? "Produto"),
    quantity: Number(item.quantity ?? 0),
    unit: String(item.unit ?? "kg"),
    producerId: item.producerId ? String(item.producerId) : undefined,
    producerName: String(item.producerName ?? "Produtor"),
    confirmedAt: item.confirmedAt ? String(item.confirmedAt) : undefined,
    shippedAt: item.shippedAt ? String(item.shippedAt) : undefined,
    deliveredAt: item.deliveredAt ? String(item.deliveredAt) : undefined,
  };
}

function mapNegotiation(row: Record<string, unknown>): OrganizationNegotiation {
  return {
    orderId: String(row.order_id),
    organizationId: String(row.organization_id),
    organizationName: String(row.organization_name ?? "Organização"),
    buyerName: String(row.buyer_name ?? "Comprador"),
    status: row.order_status as OrganizationNegotiationStatus,
    createdAt: String(row.created_at),
    deliveryLabel: row.delivery_label ? String(row.delivery_label) : undefined,
    items: Array.isArray(row.items) ? row.items.map(mapItem) : [],
  };
}

export function getNegotiationProducers(negotiation: OrganizationNegotiation) {
  return Array.from(new Set(negotiation.items.map((item) => item.producerName)));
}

export function useOrganizationNegotiations() {
  const [negotiations, setNegotiations] = useState<OrganizationNegotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: queryError } = await assertSupabaseConfigured().rpc(
        "list_managed_organization_negotiations",
      );
      throwSupabaseError(queryError);
      setNegotiations((data ?? []).map((row: Record<string, unknown>) => mapNegotiation(row)));
      setError("");
    } catch (queryError) {
      setError(
        queryError instanceof Error
          ? queryError.message
          : "Não foi possível carregar as negociações da organização.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { negotiations, loading, error, refresh };
}

export async function listManagedOrganizationNegotiations() {
  const { data, error } = await assertSupabaseConfigured().rpc(
    "list_managed_organization_negotiations",
  );
  throwSupabaseError(error);
  return (data ?? []).map((row: Record<string, unknown>) => mapNegotiation(row));
}
