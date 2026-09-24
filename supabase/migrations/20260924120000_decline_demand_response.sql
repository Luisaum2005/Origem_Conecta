-- O comprador pode recusar uma proposta recebida numa demanda.
-- Antes só existia o aceite (secure_accept_demand_response), e recusar
-- ficava apenas na tela do comprador, sem avisar o produtor.

create or replace function public.secure_decline_demand_response(p_response_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_response public.demand_responses%rowtype; v_demand public.demand_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;
  select r.* into v_response from public.demand_responses r where r.id=p_response_id for update;
  if not found or v_response.status<>'enviada' then raise exception 'Esta proposta nao pode mais ser recusada.'; end if;
  select d.* into v_demand from public.demand_requests d where d.id=v_response.demand_id for update;
  if not exists(select 1 from public.buyers b join public.profiles p on p.id=b.profile_id
    where b.id=v_demand.buyer_id and p.user_id=auth.uid()) then
    raise exception 'Somente o comprador da demanda pode recusar a proposta.';
  end if;
  if v_demand.status not in ('aberta','respondida') then raise exception 'Esta demanda ja foi encerrada.'; end if;

  update public.demand_responses set status='recusada' where id=p_response_id;
  -- Sem outra proposta pendente, a demanda volta a aceitar respostas.
  if not exists(select 1 from public.demand_responses where demand_id=v_demand.id and status='enviada') then
    update public.demand_requests set status='aberta' where id=v_demand.id;
  end if;
end $$;

revoke all on function public.secure_decline_demand_response(uuid) from public,anon;
grant execute on function public.secure_decline_demand_response(uuid) to authenticated;

-- Aviso ao produtor com o texto certo para cada desfecho.
create or replace function public.notify_demand_response_status() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; label text; body text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select p.user_id into recipient from public.producers pr join public.profiles p on p.id=pr.profile_id where pr.id=new.producer_id;
  label := case new.status when 'aprovada' then 'Proposta aceita' when 'recusada' then 'Proposta recusada' else 'Proposta atualizada' end;
  body := case new.status
    when 'aprovada' then 'O comprador aceitou sua proposta e o pedido foi criado.'
    when 'recusada' then 'O comprador recusou sua proposta para esta demanda.'
    else 'A situação da sua resposta foi atualizada.' end;
  if recipient is not null and recipient <> auth.uid() then
    perform public.create_system_notification(recipient,'demand',label,body,
      jsonb_build_object('url','/demands','demandId',new.demand_id),
      'demand:response-status:'||new.id||':'||new.status);
  end if;
  return new;
end; $$;
