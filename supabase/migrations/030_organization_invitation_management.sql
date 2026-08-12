-- Allow organization managers to revoke an invitation that has not been accepted yet.
create or replace function public.cancel_organization_invitation(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_membership public.organization_members%rowtype;
begin
  select * into v_membership
  from public.organization_members
  where id=p_membership_id
  for update;

  if not found
     or v_membership.status <> 'invited'
     or not public.can_manage_organization(v_membership.organization_id) then
    raise exception 'Convite não encontrado ou sem permissão para cancelar.';
  end if;

  update public.organization_members
  set status='inactive', can_sell_through_organization=false, updated_at=now()
  where id=p_membership_id;
end;
$$;

revoke all on function public.cancel_organization_invitation(uuid) from public;
grant execute on function public.cancel_organization_invitation(uuid) to authenticated;
