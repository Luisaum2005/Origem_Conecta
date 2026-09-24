-- Desfaz 20260924130000_producer_ratings.sql
drop trigger if exists notifications_after_producer_rating on public.producer_ratings;
drop function if exists public.notify_producer_rating();
drop table if exists public.producer_ratings;
