-- Sprint 2: complete the managed product view and notify the responsible
-- producer when an organization changes an institutional publication block.

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
  order by pi.atualizado_em desc;
end;
$$;

revoke all on function public.list_managed_organization_products() from public,anon;
grant execute on function public.list_managed_organization_products() to authenticated;

create or replace function public.set_organization_product_paused(
  p_inventory_id uuid,
  p_paused boolean
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_inventory public.producer_inventory%rowtype;
  v_profile_id uuid;
  v_producer_user_id uuid;
  v_organization_name text;
  v_product_name text;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;
  select * into v_inventory
  from public.producer_inventory
  where id=p_inventory_id
  for update;

  if not found
     or v_inventory.seller_organization_id is null
     or not public.can_manage_organization(v_inventory.seller_organization_id) then
    raise exception 'Publicacao nao encontrada ou sem permissao para gerenciar.';
  end if;

  if v_inventory.organization_paused=p_paused then
    return;
  end if;

  select id into v_profile_id from public.profiles where user_id=auth.uid();
  select p.user_id into v_producer_user_id
  from public.producers pr
  join public.profiles p on p.id=pr.profile_id
  where pr.id=v_inventory.producer_id;
  select trade_name into v_organization_name
  from public.organizations where id=v_inventory.seller_organization_id;
  select coalesce(nullif(btrim(v_inventory.nome_produto),''),p.nome,'Produto')
  into v_product_name
  from public.products p where p.id=v_inventory.product_id;
  v_product_name:=coalesce(v_product_name,nullif(btrim(v_inventory.nome_produto),''),'Produto');

  update public.producer_inventory
  set
    organization_paused=p_paused,
    organization_paused_at=case when p_paused then now() else null end,
    organization_paused_by=case when p_paused then v_profile_id else null end,
    ativo=case when p_paused then false else ativo end,
    atualizado_em=now()
  where id=p_inventory_id;

  if v_producer_user_id is not null then
    perform public.create_system_notification(
      v_producer_user_id,
      'system',
      case when p_paused then 'Publicacao pausada pela organizacao' else 'Publicacao liberada pela organizacao' end,
      case when p_paused
        then v_organization_name||' pausou a publicacao de '||v_product_name||'. Revise os dados ou fale com a organizacao.'
        else v_organization_name||' liberou a publicacao de '||v_product_name||'. Voce pode revisar e publicar novamente.'
      end,
      jsonb_build_object('url','/production','inventoryId',p_inventory_id),
      'organization-product-pause:'||p_inventory_id||':'||p_paused||':'||extract(epoch from now())::bigint
    );
  end if;
end;
$$;

revoke all on function public.set_organization_product_paused(uuid,boolean) from public,anon;
grant execute on function public.set_organization_product_paused(uuid,boolean) to authenticated;
