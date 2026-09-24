-- Avaliação do comprador sobre o produtor (tela "Avaliar entrega").
-- buyer_ratings é o sentido inverso (produtor avalia comprador) e só aceita insert do produtor.
create table if not exists public.producer_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  producer_id uuid not null references public.producers(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 2000),
  created_at timestamptz not null default now(),
  constraint producer_ratings_order_producer_key unique (order_id, producer_id)
);

create index if not exists producer_ratings_producer_idx on public.producer_ratings(producer_id);

alter table public.producer_ratings enable row level security;

revoke all on table public.producer_ratings from public,anon;
grant select, insert on table public.producer_ratings to authenticated;

-- Só as duas partes do pedido leem a avaliação.
create policy "participants read producer ratings" on public.producer_ratings
  for select to authenticated using (
    exists (
      select 1 from public.buyers b join public.profiles p on p.id=b.profile_id
      where b.id=producer_ratings.buyer_id and p.user_id=auth.uid()
    )
    or exists (
      select 1 from public.producers pr join public.profiles p on p.id=pr.profile_id
      where pr.id=producer_ratings.producer_id and p.user_id=auth.uid()
    )
  );

-- O comprador avalia um produtor que participou de um pedido seu já entregue.
create policy "buyers rate producers of delivered orders" on public.producer_ratings
  for insert to authenticated with check (
    exists (
      select 1 from public.buyers b join public.profiles p on p.id=b.profile_id
      where b.id=producer_ratings.buyer_id and p.user_id=auth.uid()
    )
    and exists (
      select 1 from public.orders o
      join public.order_items oi on oi.order_id=o.id
      where o.id=producer_ratings.order_id
        and o.buyer_id=producer_ratings.buyer_id
        and oi.producer_id=producer_ratings.producer_id
        and o.status='entregue'
    )
  );

create or replace function public.notify_producer_rating() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare recipient uuid;
begin
  select p.user_id into recipient from public.producers pr join public.profiles p on p.id=pr.profile_id where pr.id=new.producer_id;
  if recipient is not null and recipient <> auth.uid() then perform public.create_system_notification(recipient,'rating','Nova avaliação recebida','Um comprador avaliou sua entrega com '||new.rating||' estrelas.',jsonb_build_object('url','/producer/orders','ratingId',new.id),'producer-rating:'||new.id); end if;
  return new;
end; $$;

revoke all on function public.notify_producer_rating() from public,anon,authenticated;

create trigger notifications_after_producer_rating after insert on public.producer_ratings for each row execute function public.notify_producer_rating();
