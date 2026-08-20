-- Structured commercial proposals inside buyer/producer conversations.
-- The creator implicitly accepts their own proposal. Acceptance by the other
-- participant creates and reserves the order atomically.

alter table public.orders add column if not exists delivery_notes text;
grant select (delivery_notes) on public.orders to authenticated;

alter table public.conversations
  drop constraint if exists conversations_conversation_context_check,
  drop constraint if exists chat_context_not_null;
alter table public.conversations
  add constraint conversations_conversation_context_check
    check (conversation_context in ('portfolio','demand','order','direct')),
  add constraint chat_context_valid check (
    (conversation_context='direct' and order_id is null and demand_id is null and portfolio_product_id is null)
    or (conversation_context<>'direct' and (order_id is not null or demand_id is not null or portfolio_product_id is not null))
  );
create unique index if not exists conversations_unique_direct_idx
  on public.conversations(buyer_id,producer_id)
  where conversation_context='direct' and order_id is null and demand_id is null and portfolio_product_id is null;

create or replace function public.get_or_create_direct_conversation(
  p_buyer_id uuid,p_producer_id uuid,p_initial_message text default null
)
returns public.conversations language plpgsql security definer set search_path=public,pg_temp as $$
declare v_profile public.profiles%rowtype; v_conversation public.conversations%rowtype;
begin
  select * into v_profile from public.profiles where user_id=auth.uid();
  if not found then raise exception 'Perfil autenticado não encontrado.'; end if;
  if not exists(select 1 from public.buyers where id=p_buyer_id and ativo) then raise exception 'Comprador inválido ou inativo.'; end if;
  if not exists(select 1 from public.producers where id=p_producer_id and ativo) then raise exception 'Produtor inválido ou inativo.'; end if;
  if not exists(select 1 from public.buyers where id=p_buyer_id and profile_id=v_profile.id)
     and not exists(select 1 from public.producers where id=p_producer_id and profile_id=v_profile.id) then
    raise exception 'Usuário não participa desta conversa.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('direct:'||p_buyer_id||':'||p_producer_id,0));
  select * into v_conversation from public.conversations
  where buyer_id=p_buyer_id and producer_id=p_producer_id and conversation_context='direct'
    and order_id is null and demand_id is null and portfolio_product_id is null limit 1;
  if not found then
    insert into public.conversations(buyer_id,producer_id,conversation_context)
    values(p_buyer_id,p_producer_id,'direct') returning * into v_conversation;
    if nullif(btrim(p_initial_message),'') is not null then
      if char_length(btrim(p_initial_message))>2000 then raise exception 'A mensagem inicial excede 2.000 caracteres.'; end if;
      insert into public.messages(conversation_id,sender_id,message)
      values(v_conversation.id,v_profile.id,btrim(p_initial_message));
    end if;
  end if;
  return v_conversation;
end; $$;

create table public.negotiation_proposals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  version integer not null,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','superseded','expired')),
  created_by uuid not null references public.profiles(id),
  supersedes_id uuid references public.negotiation_proposals(id),
  payment_method text not null default 'A combinar'
    check (payment_method in ('Pix','Cartão','Dinheiro','A combinar')),
  delivery_method text not null default 'A combinar'
    check (delivery_method in ('Entrega','Retirada','A combinar')),
  delivery_at timestamptz,
  delivery_notes text,
  notes text,
  expires_at timestamptz not null default (now()+interval '7 days'),
  responded_at timestamptz,
  responded_by uuid references public.profiles(id),
  order_id uuid unique references public.orders(id),
  created_at timestamptz not null default now(),
  unique (conversation_id,version)
);

create table public.negotiation_proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.negotiation_proposals(id) on delete cascade,
  inventory_id uuid not null references public.producer_inventory(id),
  product_name text not null,
  quantity numeric(12,2) not null check (quantity>0),
  unit text not null,
  unit_price numeric(12,2) not null check (unit_price>0),
  line_total numeric(12,2) generated always as (quantity*unit_price) stored,
  seller_organization_id uuid references public.organizations(id),
  seller_organization_name text,
  seller_organization_cnpj text,
  unique (proposal_id,inventory_id)
);

create unique index negotiation_proposals_one_pending_idx
  on public.negotiation_proposals(conversation_id) where status='pending';
create index negotiation_proposals_conversation_idx
  on public.negotiation_proposals(conversation_id,created_at);
create index negotiation_proposal_items_proposal_idx
  on public.negotiation_proposal_items(proposal_id);

alter table public.negotiation_proposals enable row level security;
alter table public.negotiation_proposal_items enable row level security;

create policy "conversation participants read proposals"
on public.negotiation_proposals for select to authenticated
using (
  exists (
    select 1 from public.conversations c
    left join public.buyers b on b.id=c.buyer_id
    left join public.producers pr on pr.id=c.producer_id
    left join public.profiles caller on caller.user_id=auth.uid()
    where c.id=negotiation_proposals.conversation_id
      and (b.profile_id=caller.id or pr.profile_id=caller.id)
  )
);

create policy "conversation participants read proposal items"
on public.negotiation_proposal_items for select to authenticated
using (
  exists (
    select 1
    from public.negotiation_proposals proposal
    join public.conversations c on c.id=proposal.conversation_id
    left join public.buyers b on b.id=c.buyer_id
    left join public.producers pr on pr.id=c.producer_id
    left join public.profiles caller on caller.user_id=auth.uid()
    where proposal.id=negotiation_proposal_items.proposal_id
      and (b.profile_id=caller.id or pr.profile_id=caller.id)
  )
);

create or replace function public.list_conversation_proposal_inventory(p_conversation_id uuid)
returns table(
  inventory_id uuid, product_name text, unit text, available_quantity numeric,
  announced_price numeric, image_url text, seller_organization_id uuid,
  seller_organization_name text, seller_organization_cnpj text
)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_conversation public.conversations%rowtype; v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where user_id=auth.uid();
  select * into v_conversation from public.conversations where id=p_conversation_id;
  if not found or v_profile.id is null then raise exception 'Conversa não encontrada.'; end if;
  if not exists(select 1 from public.buyers where id=v_conversation.buyer_id and profile_id=v_profile.id)
     and not exists(select 1 from public.producers where id=v_conversation.producer_id and profile_id=v_profile.id) then
    raise exception 'Usuário não participa desta conversa.';
  end if;
  return query
  select pi.id,coalesce(pi.nome_produto,p.nome,'Produto'),pi.unidade,pi.quantidade_disponivel,
    pi.preco,pi.imagem_url,pi.seller_organization_id,pi.seller_organization_name,pi.seller_organization_cnpj
  from public.producer_inventory pi
  left join public.products p on p.id=pi.product_id
  where pi.producer_id=v_conversation.producer_id and pi.ativo and pi.quantidade_disponivel>0
  order by coalesce(pi.nome_produto,p.nome,'Produto');
end; $$;

create or replace function public.create_negotiation_proposal(
  p_conversation_id uuid,p_proposal jsonb,p_items jsonb
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_conversation public.conversations%rowtype; v_profile public.profiles%rowtype;
  v_proposal public.negotiation_proposals%rowtype; v_inventory public.producer_inventory%rowtype;
  v_item jsonb; v_version integer; v_quantity numeric; v_price numeric;
  v_payment text:=coalesce(nullif(btrim(p_proposal->>'paymentMethod'),''),'A combinar');
  v_delivery text:=coalesce(nullif(btrim(p_proposal->>'deliveryMethod'),''),'A combinar');
  v_delivery_at timestamptz; v_expires_at timestamptz;
begin
  select * into v_profile from public.profiles where user_id=auth.uid();
  select * into v_conversation from public.conversations where id=p_conversation_id for update;
  if v_profile.id is null or not found then raise exception 'Conversa não encontrada.'; end if;
  if not exists(select 1 from public.buyers where id=v_conversation.buyer_id and profile_id=v_profile.id)
     and not exists(select 1 from public.producers where id=v_conversation.producer_id and profile_id=v_profile.id) then
    raise exception 'Usuário não participa desta conversa.';
  end if;
  if v_conversation.order_id is not null then raise exception 'Esta conversa já possui um pedido.'; end if;
  if v_payment not in ('Pix','Cartão','Dinheiro','A combinar') then raise exception 'Forma de pagamento inválida.'; end if;
  if v_delivery not in ('Entrega','Retirada','A combinar') then raise exception 'Forma de entrega inválida.'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>20 then
    raise exception 'Inclua de 1 a 20 produtos na proposta.';
  end if;
  begin v_delivery_at:=nullif(p_proposal->>'deliveryAt','')::timestamptz;
  exception when others then raise exception 'Data de entrega inválida.'; end;
  if v_delivery_at is not null and v_delivery_at<=now() then raise exception 'Informe uma data futura para a entrega.'; end if;
  begin v_expires_at:=coalesce(nullif(p_proposal->>'expiresAt','')::timestamptz,now()+interval '7 days');
  exception when others then raise exception 'Validade da proposta inválida.'; end;
  if v_expires_at<=now() or v_expires_at>now()+interval '30 days' then
    raise exception 'A validade deve estar entre agora e 30 dias.';
  end if;

  update public.negotiation_proposals set status='expired',responded_at=now()
  where conversation_id=p_conversation_id and status='pending' and expires_at<=now();
  update public.negotiation_proposals set status='superseded',responded_at=now(),responded_by=v_profile.id
  where conversation_id=p_conversation_id and status='pending';
  select coalesce(max(version),0)+1 into v_version from public.negotiation_proposals where conversation_id=p_conversation_id;
  insert into public.negotiation_proposals(
    conversation_id,version,created_by,supersedes_id,payment_method,delivery_method,
    delivery_at,delivery_notes,notes,expires_at
  ) values(
    p_conversation_id,v_version,v_profile.id,
    (select id from public.negotiation_proposals where conversation_id=p_conversation_id order by version desc limit 1),
    v_payment,v_delivery,v_delivery_at,nullif(btrim(p_proposal->>'deliveryNotes'),''),
    nullif(btrim(p_proposal->>'notes'),''),v_expires_at
  ) returning * into v_proposal;

  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      v_quantity:=(v_item->>'quantity')::numeric;
      v_price:=(v_item->>'unitPrice')::numeric;
    exception when others then raise exception 'Quantidade ou preço inválido.'; end;
    if v_quantity<=0 or v_price<=0 then raise exception 'Quantidade e preço devem ser maiores que zero.'; end if;
    select * into v_inventory from public.producer_inventory
    where id=(v_item->>'inventoryId')::uuid and producer_id=v_conversation.producer_id and ativo for share;
    if not found then raise exception 'Produto indisponível para este produtor.'; end if;
    if v_quantity>v_inventory.quantidade_disponivel then
      raise exception 'Estoque insuficiente para %.',coalesce(v_inventory.nome_produto,'produto');
    end if;
    insert into public.negotiation_proposal_items(
      proposal_id,inventory_id,product_name,quantity,unit,unit_price,
      seller_organization_id,seller_organization_name,seller_organization_cnpj
    ) select v_proposal.id,v_inventory.id,coalesce(v_inventory.nome_produto,p.nome,'Produto'),
      v_quantity,v_inventory.unidade,v_price,v_inventory.seller_organization_id,
      v_inventory.seller_organization_name,v_inventory.seller_organization_cnpj
    from public.products p where p.id=v_inventory.product_id
    union all
    select v_proposal.id,v_inventory.id,coalesce(v_inventory.nome_produto,'Produto'),
      v_quantity,v_inventory.unidade,v_price,v_inventory.seller_organization_id,
      v_inventory.seller_organization_name,v_inventory.seller_organization_cnpj
    where v_inventory.product_id is null;
  end loop;

  insert into public.messages(conversation_id,sender_id,message)
  values(p_conversation_id,v_profile.id,'Proposta comercial #'||v_version||' enviada.');
  return jsonb_build_object('id',v_proposal.id,'version',v_version);
end; $$;

create or replace function public.reject_negotiation_proposal(p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_proposal public.negotiation_proposals%rowtype; v_conversation public.conversations%rowtype; v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where user_id=auth.uid();
  select * into v_proposal from public.negotiation_proposals where id=p_proposal_id;
  select * into v_conversation from public.conversations where id=v_proposal.conversation_id for update;
  select * into v_proposal from public.negotiation_proposals where id=p_proposal_id for update;
  if v_profile.id is null or v_proposal.id is null then raise exception 'Proposta não encontrada.'; end if;
  if not exists(select 1 from public.buyers where id=v_conversation.buyer_id and profile_id=v_profile.id)
     and not exists(select 1 from public.producers where id=v_conversation.producer_id and profile_id=v_profile.id) then
    raise exception 'Usuário não participa desta conversa.';
  end if;
  if v_proposal.created_by=v_profile.id then raise exception 'Você não pode recusar a própria proposta.'; end if;
  if v_proposal.status<>'pending' or v_proposal.expires_at<=now() then raise exception 'Esta proposta não está mais disponível.'; end if;
  update public.negotiation_proposals set status='rejected',responded_at=now(),responded_by=v_profile.id where id=p_proposal_id;
  insert into public.messages(conversation_id,sender_id,message)
  values(v_conversation.id,v_profile.id,'Proposta comercial #'||v_proposal.version||' recusada.');
  return jsonb_build_object('id',p_proposal_id,'status','rejected');
end; $$;

create or replace function public.accept_negotiation_proposal(p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_proposal public.negotiation_proposals%rowtype; v_conversation public.conversations%rowtype;
  v_profile public.profiles%rowtype; v_buyer public.buyers%rowtype; v_order public.orders%rowtype;
  v_item record; v_inventory public.producer_inventory%rowtype; v_subtotal numeric:=0; v_producer_name text;
begin
  select * into v_profile from public.profiles where user_id=auth.uid();
  select * into v_proposal from public.negotiation_proposals where id=p_proposal_id;
  select * into v_conversation from public.conversations where id=v_proposal.conversation_id for update;
  select * into v_proposal from public.negotiation_proposals where id=p_proposal_id for update;
  if v_profile.id is null or v_proposal.id is null then raise exception 'Proposta não encontrada.'; end if;
  if not exists(select 1 from public.buyers where id=v_conversation.buyer_id and profile_id=v_profile.id)
     and not exists(select 1 from public.producers where id=v_conversation.producer_id and profile_id=v_profile.id) then
    raise exception 'Usuário não participa desta conversa.';
  end if;
  if v_proposal.created_by=v_profile.id then raise exception 'A proposta já está aceita por quem a enviou.'; end if;
  if v_proposal.status<>'pending' or v_proposal.expires_at<=now() then raise exception 'Esta proposta não está mais disponível.'; end if;
  if v_conversation.order_id is not null then raise exception 'Esta conversa já possui um pedido.'; end if;
  select * into v_buyer from public.buyers where id=v_conversation.buyer_id for update;
  if length(coalesce(v_buyer.postal_code,''))<>8 or nullif(btrim(v_buyer.address_line),'') is null
     or nullif(btrim(v_buyer.neighborhood),'') is null then
    raise exception 'O comprador precisa completar o endereço antes de aceitar a proposta.';
  end if;
  select coalesce(responsavel,nome_propriedade,'Produtor') into v_producer_name
  from public.producers where id=v_conversation.producer_id;

  for v_item in select * from public.negotiation_proposal_items where proposal_id=p_proposal_id order by id loop
    select * into v_inventory from public.producer_inventory where id=v_item.inventory_id for update;
    if not found or not v_inventory.ativo or v_inventory.producer_id<>v_conversation.producer_id
       or v_inventory.quantidade_disponivel<v_item.quantity then
      raise exception 'O estoque de % mudou. Faça uma nova proposta.',v_item.product_name;
    end if;
    if v_item.seller_organization_id is not null and not exists(
      select 1 from public.organization_members om join public.organizations o on o.id=om.organization_id
      where om.organization_id=v_item.seller_organization_id and om.producer_id=v_conversation.producer_id
        and om.status='active' and om.can_sell_through_organization and o.status='active'
    ) then raise exception 'A autorização comercial de % mudou. Faça uma nova proposta.',v_item.product_name; end if;
    v_subtotal:=v_subtotal+v_item.line_total;
  end loop;

  insert into public.orders(
    buyer_id,buyer_name,status,subtotal,delivery,total,entrega_label,entrega_prevista,
    cancelamento_limite_em,codigo_entrega,payment_method,payment_notes,delivery_notes,origem_demanda_id,
    delivery_postal_code,delivery_address_line,delivery_address_number,delivery_address_complement,
    delivery_neighborhood,delivery_city,delivery_state
  ) select v_buyer.id,coalesce(v_buyer.nome_empresa,bp.nome,'Comprador'),'recebido',v_subtotal,0,v_subtotal,
    case when v_proposal.delivery_at is not null then to_char(v_proposal.delivery_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
      else v_proposal.delivery_method end,v_proposal.delivery_at,now()+interval '2 hours',
    public.generate_order_delivery_code(),v_proposal.payment_method,null,v_proposal.delivery_notes,
    v_conversation.demand_id,
    v_buyer.postal_code,v_buyer.address_line,v_buyer.address_number,v_buyer.address_complement,
    v_buyer.neighborhood,bp.cidade,bp.estado
  from public.profiles bp where bp.id=v_buyer.profile_id returning * into v_order;

  for v_item in select * from public.negotiation_proposal_items where proposal_id=p_proposal_id order by id loop
    update public.producer_inventory set quantidade_disponivel=quantidade_disponivel-v_item.quantity,
      ativo=(quantidade_disponivel-v_item.quantity)>0,atualizado_em=now() where id=v_item.inventory_id;
    insert into public.order_items(
      order_id,product_ref,product_name,quantidade,unidade,preco_unitario,producer_id,
      producer_ref,producer_name,escolha_manual_produtor,line_total,observacoes,reserved_quantity,
      seller_organization_id,seller_organization_name,seller_organization_cnpj
    ) values(
      v_order.id,v_item.inventory_id::text,v_item.product_name,v_item.quantity,v_item.unit,v_item.unit_price,
      v_conversation.producer_id,v_conversation.producer_id::text,v_producer_name,true,v_item.line_total,
      v_proposal.notes,v_item.quantity,v_item.seller_organization_id,v_item.seller_organization_name,
      v_item.seller_organization_cnpj
    );
  end loop;

  update public.negotiation_proposals set status='accepted',responded_at=now(),responded_by=v_profile.id,order_id=v_order.id
  where id=p_proposal_id;
  update public.conversations set order_id=v_order.id,conversation_context='order',updated_at=now() where id=v_conversation.id;
  insert into public.messages(conversation_id,sender_id,message)
  values(v_conversation.id,v_profile.id,'Proposta aceita. Pedido #'||v_order.id||' criado.');
  return jsonb_build_object('proposalId',p_proposal_id,'orderId',v_order.id,'createdAt',v_order.criado_em);
end; $$;

revoke all on function public.list_conversation_proposal_inventory(uuid) from public,anon;
revoke all on function public.get_or_create_direct_conversation(uuid,uuid,text) from public,anon;
revoke all on function public.create_negotiation_proposal(uuid,jsonb,jsonb) from public,anon;
revoke all on function public.reject_negotiation_proposal(uuid) from public,anon;
revoke all on function public.accept_negotiation_proposal(uuid) from public,anon;
grant execute on function public.list_conversation_proposal_inventory(uuid) to authenticated;
grant execute on function public.get_or_create_direct_conversation(uuid,uuid,text) to authenticated;
grant execute on function public.create_negotiation_proposal(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.reject_negotiation_proposal(uuid) to authenticated;
grant execute on function public.accept_negotiation_proposal(uuid) to authenticated;
grant select on public.negotiation_proposals,public.negotiation_proposal_items to authenticated;

do $$ begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='negotiation_proposals'
  ) then alter publication supabase_realtime add table public.negotiation_proposals; end if;
end $$;
