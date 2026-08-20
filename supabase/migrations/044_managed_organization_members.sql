-- Sprint 1: expose the minimum producer data needed by organization managers
-- without weakening RLS on profiles or producer records.

-- Older organizations could have a creator but no corresponding management row.
-- Add only missing owners; existing inactive or delegated roles are preserved.
insert into public.organization_users(organization_id,profile_id,role,status)
select o.id,o.created_by,'owner','active'
from public.organizations o
where not exists(
  select 1 from public.organization_users ou
  where ou.organization_id=o.id and ou.profile_id=o.created_by
);

create or replace function public.list_managed_organization_members(p_organization_id uuid)
returns table(
  id uuid,
  organization_id uuid,
  organization_name text,
  organization_type text,
  organization_city text,
  organization_state text,
  producer_name text,
  producer_email text,
  producer_phone text,
  property_name text,
  producer_location text,
  products text[],
  commercialization_mode text,
  status text,
  member_number text,
  can_sell boolean,
  active_products_count bigint,
  open_negotiations_count bigint,
  joined_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;
  if not public.can_manage_organization(p_organization_id) then
    raise exception 'Sem permissao para consultar os associados desta organizacao.';
  end if;

  return query
  select
    om.id,
    om.organization_id,
    o.trade_name,
    o.type,
    o.city,
    o.state,
    coalesce(nullif(btrim(pr.responsavel),''),nullif(btrim(p.nome),''),'Produtor'),
    p.email,
    p.telefone,
    coalesce(nullif(btrim(pr.nome_propriedade),''),'Propriedade não informada'),
    pr.localizacao,
    coalesce(pr.categorias_atendidas,'{}'::text[]),
    pr.commercialization_mode,
    om.status,
    om.member_number,
    om.can_sell_through_organization,
    (
      select count(*)
      from public.producer_inventory pi
      where pi.producer_id=om.producer_id
        and pi.seller_organization_id=om.organization_id
        and pi.ativo
        and not coalesce(pi.organization_paused,false)
    ),
    (
      select count(distinct oi.order_id)
      from public.order_items oi
      join public.orders ord on ord.id=oi.order_id
      where oi.producer_id=om.producer_id
        and oi.seller_organization_id=om.organization_id
        and ord.status not in ('entregue','cancelado')
    ),
    om.joined_at,
    om.created_at,
    om.updated_at
  from public.organization_members om
  join public.organizations o on o.id=om.organization_id
  join public.producers pr on pr.id=om.producer_id
  join public.profiles p on p.id=pr.profile_id
  where om.organization_id=p_organization_id
  order by
    case om.status
      when 'active' then 1
      when 'pending' then 2
      when 'invited' then 3
      else 4
    end,
    coalesce(nullif(btrim(pr.responsavel),''),p.nome);
end;
$$;

revoke all on function public.list_managed_organization_members(uuid) from public,anon;
grant execute on function public.list_managed_organization_members(uuid) to authenticated;

create or replace function public.update_organization_member_number(
  p_membership_id uuid,
  p_member_number text
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_organization_id uuid;
  v_number text:=nullif(btrim(p_member_number),'');
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;
  select organization_id into v_organization_id
  from public.organization_members
  where id=p_membership_id and status='active'
  for update;
  if v_organization_id is null or not public.can_manage_organization(v_organization_id) then
    raise exception 'Associado ativo nao encontrado ou sem permissao.';
  end if;
  if v_number is not null and char_length(v_number)>50 then
    raise exception 'O numero de associado deve ter no maximo 50 caracteres.';
  end if;
  update public.organization_members
  set member_number=v_number,updated_at=now()
  where id=p_membership_id;
end;
$$;

revoke all on function public.update_organization_member_number(uuid,text) from public,anon;
grant execute on function public.update_organization_member_number(uuid,text) to authenticated;
