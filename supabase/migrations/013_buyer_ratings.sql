-- Migration for Buyer Ratings by Producers
create table public.buyer_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  producer_id uuid not null references public.producers(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint unique_order_rating unique (order_id)
);

alter table public.buyer_ratings enable row level security;

-- Policy to allow authenticated users to view ratings
create policy "authenticated users can view ratings" on public.buyer_ratings
  for select using (auth.uid() is not null);

-- Policy to allow producers to insert ratings for their delivered orders
create policy "producers can insert rating for their delivered orders" on public.buyer_ratings
  for insert with check (
    -- The user must be the producer creating the rating
    producer_id in (
      select id from public.producers
      where profile_id in (
        select id from public.profiles
        where user_id = auth.uid()
      )
    )
    -- The rating must correspond to a delivered order they participated in, matching the order buyer
    and exists (
      select 1 from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.id = order_id
        and o.buyer_id = buyer_ratings.buyer_id
        and oi.producer_id = buyer_ratings.producer_id
        and o.status = 'entregue'
    )
  );
