-- Emergency rollback for migrations 041 and 042.
-- Existing order_creation_requests rows are intentionally preserved so an
-- operational rollback never deletes order audit data.

begin;

drop function if exists public.secure_update_my_producer_profile(jsonb);
drop function if exists public.get_my_producer_profile();

create or replace function public.get_my_order_delivery_codes(p_order_ids uuid[])
returns table(order_id uuid,delivery_code text)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;
  if p_order_ids is null or cardinality(p_order_ids) not between 1 and 100 then
    raise exception 'Informe entre 1 e 100 pedidos.';
  end if;

  return query
  select o.id,o.codigo_entrega
  from public.orders o
  join public.buyers b on b.id=o.buyer_id
  join public.profiles p on p.id=b.profile_id
  where p.user_id=auth.uid()
    and o.id=any(p_order_ids);
end;
$$;

revoke all on function public.get_my_order_delivery_codes(uuid[]) from public,anon;
grant execute on function public.get_my_order_delivery_codes(uuid[]) to authenticated;

do $$
begin
  if to_regprocedure('public.secure_create_portfolio_order_once(jsonb,jsonb)') is not null then
    drop function if exists public.secure_create_portfolio_order(jsonb,jsonb);
    alter function public.secure_create_portfolio_order_once(jsonb,jsonb)
      rename to secure_create_portfolio_order;
    revoke all on function public.secure_create_portfolio_order(jsonb,jsonb) from public,anon;
    grant execute on function public.secure_create_portfolio_order(jsonb,jsonb) to authenticated;
  end if;
end;
$$;

commit;
