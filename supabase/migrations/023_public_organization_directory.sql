-- Public institutional directory with a deliberately limited data surface.
create or replace function public.list_public_organizations(p_query text default '')
returns table(
  id uuid,
  type text,
  trade_name text,
  city text,
  state text,
  verification_status text,
  active_members bigint,
  supplied_products text[]
)
language sql
stable
security definer
set search_path=public
as $$
  select
    o.id,
    o.type,
    o.trade_name,
    o.city,
    o.state,
    o.verification_status,
    (
      select count(*)
      from public.organization_members om
      where om.organization_id=o.id and om.status='active'
    ) as active_members,
    coalesce((
      select array_agg(distinct product order by product)
      from public.organization_members om
      join public.producers pr on pr.id=om.producer_id
      cross join lateral unnest(pr.categorias_atendidas) product
      where om.organization_id=o.id
        and om.status='active'
        and pr.ativo
    ),'{}'::text[]) as supplied_products
  from public.organizations o
  where o.status='active'
    and (
      coalesce(trim(p_query),'')=''
      or o.trade_name ilike '%'||trim(p_query)||'%'
      or o.city ilike '%'||trim(p_query)||'%'
      or exists (
        select 1
        from public.organization_members om
        join public.producers pr on pr.id=om.producer_id
        cross join lateral unnest(pr.categorias_atendidas) product
        where om.organization_id=o.id
          and om.status='active'
          and product ilike '%'||trim(p_query)||'%'
      )
    )
  order by (o.verification_status='verified') desc,o.trade_name
  limit 100;
$$;

revoke all on function public.list_public_organizations(text) from public;
grant execute on function public.list_public_organizations(text) to authenticated;

