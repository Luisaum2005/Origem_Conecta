-- Inventory rows can be referenced by negotiation proposals and therefore
-- belong to the commercial audit trail. A producer deletion archives the row
-- instead of breaking or cascading that history.

alter table public.producer_inventory
  add column if not exists deleted_at timestamptz;

create index if not exists producer_inventory_visible_by_producer_idx
  on public.producer_inventory(producer_id, atualizado_em desc)
  where deleted_at is null;

comment on column public.producer_inventory.deleted_at is
  'Timestamp de arquivamento. Itens arquivados não aparecem no estoque nem no portfólio.';

drop function if exists public.list_managed_organization_products();
create function public.list_managed_organization_products()
returns table(
  id uuid,
  organization_id uuid,
  organization_name text,
  organization_cnpj text,
  producer_id uuid,
  product_name text,
  producer_name text,
  property_name text,
  unit text,
  available_quantity numeric,
  minimum_stock numeric,
  price numeric,
  image_url text,
  is_active boolean,
  organization_paused boolean,
  organization_paused_at timestamptz,
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

  return query
  select
    pi.id,
    o.id,
    o.trade_name,
    o.cnpj,
    pr.id,
    coalesce(nullif(btrim(pi.nome_produto),''),p.nome,'Produto'),
    coalesce(nullif(btrim(pr.responsavel),''),pp.nome,'Produtor'),
    pr.nome_propriedade,
    pi.unidade,
    pi.quantidade_disponivel,
    coalesce(pi.estoque_minimo,0),
    pi.preco,
    pi.imagem_url,
    pi.ativo,
    pi.organization_paused,
    pi.organization_paused_at,
    pi.atualizado_em
  from public.producer_inventory pi
  join public.organizations o on o.id=pi.seller_organization_id
  join public.producers pr on pr.id=pi.producer_id
  join public.profiles pp on pp.id=pr.profile_id
  left join public.products p on p.id=pi.product_id
  where public.can_manage_organization(o.id)
    and pi.deleted_at is null
  order by pi.atualizado_em desc;
end;
$$;

revoke all on function public.list_managed_organization_products() from public,anon;
grant execute on function public.list_managed_organization_products() to authenticated;
