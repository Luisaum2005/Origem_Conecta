drop function if exists public.review_catalog_product_request(uuid,text,text);
drop function if exists public.list_pending_product_requests();
drop function if exists public.list_my_product_requests();
drop function if exists public.request_catalog_product(text,text,text);

alter table public.products
  drop column if exists reviewed_at,
  drop column if exists reviewed_by,
  drop column if exists review_note;
