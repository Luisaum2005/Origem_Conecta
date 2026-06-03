update public.order_items oi
set producer_id = pr.id
from public.producers pr
join public.profiles pf on pf.id = pr.profile_id
where oi.producer_id is null
  and (
    lower(coalesce(oi.producer_name, '')) = lower(coalesce(pr.nome_propriedade, ''))
    or lower(coalesce(oi.producer_name, '')) = lower(coalesce(pr.responsavel, ''))
    or lower(coalesce(oi.producer_name, '')) = lower(coalesce(pf.nome, ''))
  );

create or replace function public.producer_can_access_order(p_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.order_items oi
    join public.producers pr on pr.id = oi.producer_id
    join public.profiles pf on pf.id = pr.profile_id
    where oi.order_id = p_order_id
      and pf.user_id = auth.uid()
  );
$$;

grant execute on function public.producer_can_access_order(uuid) to authenticated;

drop policy if exists "orders readable by producer" on public.orders;
drop policy if exists "orders status by producer" on public.orders;

create policy "orders readable by producer" on public.orders
  for select using (public.producer_can_access_order(id));

create policy "orders status by producer" on public.orders
  for update using (public.producer_can_access_order(id))
  with check (public.producer_can_access_order(id));
