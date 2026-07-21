-- Critical integrity fixes: atomic signup/orders and server-authoritative inventory.

-- The old function accepted arbitrary inventory ids from every authenticated user.
revoke all on function public.decrement_inventory_for_order(jsonb) from public, anon, authenticated;
drop function if exists public.decrement_inventory_for_order(jsonb);

-- Complete the application profile in the same transaction that inserts auth.users.
create or replace function public.handle_application_signup()
returns trigger
language plpgsql
security definer
set search_path=public, pg_temp
as $$
declare
  v jsonb := new.raw_user_meta_data->'signup_payload';
  v_profile public.profiles%rowtype;
  v_producer public.producers%rowtype;
  v_org public.organizations%rowtype;
  v_type text;
begin
  if v is null then return new; end if;
  v_type := v->>'tipo';
  if v_type not in ('comprador','produtor','organizacao') then
    raise exception 'Tipo de cadastro invalido.';
  end if;

  insert into public.profiles(user_id,tipo,nome,telefone,email,cidade,estado)
  values(new.id,v_type::public.profile_type,v->>'nome',nullif(v->>'telefone',''),new.email,
    nullif(v->>'cidade',''),nullif(upper(v->>'estado'),''))
  returning * into v_profile;

  insert into public.profile_roles(profile_id,role)
  values(v_profile.id,case when v_type='organizacao' then 'gestor_organizacao' else v_type end);

  if v_type='comprador' then
    insert into public.buyers(profile_id,nome_empresa,tipo_empresa,cnpj)
    values(v_profile.id,v->'buyer'->>'nomeEmpresa',v->'buyer'->>'tipoEmpresa',
      nullif(regexp_replace(v->'buyer'->>'cnpj','\D','','g'),''));
  elsif v_type='produtor' then
    insert into public.producers(profile_id,nome_propriedade,responsavel,cnpj,commercialization_mode,
      localizacao,categorias_atendidas)
    values(v_profile.id,v->'producer'->>'nomePropriedade',v->'producer'->>'responsavel',null,
      coalesce(nullif(v->'producer'->>'commercializationMode',''),'undecided'),
      nullif(concat_ws(', ',v->>'cidade',upper(v->>'estado')),''),
      coalesce(array(select jsonb_array_elements_text(v->'producer'->'produtos')),'{}'))
    returning * into v_producer;

    insert into public.producer_commercial_documents(producer_id,cnpj,caepf,state_registration)
    values(v_producer.id,nullif(regexp_replace(v->'producer'->>'cnpj','\D','','g'),''),
      nullif(v->'producer'->>'caepf',''),nullif(v->'producer'->>'stateRegistration',''));
  end if;

  if v ? 'organization' and jsonb_typeof(v->'organization')='object' then
    insert into public.organizations(type,legal_name,trade_name,cnpj,state_registration,email,phone,
      address_line,address_number,address_complement,neighborhood,city,state,postal_code,
      responsible_name,responsible_role,status,created_by)
    values(v->'organization'->>'type',v->'organization'->>'legalName',v->'organization'->>'tradeName',
      regexp_replace(v->'organization'->>'cnpj','\D','','g'),
      nullif(v->'organization'->>'stateRegistration',''),new.email,v->'organization'->>'phone',
      v->'organization'->>'addressLine',nullif(v->'organization'->>'addressNumber',''),
      nullif(v->'organization'->>'addressComplement',''),nullif(v->'organization'->>'neighborhood',''),
      v->>'cidade',upper(v->>'estado'),regexp_replace(v->'organization'->>'postalCode','\D','','g'),
      v->'organization'->>'responsibleName',v->'organization'->>'responsibleRole','active',v_profile.id)
    returning * into v_org;
    insert into public.organization_users(organization_id,profile_id,role,status)
    values(v_org.id,v_profile.id,'owner','active');
    insert into public.profile_roles(profile_id,role) values(v_profile.id,'gestor_organizacao') on conflict do nothing;
  end if;
  -- The payload is needed only during this transaction; do not retain fiscal data in auth metadata.
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)-'signup_payload'
    where id=new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_application_signup on auth.users;
create trigger on_auth_user_application_signup
after insert on auth.users for each row execute function public.handle_application_signup();

-- Buyers create portfolio orders atomically. Inventory fields are authoritative.
create or replace function public.secure_create_portfolio_order(p_order jsonb,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_buyer public.buyers%rowtype; v_order public.orders%rowtype; v_item jsonb;
  v_inventory public.producer_inventory%rowtype; v_qty numeric; v_subtotal numeric:=0; v_delivery numeric:=0;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;
  select b.* into v_buyer from public.buyers b join public.profiles p on p.id=b.profile_id
    where p.user_id=auth.uid() and b.ativo for update;
  if not found then raise exception 'Cadastro de comprador nao encontrado.'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'O pedido precisa ter itens.'; end if;
  v_delivery:=greatest(coalesce((p_order->>'delivery')::numeric,0),0);
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=coalesce((v_item->>'quantity')::numeric,0);
    if v_qty<=0 then raise exception 'Quantidade invalida.'; end if;
    select * into v_inventory from public.producer_inventory
      where id=(v_item->>'productId')::uuid and ativo for update;
    if not found then raise exception 'Produto indisponivel.'; end if;
    if v_inventory.quantidade_disponivel<v_qty then raise exception 'Estoque insuficiente para %.',coalesce(v_inventory.nome_produto,'produto'); end if;
    v_subtotal:=v_subtotal+(v_qty*v_inventory.preco);
  end loop;
  insert into public.orders(buyer_id,buyer_name,status,subtotal,delivery,total,entrega_label,entrega_prevista,
    cancelamento_limite_em,codigo_entrega,payment_method,payment_notes)
  values(v_buyer.id,coalesce(v_buyer.nome_empresa,p_order->>'buyerName'),'recebido',v_subtotal,v_delivery,
    v_subtotal+v_delivery,p_order->>'deliveryEta',nullif(p_order->>'deliveryAt','')::timestamptz,
    now()+interval '2 hours',lpad((floor(random()*9000)+1000)::int::text,4,'0'),
    coalesce(nullif(p_order->>'paymentMethod',''),'A combinar'),nullif(p_order->>'paymentNotes',''))
  returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=(v_item->>'quantity')::numeric;
    select * into v_inventory from public.producer_inventory where id=(v_item->>'productId')::uuid;
    insert into public.order_items(order_id,product_ref,product_name,quantidade,unidade,preco_unitario,
      producer_id,producer_ref,producer_name,escolha_manual_produtor,line_total,observacoes)
    select v_order.id,v_inventory.id::text,coalesce(v_inventory.nome_produto,p.nome),v_qty,v_inventory.unidade,
      v_inventory.preco,v_inventory.producer_id,v_inventory.producer_id::text,
      coalesce(pr.responsavel,pr.nome_propriedade),coalesce((v_item->>'manualProducerChoice')::boolean,false),
      v_qty*v_inventory.preco,nullif(v_item->>'notes','')
    from public.producers pr left join public.products p on p.id=v_inventory.product_id where pr.id=v_inventory.producer_id;
  end loop;
  return jsonb_build_object('id',v_order.id,'createdAt',v_order.criado_em);
end $$;

-- A buyer accepts exactly one authoritative demand response in one transaction.
create or replace function public.secure_accept_demand_response(p_response_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_response public.demand_responses%rowtype; v_demand public.demand_requests%rowtype;
  v_buyer public.buyers%rowtype; v_order public.orders%rowtype; v_total numeric;
begin
  select r.* into v_response from public.demand_responses r where r.id=p_response_id for update;
  if not found or v_response.status<>'enviada' then raise exception 'Resposta indisponivel.'; end if;
  select d.* into v_demand from public.demand_requests d where d.id=v_response.demand_id for update;
  select b.* into v_buyer from public.buyers b join public.profiles p on p.id=b.profile_id
    where b.id=v_demand.buyer_id and p.user_id=auth.uid();
  if not found then raise exception 'Somente o comprador da demanda pode aceitar a resposta.'; end if;
  select coalesce(sum(ri.price),0) into v_total from public.demand_response_items ri
    where ri.response_id=p_response_id and ri.can_supply and ri.quantity>0 and ri.price>=0;
  if v_total<=0 then raise exception 'A resposta nao possui itens validos.'; end if;
  insert into public.orders(buyer_id,buyer_name,status,subtotal,delivery,total,entrega_label,
    cancelamento_limite_em,codigo_entrega,origem_demanda_id,payment_method,payment_notes)
  values(v_buyer.id,v_demand.buyer_name,'recebido',v_total,0,v_total,
    case when v_demand.delivery_date is null then 'A combinar' else 'Entrega solicitada para '||to_char(v_demand.delivery_date,'DD/MM/YYYY') end,
    now()+interval '2 hours',lpad((floor(random()*9000)+1000)::int::text,4,'0'),v_demand.id,
    coalesce(v_demand.payment_method,'A combinar'),v_demand.payment_notes) returning * into v_order;
  insert into public.order_items(order_id,product_ref,product_name,quantidade,unidade,preco_unitario,
    producer_id,producer_ref,producer_name,escolha_manual_produtor,line_total,observacoes)
  select v_order.id,coalesce(ri.demand_item_id::text,ri.product_name),ri.product_name,ri.quantity,ri.unit,
    ri.price/ri.quantity,v_response.producer_id,v_response.producer_id::text,v_response.producer_name,true,ri.price,ri.notes
  from public.demand_response_items ri where ri.response_id=p_response_id and ri.can_supply and ri.quantity>0 and ri.price>=0;
  update public.demand_responses set status=case when id=p_response_id then 'aprovada' else 'recusada' end,
    order_id=case when id=p_response_id then v_order.id else order_id end where demand_id=v_demand.id;
  update public.demand_requests set status='aprovada' where id=v_demand.id;
  return v_order.id;
end $$;

-- A producer responds to an open quote and creates its order atomically.
create or replace function public.secure_respond_quote(p_quote_id uuid,p_price numeric,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_quote public.quote_requests%rowtype; v_producer public.producers%rowtype;
  v_buyer public.buyers%rowtype; v_order public.orders%rowtype; v_subtotal numeric;
begin
  if p_price is null or p_price<=0 then raise exception 'Informe um preco valido.'; end if;
  select pr.* into v_producer from public.producers pr join public.profiles p on p.id=pr.profile_id
    where p.user_id=auth.uid() and pr.ativo;
  if not found then raise exception 'Cadastro de produtor nao encontrado.'; end if;
  select * into v_quote from public.quote_requests where id=p_quote_id and status='aberta' and producer_id is null for update;
  if not found then raise exception 'Esta cotacao ja foi respondida.'; end if;
  select * into v_buyer from public.buyers where id=v_quote.buyer_id;
  v_subtotal:=v_quote.quantidade*p_price;
  update public.quote_requests set producer_id=v_producer.id,preco_resposta=p_price,
    observacoes_resposta=nullif(btrim(p_notes),''),status='respondida',respondido_em=now() where id=p_quote_id;
  insert into public.orders(buyer_id,buyer_name,status,subtotal,delivery,total,entrega_label,origem_solicitacao_id,
    cancelamento_limite_em,codigo_entrega)
  values(v_quote.buyer_id,coalesce(v_buyer.nome_empresa,'Comprador'),'recebido',v_subtotal,0,v_subtotal,
    case when v_quote.entrega_desejada is null then 'Aguardando data e hora do produtor' else 'Solicitado para '||to_char(v_quote.entrega_desejada,'DD/MM/YYYY') end,
    v_quote.id,now()+interval '2 hours',lpad((floor(random()*9000)+1000)::int::text,4,'0')) returning * into v_order;
  insert into public.order_items(order_id,product_ref,product_name,quantidade,unidade,preco_unitario,producer_id,
    producer_ref,producer_name,escolha_manual_produtor,line_total,observacoes)
  values(v_order.id,v_quote.nome_produto,v_quote.nome_produto,v_quote.quantidade,v_quote.unidade,p_price,
    v_producer.id,v_producer.id::text,coalesce(v_producer.responsavel,v_producer.nome_propriedade),true,v_subtotal,
    concat_ws(' | ',case when v_quote.observacoes is not null then 'Solicitacao: '||v_quote.observacoes end,
      case when nullif(btrim(p_notes),'') is not null then 'Resposta do produtor: '||btrim(p_notes) end));
  return v_order.id;
end $$;

-- Delivery completion is idempotent and decrements only inventory belonging to the order.
create or replace function public.secure_complete_order(p_order_id uuid,p_delivery_code text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.orders%rowtype; v_receipt text; v_item record; v_inventory public.producer_inventory%rowtype;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Pedido nao encontrado.'; end if;
  if v_order.status='entregue' then return jsonb_build_object('receiptCode',v_order.codigo_recibo,'deliveredAt',v_order.entregue_em); end if;
  if v_order.status<>'em_entrega' then raise exception 'Somente pedidos em entrega podem ser concluidos.'; end if;
  if not exists(select 1 from public.order_items oi join public.producers pr on pr.id=oi.producer_id
    join public.profiles p on p.id=pr.profile_id where oi.order_id=p_order_id and p.user_id=auth.uid()) then
    raise exception 'Apenas um produtor participante pode concluir o pedido.'; end if;
  if v_order.codigo_entrega is null or btrim(p_delivery_code)<>v_order.codigo_entrega then raise exception 'Codigo de entrega incorreto.'; end if;
  for v_item in select product_ref,sum(quantidade) quantity from public.order_items
    where order_id=p_order_id and product_ref ~* '^[0-9a-f-]{36}$' group by product_ref loop
    select * into v_inventory from public.producer_inventory where id=v_item.product_ref::uuid for update;
    if not found then raise exception 'Anuncio do pedido nao encontrado.'; end if;
    if v_inventory.quantidade_disponivel<v_item.quantity then raise exception 'Estoque insuficiente para concluir a entrega.'; end if;
    update public.producer_inventory set quantidade_disponivel=quantidade_disponivel-v_item.quantity,
      ativo=(quantidade_disponivel-v_item.quantity)>0,atualizado_em=now() where id=v_inventory.id;
  end loop;
  v_receipt:=coalesce(v_order.codigo_recibo,'OC-'||lpad((floor(random()*900000)+100000)::int::text,6,'0'));
  update public.orders set status='entregue',entregue_em=now(),codigo_recibo=v_receipt where id=p_order_id;
  return jsonb_build_object('receiptCode',v_receipt,'deliveredAt',now());
end $$;

revoke all on function public.secure_create_portfolio_order(jsonb,jsonb) from public;
revoke all on function public.secure_accept_demand_response(uuid) from public;
revoke all on function public.secure_respond_quote(uuid,numeric,text) from public;
grant execute on function public.secure_create_portfolio_order(jsonb,jsonb) to authenticated;
grant execute on function public.secure_accept_demand_response(uuid) to authenticated;
grant execute on function public.secure_respond_quote(uuid,numeric,text) to authenticated;

-- Orders and items can now only be inserted through the transactional functions above.
drop policy if exists "buyers create own orders" on public.orders;
drop policy if exists "orders insert by quote producer" on public.orders;
drop policy if exists "order items insert by buyer" on public.order_items;
drop policy if exists "order items insert by quote producer" on public.order_items;
drop policy if exists "quote requests response by producer" on public.quote_requests;
