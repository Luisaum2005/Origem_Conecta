-- Institutional supervision of publications that use an organization's commercial identity.
alter table public.producer_inventory
  add column if not exists organization_paused boolean not null default false,
  add column if not exists organization_paused_at timestamptz,
  add column if not exists organization_paused_by uuid references public.profiles(id);

create or replace function public.protect_organization_inventory_pause()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.seller_organization_id is distinct from old.seller_organization_id then
    new.organization_paused := false;
    new.organization_paused_at := null;
    new.organization_paused_by := null;
  elsif (
    new.organization_paused is distinct from old.organization_paused
    or new.organization_paused_at is distinct from old.organization_paused_at
    or new.organization_paused_by is distinct from old.organization_paused_by
  ) and not public.can_manage_organization(old.seller_organization_id) then
    raise exception 'Apenas um gestor da organização pode alterar o bloqueio institucional.';
  end if;

  if new.organization_paused then
    new.ativo := false;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_organization_inventory_pause on public.producer_inventory;
create trigger protect_organization_inventory_pause
before update on public.producer_inventory
for each row execute function public.protect_organization_inventory_pause();

create or replace function public.list_managed_organization_products()
returns table(
  id uuid,
  organization_id uuid,
  organization_name text,
  product_name text,
  producer_name text,
  property_name text,
  unit text,
  available_quantity numeric,
  minimum_stock numeric,
  is_active boolean,
  organization_paused boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path=public
as $$
  select
    pi.id,
    o.id,
    o.trade_name,
    coalesce(nullif(trim(pi.nome_produto),''),p.nome,'Produto'),
    coalesce(nullif(trim(pr.responsavel),''),pp.nome,'Produtor'),
    pr.nome_propriedade,
    pi.unidade,
    pi.quantidade_disponivel,
    coalesce(pi.estoque_minimo,0),
    pi.ativo,
    pi.organization_paused,
    pi.atualizado_em
  from public.producer_inventory pi
  join public.organizations o on o.id=pi.seller_organization_id
  join public.producers pr on pr.id=pi.producer_id
  join public.profiles pp on pp.id=pr.profile_id
  left join public.products p on p.id=pi.product_id
  where public.can_manage_organization(o.id)
  order by pi.atualizado_em desc;
$$;

create or replace function public.set_organization_product_paused(
  p_inventory_id uuid,
  p_paused boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_inventory public.producer_inventory%rowtype;
  v_profile_id uuid;
begin
  select * into v_inventory
  from public.producer_inventory
  where id=p_inventory_id
  for update;

  if not found
     or v_inventory.seller_organization_id is null
     or not public.can_manage_organization(v_inventory.seller_organization_id) then
    raise exception 'Publicação não encontrada ou sem permissão para gerenciar.';
  end if;

  select id into v_profile_id from public.profiles where user_id=auth.uid();
  update public.producer_inventory
  set
    organization_paused=p_paused,
    organization_paused_at=case when p_paused then now() else null end,
    organization_paused_by=case when p_paused then v_profile_id else null end,
    ativo=case when p_paused then false else ativo end,
    atualizado_em=now()
  where id=p_inventory_id;
end;
$$;

revoke all on function public.list_managed_organization_products() from public;
revoke all on function public.set_organization_product_paused(uuid,boolean) from public;
grant execute on function public.list_managed_organization_products() to authenticated;
grant execute on function public.set_organization_product_paused(uuid,boolean) to authenticated;
