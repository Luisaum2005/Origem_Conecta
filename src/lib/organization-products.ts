import { assertSupabaseConfigured, throwSupabaseError } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

export type OrganizationProduct = {
  id: string;
  organizationId: string;
  organizationName: string;
  productName: string;
  producerName: string;
  propertyName: string;
  unit: string;
  availableQuantity: number;
  minimumStock: number;
  active: boolean;
  organizationPaused: boolean;
  updatedAt: string;
};

export function isOrganizationProductOutdated(updatedAt: string, now = new Date()) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return false;
  return now.getTime() - date.getTime() > 30 * 24 * 60 * 60 * 1000;
}

function mapProduct(row: Record<string, unknown>): OrganizationProduct {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    organizationName: String(row.organization_name),
    productName: String(row.product_name),
    producerName: String(row.producer_name),
    propertyName: String(row.property_name),
    unit: String(row.unit),
    availableQuantity: Number(row.available_quantity ?? 0),
    minimumStock: Number(row.minimum_stock ?? 0),
    active: Boolean(row.is_active),
    organizationPaused: Boolean(row.organization_paused),
    updatedAt: String(row.updated_at),
  };
}

export async function listManagedOrganizationProducts() {
  const { data, error } = await assertSupabaseConfigured().rpc(
    "list_managed_organization_products",
  );
  throwSupabaseError(error);
  return (data ?? []).map((row: Record<string, unknown>) => mapProduct(row));
}

export async function setOrganizationProductPaused(inventoryId: string, paused: boolean) {
  const { error } = await assertSupabaseConfigured().rpc("set_organization_product_paused", {
    p_inventory_id: inventoryId,
    p_paused: paused,
  });
  throwSupabaseError(error);
}

export function useOrganizationProducts() {
  const [products, setProducts] = useState<OrganizationProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await listManagedOrganizationProducts());
      setError("");
    } catch (queryError) {
      setError(
        queryError instanceof Error
          ? queryError.message
          : "Não foi possível carregar os produtos da organização.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { products, loading, error, refresh };
}
