-- Delivery details are private operational data. They are saved with each
-- order and disclosed only to the buyer and the producers participating in it.

alter table public.buyers
  add column if not exists postal_code text,
  add column if not exists address_line text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists neighborhood text;

alter table public.orders
  add column if not exists delivery_postal_code text,
  add column if not exists delivery_address_line text,
  add column if not exists delivery_address_number text,
  add column if not exists delivery_address_complement text,
  add column if not exists delivery_neighborhood text,
  add column if not exists delivery_city text,
  add column if not exists delivery_state text;

-- The signup handler creates the buyer row before clearing signup metadata.
-- Capture the delivery address in that same transaction without persisting it
-- in auth.users metadata.
create or replace function public.capture_buyer_address_from_signup()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_payload jsonb;
  v_buyer jsonb;
  v_postal_code text;
  v_address_line text;
  v_neighborhood text;
begin
  select raw_user_meta_data->'signup_payload'
    into v_payload
  from auth.users
  where id=(select user_id from public.profiles where id=new.profile_id);

  v_buyer:=v_payload->'buyer';
  if v_buyer is null then
    return new;
  end if;

  v_postal_code:=regexp_replace(coalesce(v_buyer->>'postalCode',''),'\D','','g');
  v_address_line:=nullif(btrim(v_buyer->>'addressLine'),'');
  v_neighborhood:=nullif(btrim(v_buyer->>'neighborhood'),'');
  if length(v_postal_code)<>8 or v_address_line is null or v_neighborhood is null then
    raise exception 'Informe o endereço completo de entrega do comprador.';
  end if;

  update public.buyers
  set postal_code=v_postal_code,
      address_line=v_address_line,
      address_number=nullif(btrim(v_buyer->>'addressNumber'),''),
      address_complement=nullif(btrim(v_buyer->>'addressComplement'),''),
      neighborhood=v_neighborhood
  where id=new.id;

  return new;
end;
$$;

drop trigger if exists capture_buyer_address_from_signup on public.buyers;
create trigger capture_buyer_address_from_signup
after insert on public.buyers
for each row execute function public.capture_buyer_address_from_signup();

-- A buyer can submit only with a complete delivery address. The address is
-- copied to the order so later profile edits never change an in-progress route.
create or replace function public.secure_create_portfolio_order(p_order jsonb,p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_buyer public.buyers%rowtype;
  v_order public.orders%rowtype;
  v_item jsonb;
  v_inventory public.producer_inventory%rowtype;
  v_qty numeric;
  v_subtotal numeric:=0;
  v_delivery numeric:=0;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;

  select b.* into v_buyer
  from public.buyers b
  join public.profiles p on p.id=b.profile_id
  where p.user_id=auth.uid() and b.ativo
  for update;
  if not found then raise exception 'Cadastro de comprador nao encontrado.'; end if;
  if length(coalesce(v_buyer.postal_code,''))<>8
     or nullif(btrim(v_buyer.address_line),'') is null
     or nullif(btrim(v_buyer.neighborhood),'') is null
     or not exists (
       select 1 from public.profiles p
       where p.id=v_buyer.profile_id
         and nullif(btrim(p.cidade),'') is not null
         and upper(coalesce(p.estado,'')) ~ '^[A-Z]{2}$'
     ) then
    raise exception 'Complete o endereço de entrega no seu perfil antes de enviar a solicitação.';
  end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
    raise exception 'O pedido precisa ter itens.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=coalesce((v_item->>'quantity')::numeric,0);
    if v_qty<=0 then raise exception 'Quantidade invalida.'; end if;
    select * into v_inventory
    from public.producer_inventory
    where id=(v_item->>'productId')::uuid and ativo
    for update;
    if not found then raise exception 'Produto indisponivel.'; end if;
    if v_inventory.quantidade_disponivel<v_qty then
      raise exception 'Estoque insuficiente para %.',coalesce(v_inventory.nome_produto,'produto');
    end if;
    update public.producer_inventory
    set quantidade_disponivel=quantidade_disponivel-v_qty,
        ativo=(quantidade_disponivel-v_qty)>0,
        atualizado_em=now()
    where id=v_inventory.id;
    v_subtotal:=v_subtotal+(v_qty*v_inventory.preco);
  end loop;

  insert into public.orders(
    buyer_id,buyer_name,status,subtotal,delivery,total,entrega_label,entrega_prevista,
    cancelamento_limite_em,codigo_entrega,payment_method,payment_notes,
    delivery_postal_code,delivery_address_line,delivery_address_number,
    delivery_address_complement,delivery_neighborhood,delivery_city,delivery_state
  )
  select
    v_buyer.id,coalesce(v_buyer.nome_empresa,p_order->>'buyerName'),'recebido',v_subtotal,v_delivery,
    v_subtotal+v_delivery,p_order->>'deliveryEta',nullif(p_order->>'deliveryAt','')::timestamptz,
    now()+interval '2 hours',public.generate_order_delivery_code(),
    coalesce(nullif(p_order->>'paymentMethod',''),'A combinar'),nullif(p_order->>'paymentNotes',''),
    v_buyer.postal_code,v_buyer.address_line,v_buyer.address_number,v_buyer.address_complement,
    v_buyer.neighborhood,p.cidade,p.estado
  from public.profiles p
  where p.id=v_buyer.profile_id
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=(v_item->>'quantity')::numeric;
    select * into v_inventory from public.producer_inventory where id=(v_item->>'productId')::uuid;
    insert into public.order_items(
      order_id,product_ref,product_name,quantidade,unidade,preco_unitario,producer_id,
      producer_ref,producer_name,escolha_manual_produtor,line_total,observacoes,reserved_quantity,
      seller_organization_id,seller_organization_name,seller_organization_cnpj
    )
    select
      v_order.id,v_inventory.id::text,coalesce(v_inventory.nome_produto,p.nome),v_qty,v_inventory.unidade,
      v_inventory.preco,v_inventory.producer_id,v_inventory.producer_id::text,
      coalesce(pr.responsavel,pr.nome_propriedade),coalesce((v_item->>'manualProducerChoice')::boolean,false),
      v_qty*v_inventory.preco,nullif(v_item->>'notes',''),v_qty,v_inventory.seller_organization_id,
      o.trade_name,o.cnpj
    from public.producers pr
    left join public.products p on p.id=v_inventory.product_id
    left join public.organizations o on o.id=v_inventory.seller_organization_id
    where pr.id=v_inventory.producer_id;
  end loop;

  return jsonb_build_object('id',v_order.id,'createdAt',v_order.criado_em);
end;
$$;

-- Do not grant the address columns through the orders table. This narrow RPC
-- verifies that the caller owns the order or supplies at least one order item.
create or replace function public.get_my_order_delivery_addresses(p_order_ids uuid[])
returns table(
  order_id uuid,
  postal_code text,
  address_line text,
  address_number text,
  address_complement text,
  neighborhood text,
  city text,
  state text
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select
    o.id,o.delivery_postal_code,o.delivery_address_line,o.delivery_address_number,
    o.delivery_address_complement,o.delivery_neighborhood,o.delivery_city,o.delivery_state
  from public.orders o
  where o.id=any(p_order_ids)
    and (
      exists (
        select 1
        from public.buyers b
        join public.profiles p on p.id=b.profile_id
        where b.id=o.buyer_id and p.user_id=auth.uid()
      )
      or exists (
        select 1
        from public.order_items oi
        join public.producers pr on pr.id=oi.producer_id
        join public.profiles p on p.id=pr.profile_id
        where oi.order_id=o.id and p.user_id=auth.uid()
      )
    );
$$;

revoke all on function public.get_my_order_delivery_addresses(uuid[]) from public,anon;
grant execute on function public.get_my_order_delivery_addresses(uuid[]) to authenticated;
