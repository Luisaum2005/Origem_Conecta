-- Expose the producer's own organization relationship states for clear UI feedback.
create or replace function public.get_my_organization_commercial_options()
returns table(
  id uuid,
  name text,
  cnpj text,
  type text,
  membership_status text,
  can_sell boolean,
  organization_status text,
  verification_status text
)
language sql
stable
security definer
set search_path=public
as $$
  select
    o.id,
    o.trade_name,
    o.cnpj,
    o.type,
    om.status,
    om.can_sell_through_organization,
    o.status,
    o.verification_status
  from public.organization_members om
  join public.organizations o on o.id=om.organization_id
  join public.producers pr on pr.id=om.producer_id
  join public.profiles p on p.id=pr.profile_id
  where p.user_id=auth.uid()
    and om.status in ('invited','pending','active')
  order by o.trade_name;
$$;

revoke all on function public.get_my_organization_commercial_options() from public;
grant execute on function public.get_my_organization_commercial_options() to authenticated;

