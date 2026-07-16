-- Sprint 4: persistent in-app notifications and Web Push subscriptions.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('message','order','demand','rating','system')),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  read_at timestamptz,
  push_status text not null default 'pending' check (push_status in ('pending','sent','partial','failed','skipped')),
  push_attempted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  is_active boolean not null default true,
  failure_count integer not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  messages boolean not null default true,
  orders boolean not null default true,
  demands boolean not null default true,
  ratings boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;

create policy "users read own notifications" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "users manage own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own notification preferences" on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());
create policy "users insert own notification preferences" on public.notification_preferences for insert to authenticated
  with check (user_id = auth.uid());
create policy "users update own notification preferences" on public.notification_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = coalesce(read_at, now())
  where id = p_notification_id and user_id = auth.uid();
$$;
create or replace function public.mark_all_notifications_read()
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = coalesce(read_at, now())
  where user_id = auth.uid() and read_at is null;
$$;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

create or replace function public.create_system_notification(
  p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb, p_key text
) returns uuid language plpgsql security definer set search_path = public as $$
declare result uuid;
begin
  insert into public.notifications(user_id,type,title,body,data,idempotency_key)
  values (p_user_id,p_type,p_title,left(p_body,240),coalesce(p_data,'{}'::jsonb),p_key)
  on conflict (user_id,idempotency_key) do nothing returning id into result;
  return result;
end;
$$;
revoke all on function public.create_system_notification(uuid,text,text,text,jsonb,text) from public, anon, authenticated;

create or replace function public.notify_new_message() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; sender_name text;
begin
  select p.user_id into recipient
  from public.conversations c
  join public.buyers b on b.id = c.buyer_id
  join public.producers pr on pr.id = c.producer_id
  join public.profiles p on p.id = case when new.sender_id = b.profile_id then pr.profile_id else b.profile_id end
  where c.id = new.conversation_id;
  select nome into sender_name from public.profiles where id = new.sender_id;
  if recipient is not null and recipient <> auth.uid() then
    perform public.create_system_notification(recipient,'message',coalesce(sender_name,'Nova mensagem'),new.message,
      jsonb_build_object('url','/chat?id='||new.conversation_id,'conversationId',new.conversation_id),'message:'||new.id);
  end if;
  return new;
end; $$;
create trigger notifications_after_message after insert on public.messages for each row execute function public.notify_new_message();

create or replace function public.notify_new_order_item() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid;
begin
  select p.user_id into recipient from public.producers pr join public.profiles p on p.id=pr.profile_id where pr.id=new.producer_id;
  if recipient is not null and recipient <> auth.uid() then
    perform public.create_system_notification(recipient,'order','Novo pedido recebido','Um novo pedido inclui produtos da sua propriedade.',
      jsonb_build_object('url','/producer/orders','orderId',new.order_id),'order:new:'||new.order_id||':'||new.producer_id);
  end if;
  return new;
end; $$;
create trigger notifications_after_order_item after insert on public.order_items for each row execute function public.notify_new_order_item();

create or replace function public.notify_order_status() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; producer_recipient uuid; label text;
begin
  if new.status is not distinct from old.status then return new; end if;
  label := case new.status when 'em_separacao' then 'Pedido confirmado' when 'em_entrega' then 'Pedido saiu para entrega' when 'entregue' then 'Pedido entregue' when 'cancelado' then 'Pedido cancelado' else 'Pedido atualizado' end;
  select p.user_id into recipient from public.buyers b join public.profiles p on p.id=b.profile_id where b.id=new.buyer_id;
  if recipient is not null and recipient <> auth.uid() then perform public.create_system_notification(recipient,'order',label,'O status do seu pedido foi atualizado.',jsonb_build_object('url','/orders','orderId',new.id),'order:status:'||new.id||':'||new.status); end if;
  for producer_recipient in select distinct p.user_id from public.order_items oi join public.producers pr on pr.id=oi.producer_id join public.profiles p on p.id=pr.profile_id where oi.order_id=new.id loop
    if producer_recipient <> auth.uid() then perform public.create_system_notification(producer_recipient,'order',label,'O status de um pedido foi atualizado.',jsonb_build_object('url','/producer/orders','orderId',new.id),'order:status:'||new.id||':'||new.status); end if;
  end loop;
  return new;
end; $$;
create trigger notifications_after_order_status after update of status on public.orders for each row execute function public.notify_order_status();

create or replace function public.notify_demand_response() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid;
begin
  select p.user_id into recipient from public.demand_requests d join public.buyers b on b.id=d.buyer_id join public.profiles p on p.id=b.profile_id where d.id=new.demand_id;
  if recipient is not null and recipient <> auth.uid() then perform public.create_system_notification(recipient,'demand','Nova resposta à demanda',new.producer_name||' respondeu à sua demanda.',jsonb_build_object('url','/demands','demandId',new.demand_id),'demand:response:'||new.id); end if;
  return new;
end; $$;
create trigger notifications_after_demand_response after insert on public.demand_responses for each row execute function public.notify_demand_response();

create or replace function public.notify_demand_response_status() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; label text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select p.user_id into recipient from public.producers pr join public.profiles p on p.id=pr.profile_id where pr.id=new.producer_id;
  label := case when new.status='aprovada' then 'Proposta aceita' else 'Proposta atualizada' end;
  if recipient is not null and recipient <> auth.uid() then perform public.create_system_notification(recipient,'demand',label,'A situação da sua resposta foi atualizada.',jsonb_build_object('url','/demands','demandId',new.demand_id),'demand:response-status:'||new.id||':'||new.status); end if;
  return new;
end; $$;
create trigger notifications_after_demand_response_status after update of status on public.demand_responses for each row execute function public.notify_demand_response_status();

-- A new demand is only sent to producers with a matching active inventory item or
-- an explicitly configured served category/product. The idempotency key avoids one
-- notification per demand item.
create or replace function public.notify_eligible_producers_for_demand() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient record;
begin
  for recipient in
    select distinct p.user_id, pr.id as producer_id
    from public.producers pr
    join public.profiles p on p.id=pr.profile_id
    where pr.ativo and (
      exists (select 1 from public.producer_inventory pi where pi.producer_id=pr.id and pi.ativo and lower(coalesce(pi.nome_produto,''))=lower(new.product_name))
      or exists (select 1 from unnest(pr.categorias_atendidas) category where lower(category)=lower(new.product_name))
    )
  loop
    if recipient.user_id <> auth.uid() then
      perform public.create_system_notification(recipient.user_id,'demand','Nova demanda compatível','Há uma nova demanda para '||new.product_name||'.',jsonb_build_object('url','/demands','demandId',new.demand_id),'demand:new:'||new.demand_id||':'||recipient.producer_id);
    end if;
  end loop;
  return new;
end; $$;
create trigger notifications_after_demand_item after insert on public.demand_items for each row execute function public.notify_eligible_producers_for_demand();

create or replace function public.notify_buyer_rating() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid;
begin
  select p.user_id into recipient from public.buyers b join public.profiles p on p.id=b.profile_id where b.id=new.buyer_id;
  if recipient is not null and recipient <> auth.uid() then perform public.create_system_notification(recipient,'rating','Nova avaliação recebida','Você recebeu uma avaliação de '||new.rating||' estrelas.',jsonb_build_object('url','/profile/buyer','ratingId',new.id),'rating:'||new.id); end if;
  return new;
end; $$;
create trigger notifications_after_buyer_rating after insert on public.buyer_ratings for each row execute function public.notify_buyer_rating();

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
