drop function if exists public.set_my_producer_products(uuid[]);
drop function if exists public.list_my_producer_product_ids();
drop function if exists public.search_product_catalog(text);
drop trigger if exists prepare_product_alias on public.product_aliases;
drop function if exists public.prepare_product_alias();
drop trigger if exists prepare_catalog_product on public.products;
drop function if exists public.prepare_catalog_product();
drop table if exists public.producer_products;
drop table if exists public.product_aliases;
drop index if exists public.products_catalog_category_name_idx;
drop index if exists public.products_normalized_available_unique;
drop policy if exists "catalog products readable" on public.products;
create policy "products readable" on public.products for select using (true);
alter table public.products
  drop column if exists normalized_name,
  drop column if exists status,
  drop column if exists created_by,
  drop column if exists created_at,
  drop column if exists updated_at;
drop function if exists public.normalize_product_name(text);
