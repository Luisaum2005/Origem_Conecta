import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_SUPPLIER_PRODUCTS, SUPPLIER_PRODUCT_GROUPS } from "@/lib/hortifruti";
import { mapCatalogProduct, mapProductRequestResult } from "@/lib/product-catalog";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/047_central_product_catalog.sql"),
  "utf8",
);
const requestMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/048_product_catalog_requests.sql"),
  "utf8",
);
const cleanupMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/053_clean_and_expand_product_catalog.sql"),
  "utf8",
);

describe("catálogo central de produtos", () => {
  it("mapeia o formato seguro retornado pela busca", () => {
    expect(
      mapCatalogProduct({
        id: "product-1",
        name: "Limão Tahiti",
        category: "Frutas",
        default_unit: "kg",
        status: "active",
      }),
    ).toEqual({
      id: "product-1",
      name: "Limão Tahiti",
      category: "Frutas",
      defaultUnit: "kg",
      status: "active",
    });
  });

  it("normaliza nomes, mantém sinônimos e sincroniza a compatibilidade legada", () => {
    expect(migration).toContain("normalize_product_name");
    expect(migration).toContain("create table if not exists public.product_aliases");
    expect(migration).toContain("create table if not exists public.producer_products");
    expect(migration).toContain("'Limão Taiti'");
    expect(migration).toContain("categorias_atendidas=coalesce");
  });

  it("expõe apenas operações autenticadas e vinculadas ao próprio produtor", () => {
    expect(migration).toContain("where p.user_id=auth.uid() and pr.ativo");
    expect(migration).toContain("grant execute on function public.search_product_catalog");
    expect(migration).toContain("grant execute on function public.set_my_producer_products");
  });

  it("mapeia o retorno de uma solicitação de produto", () => {
    expect(
      mapProductRequestResult({
        product_id: "product-2",
        request_status: "pending",
        product_name: "Ora-pro-nóbis",
        already_existed: false,
      }),
    ).toEqual({
      productId: "product-2",
      status: "pending",
      productName: "Ora-pro-nóbis",
      alreadyExisted: false,
    });
  });

  it("mantém solicitações pendentes privadas e exige revisão administrativa", () => {
    expect(requestMigration).toContain("and p.tipo='produtor'");
    expect(requestMigration).toContain("'pending'");
    expect(requestMigration).toContain("if not public.is_platform_admin()");
    expect(requestMigration).toContain("product-request:");
    expect(requestMigration).toContain("grant execute on function public.request_catalog_product");
  });

  it("mantém a lista do cadastro limpa, clara e sem duplicidades", () => {
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const normalizedProducts = ALL_SUPPLIER_PRODUCTS.map(normalize);

    expect(new Set(normalizedProducts).size).toBe(normalizedProducts.length);
    expect(ALL_SUPPLIER_PRODUCTS).toContain("Limão Tahiti");
    expect(ALL_SUPPLIER_PRODUCTS).not.toContain("Limão Taiti");
    expect(ALL_SUPPLIER_PRODUCTS).not.toContain("Murcot");
    expect(ALL_SUPPLIER_PRODUCTS).not.toContain("Poncã");
    expect(ALL_SUPPLIER_PRODUCTS).not.toContain("Leite Cru");
    expect(ALL_SUPPLIER_PRODUCTS).toContain("Acerola");
    expect(SUPPLIER_PRODUCT_GROUPS.map((group) => group.group)).toContain(
      "Raízes, tubérculos e bulbos",
    );
  });

  it("migra nomes antigos sem perder os vínculos dos produtores", () => {
    expect(cleanupMigration).toContain("insert into public.producer_products");
    expect(cleanupMigration).toContain("update public.producer_inventory set product_id=v_target_id");
    expect(cleanupMigration).toContain("'Limão Taiti','Limão Tahiti'");
    expect(cleanupMigration).toContain("'Mussarela','Muçarela'");
    expect(cleanupMigration).toContain("('Acerola','Frutas','kg')");
  });
});
