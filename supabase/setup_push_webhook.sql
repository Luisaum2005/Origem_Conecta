-- Execute this file once in the Supabase SQL Editor after replacing the three placeholders.
-- It replaces the Dashboard-created Database Webhook with versioned, reproducible SQL.
-- IMPORTANT: delete/disable the existing notifications INSERT webhook in the Dashboard first,
-- otherwise every notification can produce two push attempts.

create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push-notification',
  'push_function_url',
  'Origem Conecta push Edge Function URL'
)
where not exists (select 1 from vault.decrypted_secrets where name='push_function_url');

select vault.create_secret(
  'REPLACE_WITH_THE_SAME_PUSH_WEBHOOK_SECRET_USED_BY_THE_EDGE_FUNCTION',
  'push_webhook_secret',
  'Shared secret used only by the database webhook'
)
where not exists (select 1 from vault.decrypted_secrets where name='push_webhook_secret');

create or replace function public.dispatch_push_notification()
returns trigger language plpgsql security definer set search_path=public,extensions,vault,pg_temp as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name='push_function_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='push_webhook_secret' limit 1;
  if nullif(v_url,'') is null or nullif(v_secret,'') is null then
    raise warning 'Push webhook secrets are not configured; notification % remains internal.',new.id;
    return new;
  end if;
  perform net.http_post(
    url:=v_url,
    headers:=jsonb_build_object('content-type','application/json','x-push-webhook-secret',v_secret),
    body:=jsonb_build_object('notificationId',new.id,'record',to_jsonb(new)),
    timeout_milliseconds:=5000
  );
  return new;
exception when others then
  raise warning 'Could not enqueue push for notification %: %',new.id,sqlerrm;
  return new;
end $$;

revoke all on function public.dispatch_push_notification() from public,anon,authenticated;
drop trigger if exists dispatch_notification_push on public.notifications;
create trigger dispatch_notification_push after insert on public.notifications
  for each row execute function public.dispatch_push_notification();

