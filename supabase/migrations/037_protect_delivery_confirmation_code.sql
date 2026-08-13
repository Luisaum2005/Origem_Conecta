-- Keep the buyer's delivery confirmation code out of producer-visible order rows.
-- Buyers retrieve it through a narrowly-scoped RPC; producers can only submit it.

alter table public.orders
  add column if not exists delivery_code_failed_attempts integer not null default 0,
  add column if not exists delivery_code_locked_until timestamptz;

alter table public.orders drop constraint if exists orders_delivery_code_attempts_nonnegative;
alter table public.orders add constraint orders_delivery_code_attempts_nonnegative
  check (delivery_code_failed_attempts >= 0);

create or replace function public.generate_order_delivery_code()
returns text
language sql
volatile
set search_path=public,pg_temp
as $$
  select lpad(
    ((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint % 1000000))::text,
    6,
    '0'
  );
$$;

revoke all on function public.generate_order_delivery_code() from public,anon,authenticated;

create or replace function public.assign_order_delivery_code()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  new.codigo_entrega:=public.generate_order_delivery_code();
  new.delivery_code_failed_attempts:=0;
  new.delivery_code_locked_until:=null;
  return new;
end;
$$;

revoke all on function public.assign_order_delivery_code() from public,anon,authenticated;

drop trigger if exists assign_secure_delivery_code on public.orders;
create trigger assign_secure_delivery_code
before insert on public.orders
for each row execute function public.assign_order_delivery_code();

-- Rotate legacy four-digit codes for orders that are still in progress.
update public.orders
set codigo_entrega=public.generate_order_delivery_code(),
    delivery_code_failed_attempts=0,
    delivery_code_locked_until=null
where status not in ('entregue','cancelado')
  and (codigo_entrega is null or codigo_entrega !~ '^[0-9]{6}$');

-- A table-level SELECT grant would expose every column allowed by RLS, including
-- codigo_entrega. Replace it with an explicit safe-column grant.
revoke select on public.orders from public,anon,authenticated;
grant select (
  id,buyer_id,buyer_name,status,subtotal,delivery,total,entrega_prevista,entrega_label,criado_em,
  origem_solicitacao_id,payment_method,payment_notes,origem_demanda_id,confirmado_em,saiu_entrega_em,
  entregue_em,cancelamento_limite_em,cancelado_em,cancelado_por,motivo_cancelamento,codigo_recibo,
  reclamacao_texto,reclamacao_status,reclamacao_criada_em
) on public.orders to authenticated;

create or replace function public.get_my_order_delivery_codes(p_order_ids uuid[])
returns table(order_id uuid,delivery_code text)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;
  if p_order_ids is null or cardinality(p_order_ids) not between 1 and 100 then
    raise exception 'Informe entre 1 e 100 pedidos.';
  end if;

  return query
  select o.id,o.codigo_entrega
  from public.orders o
  join public.buyers b on b.id=o.buyer_id
  join public.profiles p on p.id=b.profile_id
  where p.user_id=auth.uid()
    and o.id=any(p_order_ids);
end;
$$;

revoke all on function public.get_my_order_delivery_codes(uuid[]) from public,anon;
grant execute on function public.get_my_order_delivery_codes(uuid[]) to authenticated;

create or replace function public.secure_complete_order(p_order_id uuid,p_delivery_code text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_producer_id uuid;
  v_receipt text;
  v_all_delivered boolean;
  v_failed_attempts integer;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.status='cancelado' then raise exception 'Pedido nao pode ser concluido.'; end if;

  select pr.id into v_producer_id
  from public.producers pr
  join public.profiles p on p.id=pr.profile_id
  where p.user_id=auth.uid()
    and exists(
      select 1 from public.order_items oi
      where oi.order_id=p_order_id and oi.producer_id=pr.id
    );
  if v_producer_id is null then
    raise exception 'Apenas um produtor participante pode concluir seus itens.';
  end if;
  if exists(
    select 1 from public.order_items
    where order_id=p_order_id and producer_id=v_producer_id and producer_shipped_at is null
  ) then
    raise exception 'Seus itens precisam estar em entrega.';
  end if;

  if v_order.delivery_code_locked_until is not null
     and v_order.delivery_code_locked_until>now() then
    return jsonb_build_object(
      'success',false,
      'errorCode','delivery_code_locked',
      'lockedUntil',v_order.delivery_code_locked_until
    );
  end if;

  if v_order.codigo_entrega is null
     or btrim(coalesce(p_delivery_code,''))<>v_order.codigo_entrega then
    v_failed_attempts:=case
      when v_order.delivery_code_locked_until is not null
           and v_order.delivery_code_locked_until<=now() then 1
      else v_order.delivery_code_failed_attempts+1
    end;
    update public.orders
    set delivery_code_failed_attempts=v_failed_attempts,
        delivery_code_locked_until=case
          when v_failed_attempts>=5 then now()+interval '15 minutes'
          else null
        end
    where id=p_order_id;
    return jsonb_build_object(
      'success',false,
      'errorCode',case when v_failed_attempts>=5 then 'delivery_code_locked' else 'invalid_delivery_code' end,
      'attemptsRemaining',greatest(5-v_failed_attempts,0),
      'lockedUntil',case when v_failed_attempts>=5 then now()+interval '15 minutes' else null end
    );
  end if;

  update public.orders
  set delivery_code_failed_attempts=0,delivery_code_locked_until=null
  where id=p_order_id;

  update public.order_items
  set producer_delivered_at=coalesce(producer_delivered_at,now()),reserved_quantity=0
  where order_id=p_order_id and producer_id=v_producer_id;
  select not exists(
    select 1 from public.order_items
    where order_id=p_order_id and producer_delivered_at is null
  ) into v_all_delivered;
  v_receipt:=coalesce(v_order.codigo_recibo,'OC-'||lpad((floor(random()*900000)+100000)::int::text,6,'0'));
  update public.orders
  set status=case when v_all_delivered then 'entregue'::public.order_status else status end,
      entregue_em=case when v_all_delivered then now() else entregue_em end,
      codigo_recibo=case when v_all_delivered then v_receipt else codigo_recibo end
  where id=p_order_id;
  return jsonb_build_object(
    'success',true,
    'receiptCode',case when v_all_delivered then v_receipt else null end,
    'deliveredAt',now(),
    'orderCompleted',v_all_delivered,
    'producerCompleted',true
  );
end;
$$;

revoke all on function public.secure_complete_order(uuid,text) from public,anon;
grant execute on function public.secure_complete_order(uuid,text) to authenticated;
