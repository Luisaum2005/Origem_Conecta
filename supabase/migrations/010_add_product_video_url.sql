alter table public.producer_inventory
  add column if not exists video_url text;
