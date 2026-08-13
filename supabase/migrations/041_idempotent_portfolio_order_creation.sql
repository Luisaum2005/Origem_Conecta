-- A browser retry must never reserve stock and create a second order. The
-- request key is scoped to the buyer and stored in the same transaction as the
-- order itself.

create table if not exists public.order_creation_requests (
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  idempotency_key uuid not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (buyer_id,idempotency_key),
  unique (order_id)
);

alter table public.order_creation_requests enable row level security;

-- Keep the previous, fully validated write implementation as an internal
-- function. It remains callable only by the wrapper below.
do $$
begin
  -- The migration was applied through the SQL Editor in production. Keeping
  -- this conditional makes a future CLI migration sync safe as well.
  if to_regprocedure('public.secure_create_portfolio_order_once(jsonb,jsonb)') is null then
    alter function public.secure_create_portfolio_order(jsonb,jsonb)
      rename to secure_create_portfolio_order_once;
  end if;
end;
$$;

create or replace function public.secure_create_portfolio_order(p_order jsonb,p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_buyer public.buyers%rowtype;
  v_existing public.order_creation_requests%rowtype;
  v_result jsonb;
  v_request_key uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if nullif(btrim(p_order->>'idempotencyKey'),'') is null then
    -- Older deployed clients did not send a request key. Keep their order
    -- creation flow working while newer clients receive idempotency below.
    return public.secure_create_portfolio_order_once(p_order,p_items);
  end if;

  begin
    v_request_key:=btrim(p_order->>'idempotencyKey')::uuid;
  exception when others then
    raise exception 'Chave de idempotencia invalida.';
  end;

  -- This lock serializes requests from the same buyer. Once a concurrent
  -- request releases it, its idempotency record is visible to this transaction.
  select b.* into v_buyer
  from public.buyers b
  join public.profiles p on p.id=b.profile_id
  where p.user_id=auth.uid() and b.ativo
  for update;
  if not found then
    raise exception 'Cadastro de comprador nao encontrado.';
  end if;

  select * into v_existing
  from public.order_creation_requests
  where buyer_id=v_buyer.id and idempotency_key=v_request_key;
  if found then
    select jsonb_build_object('id',o.id,'createdAt',o.criado_em)
      into v_result
    from public.orders o
    where o.id=v_existing.order_id;
    if v_result is null then
      raise exception 'Registro de idempotencia sem pedido correspondente.';
    end if;
    return v_result;
  end if;

  v_result:=public.secure_create_portfolio_order_once(
    p_order - 'idempotencyKey',p_items
  );
  if nullif(v_result->>'id','') is null then
    raise exception 'O pedido nao foi criado.';
  end if;

  insert into public.order_creation_requests(buyer_id,idempotency_key,order_id)
  values(v_buyer.id,v_request_key,(v_result->>'id')::uuid);

  return v_result;
end;
$$;

revoke all on function public.secure_create_portfolio_order(jsonb,jsonb) from public,anon;
revoke all on function public.secure_create_portfolio_order_once(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.secure_create_portfolio_order(jsonb,jsonb) to authenticated;
