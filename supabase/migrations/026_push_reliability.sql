-- Reconcile browser subscriptions safely and persist push diagnostics.
alter table public.notifications
  add column if not exists push_attempt_count integer not null default 0,
  add column if not exists push_last_error text;

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;
  if nullif(btrim(p_endpoint),'') is null or nullif(btrim(p_p256dh),'') is null
     or nullif(btrim(p_auth),'') is null then
    raise exception 'Inscricao push incompleta.';
  end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,user_agent,is_active,failure_count,updated_at)
  values(auth.uid(),p_endpoint,p_p256dh,p_auth,p_user_agent,true,0,now())
  on conflict(endpoint) do update set
    user_id=auth.uid(),p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,
    is_active=true,failure_count=0,updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.register_push_subscription(text,text,text,text) from public;
grant execute on function public.register_push_subscription(text,text,text,text) to authenticated;
