-- Secure organization signup and make inventory/order progress safe for multi-producer orders.

alter table public.order_items
  add column if not exists reserved_quantity numeric(12,2) not null default 0,
  add column if not exists producer_confirmed_at timestamptz,
  add column if not exists producer_shipped_at timestamptz,
  add column if not exists producer_delivered_at timestamptz;

alter table public.order_items drop constraint if exists order_items_reserved_quantity_nonnegative;
alter table public.order_items add constraint order_items_reserved_quantity_nonnegative
  check (reserved_quantity >= 0 and reserved_quantity <= quantidade);

-- Signup metadata is client-controlled. Validate the complete organization shape in the database
-- and only allow an organization profile (or its explicit producer variant) to create one.
create or replace function public.handle_application_signup()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v jsonb:=new.raw_user_meta_data->'signup_payload'; v_profile public.profiles%rowtype;
  v_producer public.producers%rowtype; v_org public.organizations%rowtype; v_type text;
  v_org_payload jsonb; v_cnpj text; v_state text;
begin
  if v is null then return new; end if;
  v_type:=v->>'tipo';
  if v_type not in ('comprador','produtor','organizacao') then raise exception 'Tipo de cadastro invalido.'; end if;
  if nullif(btrim(v->>'nome'),'') is null or nullif(btrim(new.email),'') is null then
    raise exception 'Nome e e-mail sao obrigatorios.';
  end if;

  v_org_payload:=v->'organization';
  if v_type='organizacao' and (v_org_payload is null or jsonb_typeof(v_org_payload)<>'object') then
    raise exception 'Os dados da organizacao sao obrigatorios.';
  end if;
  if v_org_payload is not null then
    if jsonb_typeof(v_org_payload)<>'object' or v_type not in ('organizacao','produtor') then
      raise exception 'Este tipo de conta nao pode criar uma organizacao.';
    end if;
    if v_type='produtor' and coalesce(v->'producer'->>'commercializationMode','')<>'organization' then
      raise exception 'O produtor deve declarar comercializacao pela organizacao.';
    end if;
    v_cnpj:=regexp_replace(coalesce(v_org_payload->>'cnpj',''),'\D','','g');
    v_state:=upper(btrim(coalesce(v->>'estado','')));
    if coalesce(v_org_payload->>'type','') not in ('cooperativa','associacao')
       or nullif(btrim(v_org_payload->>'legalName'),'') is null
       or nullif(btrim(v_org_payload->>'tradeName'),'') is null
       or nullif(btrim(v_org_payload->>'phone'),'') is null
       or nullif(btrim(v_org_payload->>'addressLine'),'') is null
       or nullif(btrim(v_org_payload->>'responsibleName'),'') is null
       or nullif(btrim(v_org_payload->>'responsibleRole'),'') is null
       or nullif(btrim(v->>'cidade'),'') is null
       or v_state !~ '^[A-Z]{2}$'
       or not public.is_valid_cnpj(v_cnpj) then
      raise exception 'Dados da organizacao invalidos ou incompletos.';
    end if;
  end if;

  insert into public.profiles(user_id,tipo,nome,telefone,email,cidade,estado)
  values(new.id,v_type::public.profile_type,btrim(v->>'nome'),nullif(btrim(v->>'telefone'),''),new.email,
    nullif(btrim(v->>'cidade'),''),nullif(upper(btrim(v->>'estado')),'')) returning * into v_profile;
  insert into public.profile_roles(profile_id,role)
  values(v_profile.id,case when v_type='organizacao' then 'gestor_organizacao' else v_type end);

  if v_type='comprador' then
    insert into public.buyers(profile_id,nome_empresa,tipo_empresa,cnpj)
    values(v_profile.id,btrim(v->'buyer'->>'nomeEmpresa'),btrim(v->'buyer'->>'tipoEmpresa'),
      nullif(regexp_replace(v->'buyer'->>'cnpj','\D','','g'),''));
  elsif v_type='produtor' then
    if nullif(btrim(v->'producer'->>'nomePropriedade'),'') is null
       or nullif(btrim(v->'producer'->>'responsavel'),'') is null then
      raise exception 'Dados do produtor invalidos ou incompletos.';
    end if;
    insert into public.producers(profile_id,nome_propriedade,responsavel,cnpj,commercialization_mode,localizacao,categorias_atendidas)
    values(v_profile.id,btrim(v->'producer'->>'nomePropriedade'),btrim(v->'producer'->>'responsavel'),null,
      coalesce(nullif(v->'producer'->>'commercializationMode',''),'undecided'),
      nullif(concat_ws(', ',v->>'cidade',upper(v->>'estado')),''),
      coalesce(array(select jsonb_array_elements_text(coalesce(v->'producer'->'produtos','[]'::jsonb))),'{}'))
    returning * into v_producer;
    insert into public.producer_commercial_documents(producer_id,cnpj,caepf,state_registration)
    values(v_producer.id,nullif(regexp_replace(v->'producer'->>'cnpj','\D','','g'),''),
      nullif(btrim(v->'producer'->>'caepf'),''),nullif(btrim(v->'producer'->>'stateRegistration'),''));
  end if;

  if v_org_payload is not null then
    insert into public.organizations(type,legal_name,trade_name,cnpj,state_registration,email,phone,address_line,
      address_number,address_complement,neighborhood,city,state,postal_code,responsible_name,responsible_role,
      status,created_by)
    values(v_org_payload->>'type',btrim(v_org_payload->>'legalName'),btrim(v_org_payload->>'tradeName'),v_cnpj,
      nullif(btrim(v_org_payload->>'stateRegistration'),''),new.email,btrim(v_org_payload->>'phone'),
      btrim(v_org_payload->>'addressLine'),nullif(btrim(v_org_payload->>'addressNumber'),''),
      nullif(btrim(v_org_payload->>'addressComplement'),''),nullif(btrim(v_org_payload->>'neighborhood'),''),
      btrim(v->>'cidade'),v_state,regexp_replace(coalesce(v_org_payload->>'postalCode',''),'\D','','g'),
      btrim(v_org_payload->>'responsibleName'),btrim(v_org_payload->>'responsibleRole'),'active',v_profile.id)
    returning * into v_org;
    insert into public.organization_users(organization_id,profile_id,role,status)
      values(v_org.id,v_profile.id,'owner','active');
    insert into public.profile_roles(profile_id,role) values(v_profile.id,'gestor_organizacao') on conflict do nothing;
    -- The existing link_creator_membership trigger links an optional producer profile.
  end if;
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)-'signup_payload' where id=new.id;
  return new;
end $$;

-- Reserve portfolio inventory in the same transaction that creates the order.
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
    select * into v_inventory from public.producer_inventory where id=(v_item->>'productId')::uuid and ativo for update;
    if not found then raise exception 'Produto indisponivel.'; end if;
    if v_inventory.quantidade_disponivel<v_qty then raise exception 'Estoque insuficiente para %.',coalesce(v_inventory.nome_produto,'produto'); end if;
    update public.producer_inventory set quantidade_disponivel=quantidade_disponivel-v_qty,
      ativo=(quantidade_disponivel-v_qty)>0,atualizado_em=now() where id=v_inventory.id;
    v_subtotal:=v_subtotal+(v_qty*v_inventory.preco);
  end loop;
  insert into public.orders(buyer_id,buyer_name,status,subtotal,delivery,total,entrega_label,entrega_prevista,
    cancelamento_limite_em,codigo_entrega,payment_method,payment_notes)
  values(v_buyer.id,coalesce(v_buyer.nome_empresa,p_order->>'buyerName'),'recebido',v_subtotal,v_delivery,
    v_subtotal+v_delivery,p_order->>'deliveryEta',nullif(p_order->>'deliveryAt','')::timestamptz,
    now()+interval '2 hours',lpad((floor(random()*9000)+1000)::int::text,4,'0'),
    coalesce(nullif(p_order->>'paymentMethod',''),'A combinar'),nullif(p_order->>'paymentNotes','')) returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=(v_item->>'quantity')::numeric;
    select * into v_inventory from public.producer_inventory where id=(v_item->>'productId')::uuid;
    insert into public.order_items(order_id,product_ref,product_name,quantidade,unidade,preco_unitario,producer_id,
      producer_ref,producer_name,escolha_manual_produtor,line_total,observacoes,reserved_quantity,
      seller_organization_id,seller_organization_name,seller_organization_cnpj)
    select v_order.id,v_inventory.id::text,coalesce(v_inventory.nome_produto,p.nome),v_qty,v_inventory.unidade,
      v_inventory.preco,v_inventory.producer_id,v_inventory.producer_id::text,
      coalesce(pr.responsavel,pr.nome_propriedade),coalesce((v_item->>'manualProducerChoice')::boolean,false),
      v_qty*v_inventory.preco,nullif(v_item->>'notes',''),v_qty,v_inventory.seller_organization_id,
      o.trade_name,o.cnpj
    from public.producers pr left join public.products p on p.id=v_inventory.product_id
    left join public.organizations o on o.id=v_inventory.seller_organization_id
    where pr.id=v_inventory.producer_id;
  end loop;
  return jsonb_build_object('id',v_order.id,'createdAt',v_order.criado_em);
end $$;

create or replace function public.secure_confirm_order(p_order_id uuid,p_delivery_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.orders%rowtype; v_producer_id uuid; v_label text;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;
  if p_delivery_at is null or p_delivery_at<=now() then raise exception 'Informe uma data futura para a entrega.'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.status in ('entregue','cancelado') then raise exception 'Pedido nao pode ser confirmado.'; end if;
  select pr.id into v_producer_id from public.producers pr join public.profiles p on p.id=pr.profile_id
    where p.user_id=auth.uid() and exists(select 1 from public.order_items oi where oi.order_id=p_order_id and oi.producer_id=pr.id);
  if v_producer_id is null then raise exception 'Apenas um produtor participante pode confirmar o pedido.'; end if;
  update public.order_items set producer_confirmed_at=coalesce(producer_confirmed_at,now())
    where order_id=p_order_id and producer_id=v_producer_id;
  v_label:=to_char(p_delivery_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI');
  update public.orders set status=case when not exists(select 1 from public.order_items where order_id=p_order_id and producer_confirmed_at is null)
      then 'em_separacao'::public.order_status else 'recebido'::public.order_status end,
    entrega_prevista=p_delivery_at,entrega_label=v_label,confirmado_em=coalesce(confirmado_em,now()) where id=p_order_id;
  return jsonb_build_object('deliveryLabel',v_label);
end $$;

create or replace function public.secure_ship_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.orders%rowtype; v_producer_id uuid;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.status in ('entregue','cancelado') then raise exception 'Pedido nao pode sair para entrega.'; end if;
  select pr.id into v_producer_id from public.producers pr join public.profiles p on p.id=pr.profile_id
    where p.user_id=auth.uid() and exists(select 1 from public.order_items oi where oi.order_id=p_order_id and oi.producer_id=pr.id);
  if v_producer_id is null then raise exception 'Apenas um produtor participante pode atualizar o pedido.'; end if;
  if exists(select 1 from public.order_items where order_id=p_order_id and producer_id=v_producer_id and producer_confirmed_at is null)
    then raise exception 'Confirme seus itens antes de sair para entrega.'; end if;
  update public.order_items set producer_shipped_at=coalesce(producer_shipped_at,now())
    where order_id=p_order_id and producer_id=v_producer_id;
  update public.orders set status=case
      when not exists(select 1 from public.order_items where order_id=p_order_id and producer_shipped_at is null) then 'em_entrega'::public.order_status
      when not exists(select 1 from public.order_items where order_id=p_order_id and producer_confirmed_at is null) then 'em_separacao'::public.order_status
      else 'recebido'::public.order_status end,
    saiu_entrega_em=coalesce(saiu_entrega_em,now()) where id=p_order_id;
  return jsonb_build_object('status','em_entrega');
end $$;

create or replace function public.secure_complete_order(p_order_id uuid,p_delivery_code text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.orders%rowtype; v_producer_id uuid; v_receipt text; v_all_delivered boolean;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.status='cancelado' then raise exception 'Pedido nao pode ser concluido.'; end if;
  select pr.id into v_producer_id from public.producers pr join public.profiles p on p.id=pr.profile_id
    where p.user_id=auth.uid() and exists(select 1 from public.order_items oi where oi.order_id=p_order_id and oi.producer_id=pr.id);
  if v_producer_id is null then raise exception 'Apenas um produtor participante pode concluir seus itens.'; end if;
  if exists(select 1 from public.order_items where order_id=p_order_id and producer_id=v_producer_id and producer_shipped_at is null)
    then raise exception 'Seus itens precisam estar em entrega.'; end if;
  if v_order.codigo_entrega is null or btrim(p_delivery_code)<>v_order.codigo_entrega then raise exception 'Codigo de entrega incorreto.'; end if;
  update public.order_items set producer_delivered_at=coalesce(producer_delivered_at,now()),reserved_quantity=0
    where order_id=p_order_id and producer_id=v_producer_id;
  select not exists(select 1 from public.order_items where order_id=p_order_id and producer_delivered_at is null)
    into v_all_delivered;
  v_receipt:=coalesce(v_order.codigo_recibo,'OC-'||lpad((floor(random()*900000)+100000)::int::text,6,'0'));
  update public.orders set status=case when v_all_delivered then 'entregue'::public.order_status else status end,
    entregue_em=case when v_all_delivered then now() else entregue_em end,
    codigo_recibo=case when v_all_delivered then v_receipt else codigo_recibo end where id=p_order_id;
  return jsonb_build_object('receiptCode',case when v_all_delivered then v_receipt else null end,
    'deliveredAt',now(),'orderCompleted',v_all_delivered,'producerCompleted',true);
end $$;

-- Return only inventory that was actually reserved by a portfolio order.
create or replace function public.secure_cancel_order(p_order_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.orders%rowtype; v_actor text; v_reason text:=nullif(btrim(p_reason),''); v_item record;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Pedido nao encontrado.'; end if;
  if v_order.status in ('entregue','cancelado') then raise exception 'Este pedido nao pode mais ser cancelado.'; end if;
  if now()>coalesce(v_order.cancelamento_limite_em,v_order.criado_em+interval '2 hours') then raise exception 'O prazo de cancelamento terminou.'; end if;
  if exists(select 1 from public.buyers b join public.profiles p on p.id=b.profile_id where b.id=v_order.buyer_id and p.user_id=auth.uid()) then v_actor:='comprador';
  elsif exists(select 1 from public.order_items oi join public.producers pr on pr.id=oi.producer_id join public.profiles p on p.id=pr.profile_id where oi.order_id=p_order_id and p.user_id=auth.uid()) then
    if (select count(distinct producer_id) from public.order_items where order_id=p_order_id and producer_id is not null)>1 then
      raise exception 'Pedidos com varios produtores so podem ser cancelados pelo comprador.';
    end if;
    v_actor:='produtor';
  elsif exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.tipo='admin') then v_actor:='admin';
  else raise exception 'Usuario sem permissao para cancelar este pedido.'; end if;
  for v_item in select product_ref,sum(reserved_quantity) qty from public.order_items
    where order_id=p_order_id and reserved_quantity>0 and product_ref ~* '^[0-9a-f-]{36}$' group by product_ref loop
    update public.producer_inventory set quantidade_disponivel=quantidade_disponivel+v_item.qty,ativo=true,atualizado_em=now()
      where id=v_item.product_ref::uuid;
  end loop;
  update public.order_items set reserved_quantity=0 where order_id=p_order_id;
  update public.orders set status='cancelado',cancelado_em=now(),cancelado_por=v_actor,
    motivo_cancelamento=coalesce(v_reason,'Cancelado pelo usuario.') where id=p_order_id;
  return jsonb_build_object('actor',v_actor,'canceledAt',now());
end $$;

revoke all on function public.secure_create_portfolio_order(jsonb,jsonb) from public,anon;
revoke all on function public.secure_confirm_order(uuid,timestamptz) from public,anon;
revoke all on function public.secure_ship_order(uuid) from public,anon;
revoke all on function public.secure_complete_order(uuid,text) from public,anon;
revoke all on function public.secure_cancel_order(uuid,text) from public,anon;
grant execute on function public.secure_create_portfolio_order(jsonb,jsonb) to authenticated;
grant execute on function public.secure_confirm_order(uuid,timestamptz) to authenticated;
grant execute on function public.secure_ship_order(uuid) to authenticated;
grant execute on function public.secure_complete_order(uuid,text) to authenticated;
grant execute on function public.secure_cancel_order(uuid,text) to authenticated;
