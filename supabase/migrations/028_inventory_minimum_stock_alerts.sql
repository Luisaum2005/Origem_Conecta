-- Notify a producer once when an inventory item reaches its configured minimum.
-- The alert is rearmed after the quantity rises above the minimum again.
alter table public.producer_inventory
  add column if not exists estoque_minimo numeric(12,2) not null default 0,
  add column if not exists alerta_estoque_minimo_em timestamptz;

alter table public.producer_inventory
  drop constraint if exists producer_inventory_estoque_minimo_nonnegative;

alter table public.producer_inventory
  add constraint producer_inventory_estoque_minimo_nonnegative
  check (estoque_minimo >= 0);

create or replace function public.notify_producer_minimum_stock()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user_id uuid;
  v_alerted_at timestamptz;
  v_product_name text;
  v_unit text;
begin
  -- A zero minimum disables the feature. Restocking above the limit rearms it.
  if new.estoque_minimo <= 0 or new.quantidade_disponivel > new.estoque_minimo then
    new.alerta_estoque_minimo_em := null;
    return new;
  end if;

  -- Do not repeat the alert while this item remains at or below the limit.
  if tg_op = 'UPDATE' and old.alerta_estoque_minimo_em is not null then
    return new;
  end if;

  select p.user_id
    into v_user_id
  from public.producers pr
  join public.profiles p on p.id = pr.profile_id
  where pr.id = new.producer_id;

  if v_user_id is null then
    return new;
  end if;

  v_alerted_at := clock_timestamp();
  v_product_name := coalesce(nullif(btrim(new.nome_produto), ''), 'Produto');
  v_unit := coalesce(nullif(btrim(new.unidade), ''), 'unidade');
  new.alerta_estoque_minimo_em := v_alerted_at;

  perform public.create_system_notification(
    v_user_id,
    'system',
    'Estoque mínimo atingido',
    v_product_name || ': restam ' || trim(to_char(new.quantidade_disponivel, 'FM999999999990D99')) ||
      ' ' || v_unit || '. O mínimo definido é ' ||
      trim(to_char(new.estoque_minimo, 'FM999999999990D99')) || ' ' || v_unit || '.',
    jsonb_build_object(
      'url', '/production',
      'inventoryId', new.id,
      'quantity', new.quantidade_disponivel,
      'minimumStock', new.estoque_minimo
    ),
    'stock:minimum:' || new.id || ':' || extract(epoch from v_alerted_at)::text
  );

  return new;
end;
$$;

drop trigger if exists notifications_before_inventory_minimum on public.producer_inventory;
create trigger notifications_before_inventory_minimum
before insert or update of quantidade_disponivel, estoque_minimo
on public.producer_inventory
for each row
execute function public.notify_producer_minimum_stock();

revoke all on function public.notify_producer_minimum_stock() from public, anon, authenticated;
