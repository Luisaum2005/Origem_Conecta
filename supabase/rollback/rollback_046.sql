drop trigger if exists sync_missing_products_after_insert on public.producers;
drop trigger if exists sync_missing_products_after_update on public.producers;
drop function if exists public.sync_missing_producer_products_notification();
drop index if exists public.notifications_user_unresolved_created_idx;
alter table public.notifications drop column if exists resolved_at;
