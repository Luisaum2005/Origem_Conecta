import { assertSupabaseConfigured, throwSupabaseError } from "@/lib/supabase";

export type CatalogProduct = {
  id: string;
  name: string;
  category: string;
  defaultUnit: string;
  status: "active" | "pending";
};

export type ProductRequestResult = {
  productId: string;
  status: "active" | "pending";
  productName: string;
  alreadyExisted: boolean;
};

export function mapProductRequestResult(row: Record<string, unknown>): ProductRequestResult {
  return {
    productId: String(row.product_id),
    status: row.request_status as ProductRequestResult["status"],
    productName: String(row.product_name),
    alreadyExisted: Boolean(row.already_existed),
  };
}

export function mapCatalogProduct(row: Record<string, unknown>): CatalogProduct {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    defaultUnit: String(row.default_unit),
    status: row.status as CatalogProduct["status"],
  };
}

export async function searchProductCatalog(query = ""): Promise<CatalogProduct[]> {
  const { data, error } = await assertSupabaseConfigured().rpc("search_product_catalog", {
    p_query: query,
  });
  throwSupabaseError(error);
  return (data ?? []).map((row: Record<string, unknown>) => mapCatalogProduct(row));
}

export async function loadMyProducerProductIds(): Promise<string[]> {
  const { data, error } = await assertSupabaseConfigured().rpc("list_my_producer_product_ids");
  throwSupabaseError(error);
  return (data ?? []).map((row: Record<string, unknown>) => String(row.product_id));
}

export async function saveMyProducerProductIds(productIds: string[]) {
  const { error } = await assertSupabaseConfigured().rpc("set_my_producer_products", {
    p_product_ids: productIds,
  });
  throwSupabaseError(error);
}

export async function requestCatalogProduct(input: {
  name: string;
  category: string;
  defaultUnit: string;
}): Promise<ProductRequestResult> {
  const { data, error } = await assertSupabaseConfigured().rpc("request_catalog_product", {
    p_name: input.name,
    p_category: input.category,
    p_default_unit: input.defaultUnit,
  });
  throwSupabaseError(error);
  return mapProductRequestResult((data?.[0] ?? {}) as Record<string, unknown>);
}
