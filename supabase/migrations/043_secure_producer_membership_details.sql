-- Give a producer the institutional context needed to understand and respond
-- to their own membership invitations without opening the organizations table.
create or replace function public.list_my_producer_memberships()
returns table(
  id uuid,
  organization_id uuid,
  organization_name text,
  organization_type text,
  organization_city text,
  organization_state text,
  producer_name text,
  producer_email text,
  property_name text,
  producer_location text,
  products text[],
  status text,
  member_number text,
  can_sell boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path=public
as $$
  select
    om.id,
    om.organization_id,
    o.trade_name,
    o.type,
    o.city,
    o.state,
    coalesce(nullif(pr.responsavel, ''), p.nome),
    p.email,
    pr.nome_propriedade,
    pr.localizacao,
    coalesce(pr.categorias_atendidas, '{}'::text[]),
    om.status,
    om.member_number,
    om.can_sell_through_organization,
    om.created_at
  from public.organization_members om
  join public.producers pr on pr.id=om.producer_id
  join public.profiles p on p.id=pr.profile_id
  join public.organizations o on o.id=om.organization_id
  where p.user_id=auth.uid()
  order by om.created_at desc;
$$;

revoke all on function public.list_my_producer_memberships() from public;
grant execute on function public.list_my_producer_memberships() to authenticated;
