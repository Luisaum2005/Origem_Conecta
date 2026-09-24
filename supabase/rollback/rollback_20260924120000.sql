-- Desfaz 20260924120000_decline_demand_response.sql
drop function if exists public.secure_decline_demand_response(uuid);

create or replace function public.notify_demand_response_status() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; label text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select p.user_id into recipient from public.producers pr join public.profiles p on p.id=pr.profile_id where pr.id=new.producer_id;
  label := case when new.status='aprovada' then 'Proposta aceita' else 'Proposta atualizada' end;
  if recipient is not null and recipient <> auth.uid() then perform public.create_system_notification(recipient,'demand',label,'A situação da sua resposta foi atualizada.',jsonb_build_object('url','/demands','demandId',new.demand_id),'demand:response-status:'||new.id||':'||new.status); end if;
  return new;
end; $$;
