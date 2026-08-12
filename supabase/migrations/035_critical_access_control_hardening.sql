-- Critical access-control hardening.
-- Order mutations must go through the transactional security-definer functions,
-- and portfolio readers receive only the fields required by the public catalog.

-- Direct edits can change prices/quantities after checkout or remove rows without
-- restoring inventory. Cancellation remains available through secure_cancel_order.
drop policy if exists "order items update by buyer" on public.order_items;
drop policy if exists "order items delete by buyer" on public.order_items;
drop policy if exists "order items by admin" on public.order_items;
drop policy if exists "buyers delete incomplete orders" on public.orders;
drop policy if exists "orders delete by quote producer" on public.orders;
drop policy if exists "orders by admin" on public.orders;

-- Inventory is no longer anonymously readable. Producers keep access to their own
-- rows through "producer inventory own write"; organization managers use the
-- existing list_managed_organization_products RPC.
drop policy if exists "inventory readable" on public.producer_inventory;
revoke select on public.producer_inventory from public,anon;

create or replace function public.list_active_portfolio_inventory()
returns table(
  id uuid,
  producer_id uuid,
  product_name text,
  product_unit text,
  available_quantity numeric,
  price numeric,
  harvest_date date,
  expiry_date date,
  notes text,
  image_url text,
  video_url text,
  seller_organization_id uuid,
  seller_organization_name text,
  seller_organization_cnpj text,
  producer_property text,
  producer_location text,
  producer_responsible text,
  commercialization_mode text,
  commercial_verification_status text
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select
    pi.id,
    pi.producer_id,
    coalesce(nullif(trim(pi.nome_produto),''),p.nome,'Produto'),
    coalesce(nullif(trim(pi.unidade),''),p.unidade,'kg'),
    pi.quantidade_disponivel,
    pi.preco,
    pi.data_colheita,
    pi.validade,
    pi.observacoes,
    pi.imagem_url,
    pi.video_url,
    pi.seller_organization_id,
    pi.seller_organization_name,
    pi.seller_organization_cnpj,
    pr.nome_propriedade,
    pr.localizacao,
    pr.responsavel,
    pr.commercialization_mode,
    pr.commercial_verification_status
  from public.producer_inventory pi
  join public.producers pr on pr.id=pi.producer_id
  left join public.products p on p.id=pi.product_id
  where auth.uid() is not null
    and exists (
      select 1
      from public.buyers b
      join public.profiles caller on caller.id=b.profile_id
      where caller.user_id=auth.uid() and b.ativo
    )
    and pi.ativo
    and pi.quantidade_disponivel > 0
    and not coalesce(pi.organization_paused,false)
    and pr.ativo
  order by pi.atualizado_em desc
  limit 100;
$$;

revoke all on function public.list_active_portfolio_inventory() from public,anon;
grant execute on function public.list_active_portfolio_inventory() to authenticated;

-- Producer records are no longer public. Authenticated users can only read the
-- non-document columns needed by legitimate screens; the legacy CNPJ column stays
-- inaccessible and fiscal documents remain in producer_commercial_documents.
drop policy if exists "producers readable" on public.producers;
create policy "authenticated read active producers" on public.producers
  for select to authenticated
  using (
    ativo
    or profile_id in (select id from public.profiles where user_id=auth.uid())
  );

revoke select on public.producers from public,anon,authenticated;
grant select (
  id,
  profile_id,
  nome_propriedade,
  responsavel,
  localizacao,
  categorias_atendidas,
  score_confiabilidade,
  taxa_entrega_no_prazo,
  ativo,
  commercialization_mode,
  commercial_verification_status
) on public.producers to authenticated;

-- Legal identity is immutable from the browser. Managers update operational
-- contact/address data through update_managed_organization_settings.
drop policy if exists "owners update own organization data" on public.organizations;

create or replace function public.protect_organization_legal_identity()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if (
    new.type is distinct from old.type
    or new.legal_name is distinct from old.legal_name
    or new.cnpj is distinct from old.cnpj
    or new.state_registration is distinct from old.state_registration
  ) and coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'A identidade legal da organizacao nao pode ser alterada por esta operacao.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_organization_legal_identity_fields on public.organizations;
create trigger protect_organization_legal_identity_fields
before update of type,legal_name,cnpj,state_registration on public.organizations
for each row execute function public.protect_organization_legal_identity();
