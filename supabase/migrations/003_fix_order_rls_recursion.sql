drop policy if exists "orders readable by producer" on public.orders;
drop policy if exists "orders status by producer" on public.orders;
drop policy if exists "order items by order buyer" on public.order_items;
drop policy if exists "order items readable by producer" on public.order_items;

create policy "order items readable by buyer" on public.order_items
  for select using (order_id in (
    select orders.id from public.orders
    join public.buyers on buyers.id = orders.buyer_id
    join public.profiles on profiles.id = buyers.profile_id
    where profiles.user_id = auth.uid()
  ));

create policy "order items insert by buyer" on public.order_items
  for insert with check (order_id in (
    select orders.id from public.orders
    join public.buyers on buyers.id = orders.buyer_id
    join public.profiles on profiles.id = buyers.profile_id
    where profiles.user_id = auth.uid()
  ));

create policy "order items update by buyer" on public.order_items
  for update using (order_id in (
    select orders.id from public.orders
    join public.buyers on buyers.id = orders.buyer_id
    join public.profiles on profiles.id = buyers.profile_id
    where profiles.user_id = auth.uid()
  ))
  with check (order_id in (
    select orders.id from public.orders
    join public.buyers on buyers.id = orders.buyer_id
    join public.profiles on profiles.id = buyers.profile_id
    where profiles.user_id = auth.uid()
  ));

create policy "order items delete by buyer" on public.order_items
  for delete using (order_id in (
    select orders.id from public.orders
    join public.buyers on buyers.id = orders.buyer_id
    join public.profiles on profiles.id = buyers.profile_id
    where profiles.user_id = auth.uid()
  ));

create policy "order items readable by producer" on public.order_items
  for select using (producer_id in (
    select producers.id from public.producers
    join public.profiles on profiles.id = producers.profile_id
    where profiles.user_id = auth.uid()
  ));
