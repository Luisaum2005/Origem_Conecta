alter table public.orders
  add column if not exists origem_solicitacao_id uuid references public.quote_requests(id);

drop policy if exists "orders insert by quote producer" on public.orders;
create policy "orders insert by quote producer" on public.orders
  for insert
  with check (
    exists (
      select 1
      from public.quote_requests qr
      join public.producers pr on pr.id = qr.producer_id
      join public.profiles pf on pf.id = pr.profile_id
      where qr.id = orders.origem_solicitacao_id
        and qr.buyer_id = orders.buyer_id
        and qr.status = 'respondida'
        and pf.user_id = auth.uid()
    )
  );

drop policy if exists "orders delete by quote producer" on public.orders;
create policy "orders delete by quote producer" on public.orders
  for delete
  using (
    exists (
      select 1
      from public.quote_requests qr
      join public.producers pr on pr.id = qr.producer_id
      join public.profiles pf on pf.id = pr.profile_id
      where qr.id = orders.origem_solicitacao_id
        and qr.buyer_id = orders.buyer_id
        and qr.status = 'respondida'
        and pf.user_id = auth.uid()
    )
  );

drop policy if exists "order items insert by quote producer" on public.order_items;
create policy "order items insert by quote producer" on public.order_items
  for insert
  with check (
    exists (
      select 1
      from public.orders o
      join public.quote_requests qr on qr.id = o.origem_solicitacao_id
      join public.producers pr on pr.id = order_items.producer_id
      join public.profiles pf on pf.id = pr.profile_id
      where o.id = order_items.order_id
        and qr.producer_id = pr.id
        and pf.user_id = auth.uid()
    )
  );
