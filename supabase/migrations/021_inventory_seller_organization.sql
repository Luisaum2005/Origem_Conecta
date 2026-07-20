-- Sprint 3: seller representation on inventory and immutable snapshots on orders.
alter table public.producer_inventory
  add column seller_organization_id uuid references public.organizations(id),
  add column seller_organization_name text,
  add column seller_organization_cnpj text;

create index producer_inventory_seller_org_idx
  on public.producer_inventory(seller_organization_id)
  where seller_organization_id is not null;

alter table public.order_items
  add column seller_organization_id uuid references public.organizations(id),
  add column seller_organization_name text,
  add column seller_organization_cnpj text;

create or replace function public.validate_inventory_seller_organization()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.seller_organization_id is null then
    new.seller_organization_name := null;
    new.seller_organization_cnpj := null;
    return new;
  end if;

  if not exists (
    select 1
    from public.organization_members om
    join public.organizations o on o.id=om.organization_id
    where om.organization_id=new.seller_organization_id
      and om.producer_id=new.producer_id
      and om.status='active'
      and om.can_sell_through_organization
      and o.status='active'
  ) then
    raise exception 'O produtor não está autorizado a vender por esta organização.';
  end if;

  select o.trade_name,o.cnpj
  into new.seller_organization_name,new.seller_organization_cnpj
  from public.organizations o
  where o.id=new.seller_organization_id;

  return new;
end;
$$;

create trigger validate_inventory_seller_organization
before insert or update of producer_id,seller_organization_id
on public.producer_inventory
for each row execute function public.validate_inventory_seller_organization();

create or replace function public.get_my_sales_organizations()
returns table(id uuid,name text,cnpj text,type text)
language sql
stable
security definer
set search_path=public
as $$
  select o.id,o.trade_name,o.cnpj,o.type
  from public.organization_members om
  join public.organizations o on o.id=om.organization_id
  join public.producers pr on pr.id=om.producer_id
  join public.profiles p on p.id=pr.profile_id
  where p.user_id=auth.uid()
    and om.status='active'
    and om.can_sell_through_organization
    and o.status='active'
  order by o.trade_name;
$$;
revoke all on function public.get_my_sales_organizations() from public;
grant execute on function public.get_my_sales_organizations() to authenticated;

-- A listing cannot remain for sale under an organization after authorization ends.
create or replace function public.pause_unauthorized_organization_inventory()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if old.status='active' and old.can_sell_through_organization
     and (new.status<>'active' or not new.can_sell_through_organization) then
    update public.producer_inventory
    set ativo=false, atualizado_em=now()
    where producer_id=new.producer_id
      and seller_organization_id=new.organization_id
      and ativo;
  end if;
  return new;
end;
$$;

create trigger pause_inventory_after_membership_change
after update of status,can_sell_through_organization
on public.organization_members
for each row execute function public.pause_unauthorized_organization_inventory();

-- Order items receive their legal seller snapshot from inventory, never from client input.
create or replace function public.snapshot_order_item_seller()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_inventory public.producer_inventory%rowtype;
  v_organization public.organizations%rowtype;
begin
  begin
    select * into v_inventory
    from public.producer_inventory
    where id=nullif(new.product_ref,'')::uuid;
  exception when invalid_text_representation then
    return new;
  end;

  if not found then return new; end if;
  if new.producer_id is distinct from v_inventory.producer_id then
    raise exception 'O produtor do item não corresponde ao anúncio selecionado.';
  end if;

  new.seller_organization_id := v_inventory.seller_organization_id;
  if v_inventory.seller_organization_id is null then
    new.seller_organization_name := null;
    new.seller_organization_cnpj := null;
  else
    select * into v_organization
    from public.organizations
    where id=v_inventory.seller_organization_id;
    new.seller_organization_name := v_organization.trade_name;
    new.seller_organization_cnpj := v_organization.cnpj;
  end if;
  return new;
end;
$$;

create trigger snapshot_order_item_seller
before insert on public.order_items
for each row execute function public.snapshot_order_item_seller();
