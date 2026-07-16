-- Centraliza operacoes sensiveis no banco e restringe atualizacoes diretas.

drop policy if exists "orders by buyer" on public.orders;
drop policy if exists "orders status by producer" on public.orders;
drop policy if exists "buyers read own orders" on public.orders;
drop policy if exists "buyers create own orders" on public.orders;
drop policy if exists "buyers delete incomplete orders" on public.orders;

create policy "buyers read own orders" on public.orders
  for select to authenticated
  using (
    exists (
      select 1
      from public.buyers b
      join public.profiles p on p.id = b.profile_id
      where b.id = orders.buyer_id and p.user_id = auth.uid()
    )
  );

create policy "buyers create own orders" on public.orders
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.buyers b
      join public.profiles p on p.id = b.profile_id
      where b.id = buyer_id and p.user_id = auth.uid()
    )
  );

create policy "buyers delete incomplete orders" on public.orders
  for delete to authenticated
  using (
    status = 'recebido'
    and exists (
      select 1
      from public.buyers b
      join public.profiles p on p.id = b.profile_id
      where b.id = orders.buyer_id and p.user_id = auth.uid()
    )
  );

create or replace function public.secure_confirm_order(
  p_order_id uuid,
  p_delivery_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_delivery_label text;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido nao encontrado.';
  end if;

  if v_order.status <> 'recebido' then
    raise exception 'Somente pedidos recebidos podem ser confirmados.';
  end if;

  if p_delivery_at is null or p_delivery_at <= now() then
    raise exception 'Informe uma data futura para a entrega.';
  end if;

  if not exists (
    select 1
    from public.order_items oi
    join public.producers pr on pr.id = oi.producer_id
    join public.profiles p on p.id = pr.profile_id
    where oi.order_id = p_order_id and p.user_id = auth.uid()
  ) then
    raise exception 'Apenas um produtor participante pode confirmar o pedido.';
  end if;

  v_delivery_label := to_char(p_delivery_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  update public.orders
  set status = 'em_separacao',
      entrega_prevista = p_delivery_at,
      entrega_label = v_delivery_label,
      confirmado_em = now()
  where id = p_order_id;

  return jsonb_build_object('deliveryLabel', v_delivery_label);
end;
$$;

create or replace function public.secure_ship_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.order_status;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select status into v_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido nao encontrado.';
  end if;

  if v_status <> 'em_separacao' then
    raise exception 'Somente pedidos em separacao podem sair para entrega.';
  end if;

  if not exists (
    select 1
    from public.order_items oi
    join public.producers pr on pr.id = oi.producer_id
    join public.profiles p on p.id = pr.profile_id
    where oi.order_id = p_order_id and p.user_id = auth.uid()
  ) then
    raise exception 'Apenas um produtor participante pode atualizar o pedido.';
  end if;

  update public.orders
  set status = 'em_entrega', saiu_entrega_em = now()
  where id = p_order_id;

  return jsonb_build_object('status', 'em_entrega');
end;
$$;

create or replace function public.secure_cancel_order(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_actor text;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido nao encontrado.';
  end if;

  if v_order.status in ('entregue', 'cancelado') then
    raise exception 'Este pedido nao pode mais ser cancelado.';
  end if;

  if now() > coalesce(v_order.cancelamento_limite_em, v_order.criado_em + interval '2 hours') then
    raise exception 'O prazo de cancelamento terminou.';
  end if;

  if exists (
    select 1
    from public.buyers b
    join public.profiles p on p.id = b.profile_id
    where b.id = v_order.buyer_id and p.user_id = auth.uid()
  ) then
    v_actor := 'comprador';
  elsif exists (
    select 1
    from public.order_items oi
    join public.producers pr on pr.id = oi.producer_id
    join public.profiles p on p.id = pr.profile_id
    where oi.order_id = p_order_id and p.user_id = auth.uid()
  ) then
    v_actor := 'produtor';
  elsif exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.tipo = 'admin'
  ) then
    v_actor := 'admin';
  else
    raise exception 'Usuario sem permissao para cancelar este pedido.';
  end if;

  update public.orders
  set status = 'cancelado',
      cancelado_em = now(),
      cancelado_por = v_actor,
      motivo_cancelamento = coalesce(v_reason, 'Cancelado pelo usuario.')
  where id = p_order_id;

  return jsonb_build_object('actor', v_actor, 'canceledAt', now());
end;
$$;

create or replace function public.secure_complete_order(
  p_order_id uuid,
  p_delivery_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_receipt_code text;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido nao encontrado.';
  end if;

  if v_order.status <> 'em_entrega' then
    raise exception 'Somente pedidos em entrega podem ser concluidos.';
  end if;

  if not exists (
    select 1
    from public.order_items oi
    join public.producers pr on pr.id = oi.producer_id
    join public.profiles p on p.id = pr.profile_id
    where oi.order_id = p_order_id and p.user_id = auth.uid()
  ) then
    raise exception 'Apenas um produtor participante pode concluir o pedido.';
  end if;

  if v_order.codigo_entrega is null or btrim(p_delivery_code) <> v_order.codigo_entrega then
    raise exception 'Codigo de entrega incorreto.';
  end if;

  v_receipt_code := coalesce(
    v_order.codigo_recibo,
    'OC-' || lpad((floor(random() * 900000) + 100000)::int::text, 6, '0')
  );

  update public.orders
  set status = 'entregue', entregue_em = now(), codigo_recibo = v_receipt_code
  where id = p_order_id;

  return jsonb_build_object('receiptCode', v_receipt_code, 'deliveredAt', now());
end;
$$;

create or replace function public.secure_open_order_complaint(
  p_order_id uuid,
  p_complaint text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_text text := nullif(btrim(p_complaint), '');
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if v_text is null then
    raise exception 'Descreva o problema antes de enviar.';
  end if;

  if char_length(v_text) > 2000 then
    raise exception 'A reclamacao excede o limite de 2.000 caracteres.';
  end if;

  if not exists (
    select 1
    from public.orders o
    join public.buyers b on b.id = o.buyer_id
    join public.profiles p on p.id = b.profile_id
    where o.id = p_order_id and p.user_id = auth.uid()
  ) then
    raise exception 'Apenas o comprador do pedido pode abrir uma reclamacao.';
  end if;

  update public.orders
  set reclamacao_texto = v_text,
      reclamacao_status = 'aberta',
      reclamacao_criada_em = now()
  where id = p_order_id;

  return jsonb_build_object('createdAt', now());
end;
$$;

revoke all on function public.secure_confirm_order(uuid, timestamptz) from public;
revoke all on function public.secure_ship_order(uuid) from public;
revoke all on function public.secure_cancel_order(uuid, text) from public;
revoke all on function public.secure_complete_order(uuid, text) from public;
revoke all on function public.secure_open_order_complaint(uuid, text) from public;
grant execute on function public.secure_confirm_order(uuid, timestamptz) to authenticated;
grant execute on function public.secure_ship_order(uuid) to authenticated;
grant execute on function public.secure_cancel_order(uuid, text) to authenticated;
grant execute on function public.secure_complete_order(uuid, text) to authenticated;
grant execute on function public.secure_open_order_complaint(uuid, text) to authenticated;

-- Conversas passam a ser criadas apenas pela funcao atomica abaixo.
drop policy if exists "buyers can access conversations" on public.conversations;
drop policy if exists "producers can access conversations" on public.conversations;
drop policy if exists "admins can access conversations" on public.conversations;
drop policy if exists "participants read conversations" on public.conversations;

create policy "participants read conversations" on public.conversations
  for select to authenticated
  using (
    exists (
      select 1
      from public.buyers b
      join public.profiles p on p.id = b.profile_id
      where b.id = conversations.buyer_id and p.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.producers pr
      join public.profiles p on p.id = pr.profile_id
      where pr.id = conversations.producer_id and p.user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.tipo = 'admin'
    )
  );

create or replace function public.get_or_create_conversation(
  p_buyer_id uuid,
  p_producer_id uuid,
  p_order_id uuid default null,
  p_demand_id uuid default null,
  p_portfolio_product_id text default null,
  p_initial_message text default null
)
returns public.conversations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_conversation public.conversations%rowtype;
  v_context text;
begin
  select * into v_profile
  from public.profiles
  where user_id = auth.uid();

  if not found then
    raise exception 'Perfil autenticado nao encontrado.';
  end if;

  if num_nonnulls(p_order_id, p_demand_id, p_portfolio_product_id) <> 1 then
    raise exception 'Informe exatamente um contexto para a conversa.';
  end if;

  if not exists (select 1 from public.buyers where id = p_buyer_id and ativo) then
    raise exception 'Comprador invalido ou inativo.';
  end if;

  if not exists (select 1 from public.producers where id = p_producer_id and ativo) then
    raise exception 'Produtor invalido ou inativo.';
  end if;

  if v_profile.tipo = 'comprador' and not exists (
    select 1 from public.buyers where id = p_buyer_id and profile_id = v_profile.id
  ) then
    raise exception 'O comprador informado nao pertence ao usuario.';
  elsif v_profile.tipo = 'produtor' and not exists (
    select 1 from public.producers where id = p_producer_id and profile_id = v_profile.id
  ) then
    raise exception 'O produtor informado nao pertence ao usuario.';
  end if;

  if p_order_id is not null then
    v_context := 'order';
    if not exists (
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.id = p_order_id
        and o.buyer_id = p_buyer_id
        and oi.producer_id = p_producer_id
    ) then
      raise exception 'Comprador e produtor nao participam deste pedido.';
    end if;
  elsif p_demand_id is not null then
    v_context := 'demand';
    if not exists (
      select 1 from public.demand_requests d
      where d.id = p_demand_id and d.buyer_id = p_buyer_id
    ) then
      raise exception 'A demanda nao pertence ao comprador informado.';
    end if;

    if v_profile.tipo = 'comprador' and not exists (
      select 1 from public.demand_responses r
      where r.demand_id = p_demand_id and r.producer_id = p_producer_id
    ) then
      raise exception 'O produtor ainda nao respondeu a esta demanda.';
    end if;
  else
    v_context := 'portfolio';
    if v_profile.tipo <> 'comprador' and v_profile.tipo <> 'admin' then
      raise exception 'Apenas compradores podem iniciar conversas pelo portfolio.';
    end if;

    if not exists (
      select 1 from public.producer_inventory pi
      where pi.id::text = p_portfolio_product_id
        and pi.producer_id = p_producer_id
        and pi.ativo
        and pi.quantidade_disponivel > 0
    ) then
      raise exception 'O anuncio nao pertence ao produtor informado ou nao esta ativo.';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(':', v_context, coalesce(p_order_id::text, p_demand_id::text, p_portfolio_product_id), p_buyer_id, p_producer_id),
      0
    )
  );

  select * into v_conversation
  from public.conversations c
  where c.buyer_id = p_buyer_id
    and c.producer_id = p_producer_id
    and (
      (p_order_id is not null and c.order_id = p_order_id)
      or (p_demand_id is not null and c.demand_id = p_demand_id)
      or (p_portfolio_product_id is not null and c.portfolio_product_id = p_portfolio_product_id)
    )
  limit 1;

  if not found then
    insert into public.conversations (
      order_id, demand_id, portfolio_product_id, conversation_context, buyer_id, producer_id
    ) values (
      p_order_id, p_demand_id, p_portfolio_product_id, v_context, p_buyer_id, p_producer_id
    )
    returning * into v_conversation;

    if nullif(btrim(p_initial_message), '') is not null then
      if char_length(btrim(p_initial_message)) > 2000 then
        raise exception 'A mensagem inicial excede o limite de 2.000 caracteres.';
      end if;

      insert into public.messages (conversation_id, sender_id, message)
      values (v_conversation.id, v_profile.id, btrim(p_initial_message));
    end if;
  end if;

  return v_conversation;
end;
$$;

-- A leitura e marcada sem conceder edicao ampla sobre mensagens.
drop policy if exists "participants can update messages" on public.messages;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
  v_updated integer;
begin
  select id into v_profile_id
  from public.profiles
  where user_id = auth.uid();

  if v_profile_id is null then
    raise exception 'Perfil autenticado nao encontrado.';
  end if;

  if not exists (
    select 1
    from public.conversations c
    left join public.buyers b on b.id = c.buyer_id
    left join public.producers pr on pr.id = c.producer_id
    where c.id = p_conversation_id
      and (b.profile_id = v_profile_id or pr.profile_id = v_profile_id)
  ) then
    raise exception 'Usuario nao participa desta conversa.';
  end if;

  update public.messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and sender_id <> v_profile_id
    and read_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- Retorna a lista resumida sem transferir todo o historico para o navegador.
create or replace function public.list_user_conversations(p_profile_id uuid)
returns table (
  id uuid,
  order_id uuid,
  demand_id uuid,
  portfolio_product_id text,
  conversation_context text,
  buyer_id uuid,
  producer_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_message_at timestamptz,
  other_party_name text,
  last_message_text text,
  unread_count bigint,
  order_status text,
  demand_urgency text,
  order_total numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with caller as (
    select p.id, p.tipo
    from public.profiles p
    where p.id = p_profile_id
      and (
        p.user_id = auth.uid()
        or exists (
          select 1 from public.profiles admin_profile
          where admin_profile.user_id = auth.uid() and admin_profile.tipo = 'admin'
        )
      )
  )
  select
    c.id,
    c.order_id,
    c.demand_id,
    c.portfolio_product_id,
    c.conversation_context,
    c.buyer_id,
    c.producer_id,
    c.created_at,
    c.updated_at,
    c.last_message_at,
    case
      when caller.tipo = 'comprador' then coalesce(pr.nome_propriedade, pr.responsavel, 'Produtor')
      else coalesce(b.nome_empresa, buyer_profile.nome, 'Comprador')
    end as other_party_name,
    latest.message as last_message_text,
    coalesce(unread.total, 0) as unread_count,
    o.status::text as order_status,
    d.urgency as demand_urgency,
    o.total as order_total
  from caller
  join public.conversations c on (
    (caller.tipo = 'comprador' and exists (
      select 1 from public.buyers own_buyer
      where own_buyer.id = c.buyer_id and own_buyer.profile_id = caller.id
    ))
    or (caller.tipo = 'produtor' and exists (
      select 1 from public.producers own_producer
      where own_producer.id = c.producer_id and own_producer.profile_id = caller.id
    ))
    or caller.tipo = 'admin'
  )
  left join public.buyers b on b.id = c.buyer_id
  left join public.profiles buyer_profile on buyer_profile.id = b.profile_id
  left join public.producers pr on pr.id = c.producer_id
  left join public.orders o on o.id = c.order_id
  left join public.demand_requests d on d.id = c.demand_id
  left join lateral (
    select m.message
    from public.messages m
    where m.conversation_id = c.id and m.deleted_at is null
    order by m.created_at desc, m.id desc
    limit 1
  ) latest on true
  left join lateral (
    select count(*)::bigint as total
    from public.messages m
    where m.conversation_id = c.id
      and m.sender_id <> caller.id
      and m.read_at is null
      and m.deleted_at is null
  ) unread on true
  order by c.last_message_at desc;
$$;

revoke all on function public.get_or_create_conversation(uuid, uuid, uuid, uuid, text, text) from public;
revoke all on function public.mark_conversation_read(uuid) from public;
revoke all on function public.list_user_conversations(uuid) from public;
grant execute on function public.get_or_create_conversation(uuid, uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.list_user_conversations(uuid) to authenticated;
