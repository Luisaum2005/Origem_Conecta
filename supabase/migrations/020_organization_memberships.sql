-- Sprint 2: producer memberships, invitations and commercial authorization.
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  producer_id uuid not null references public.producers(id) on delete cascade,
  status text not null check (status in ('invited','pending','active','rejected','inactive')),
  requested_by uuid not null references public.profiles(id),
  member_number text,
  can_sell_through_organization boolean not null default false,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, producer_id)
);
create index organization_members_org_status_idx on public.organization_members(organization_id,status);
create index organization_members_producer_status_idx on public.organization_members(producer_id,status);
alter table public.organization_members enable row level security;

-- If the organization creator also has a producer profile, link both contexts
-- automatically without requiring another account or a manual request.
insert into public.organization_members(organization_id,producer_id,status,requested_by,can_sell_through_organization,reviewed_by,reviewed_at,joined_at)
select o.id,pr.id,'active',o.created_by,true,o.created_by,now(),now()
from public.organizations o join public.producers pr on pr.profile_id=o.created_by
where pr.ativo
on conflict(organization_id,producer_id) do nothing;

create or replace function public.link_organization_creator_as_member()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_producer uuid;
begin
  select id into v_producer from public.producers where profile_id=new.created_by and ativo;
  if v_producer is not null then
    insert into public.organization_members(organization_id,producer_id,status,requested_by,can_sell_through_organization,reviewed_by,reviewed_at,joined_at)
    values(new.id,v_producer,'active',new.created_by,true,new.created_by,now(),now())
    on conflict(organization_id,producer_id) do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists link_creator_membership on public.organizations;
create trigger link_creator_membership after insert on public.organizations for each row execute function public.link_organization_creator_as_member();

create or replace function public.can_manage_organization(p_organization_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.organization_users ou
    join public.profiles p on p.id=ou.profile_id
    where ou.organization_id=p_organization_id and p.user_id=auth.uid()
      and ou.status='active' and ou.role in ('owner','administrator')
  );
$$;
revoke all on function public.can_manage_organization(uuid) from public;
grant execute on function public.can_manage_organization(uuid) to authenticated;

create policy "memberships visible to producer and managers" on public.organization_members for select to authenticated
using (
  public.can_manage_organization(organization_id)
  or producer_id in (select pr.id from public.producers pr join public.profiles p on p.id=pr.profile_id where p.user_id=auth.uid())
);

create or replace function public.search_active_organizations(p_query text default '')
returns table(id uuid,type text,trade_name text,legal_name text,cnpj text,city text,state text,verification_status text)
language sql stable security definer set search_path=public as $$
  select o.id,o.type,o.trade_name,o.legal_name,o.cnpj,o.city,o.state,o.verification_status
  from public.organizations o
  where o.status='active' and (
    coalesce(trim(p_query),'')=''
    or o.trade_name ilike '%'||trim(p_query)||'%'
    or o.legal_name ilike '%'||trim(p_query)||'%'
    or (
      nullif(regexp_replace(p_query,'\D','','g'),'') is not null
      and o.cnpj like '%'||regexp_replace(p_query,'\D','','g')||'%'
    )
  )
  order by o.trade_name limit 30;
$$;
revoke all on function public.search_active_organizations(text) from public;
grant execute on function public.search_active_organizations(text) to authenticated;

create or replace function public.request_organization_membership(p_organization_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile uuid; v_producer uuid; v_member uuid; v_status text; v_org_name text; manager_user uuid;
begin
  select p.id,pr.id into v_profile,v_producer from public.profiles p join public.producers pr on pr.profile_id=p.id where p.user_id=auth.uid() and pr.ativo;
  if v_producer is null then raise exception 'Cadastro de produtor ativo não encontrado.'; end if;
  select trade_name into v_org_name from public.organizations where id=p_organization_id and status='active';
  if v_org_name is null then raise exception 'Organização não encontrada ou inativa.'; end if;
  insert into public.organization_members(organization_id,producer_id,status,requested_by)
  values(p_organization_id,v_producer,'pending',v_profile)
  on conflict(organization_id,producer_id) do update set status=case when organization_members.status='active' then 'active' else 'pending' end, requested_by=v_profile,updated_at=now()
  returning id,status into v_member,v_status;
  if v_status='active' then raise exception 'Você já possui vínculo ativo com esta organização.'; end if;
  for manager_user in select p.user_id from public.organization_users ou join public.profiles p on p.id=ou.profile_id where ou.organization_id=p_organization_id and ou.status='active' and ou.role in ('owner','administrator') loop
    perform public.create_system_notification(manager_user,'system','Nova solicitação de associado','Um produtor solicitou vínculo com '||v_org_name||'.',jsonb_build_object('url','/organizations','membershipId',v_member),'membership:request:'||v_member||':'||extract(epoch from now())::bigint);
  end loop;
  return v_member;
end; $$;

create or replace function public.invite_producer_to_organization(p_organization_id uuid,p_email text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_manager uuid; v_producer uuid; v_profile uuid; v_user uuid; v_member uuid; v_status text; v_org_name text;
begin
  if not public.can_manage_organization(p_organization_id) then raise exception 'Sem permissão para convidar associados.'; end if;
  select id into v_manager from public.profiles where user_id=auth.uid();
  select pr.id,p.id,p.user_id into v_producer,v_profile,v_user from public.profiles p join public.producers pr on pr.profile_id=p.id where lower(p.email)=lower(trim(p_email)) and pr.ativo;
  if v_producer is null then raise exception 'Nenhum produtor ativo foi encontrado com este e-mail.'; end if;
  select trade_name into v_org_name from public.organizations where id=p_organization_id and status='active';
  insert into public.organization_members(organization_id,producer_id,status,requested_by)
  values(p_organization_id,v_producer,'invited',v_manager)
  on conflict(organization_id,producer_id) do update set status=case when organization_members.status='active' then 'active' else 'invited' end,requested_by=v_manager,updated_at=now()
  returning id,status into v_member,v_status;
  if v_status='active' then raise exception 'Este produtor já faz parte da organização.'; end if;
  perform public.create_system_notification(v_user,'system','Convite para organização',v_org_name||' convidou você para fazer parte da organização.',jsonb_build_object('url','/profile/producer','membershipId',v_member),'membership:invite:'||v_member||':'||extract(epoch from now())::bigint);
  return v_member;
end; $$;

create or replace function public.review_membership_request(p_membership_id uuid,p_accept boolean,p_member_number text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_member public.organization_members%rowtype; v_user uuid; v_org_name text;
begin
  select * into v_member from public.organization_members where id=p_membership_id for update;
  if not found or not public.can_manage_organization(v_member.organization_id) then raise exception 'Solicitação não encontrada ou sem permissão.'; end if;
  if v_member.status <> 'pending' then raise exception 'Esta solicitação não está pendente.'; end if;
  update public.organization_members set status=case when p_accept then 'active' else 'rejected' end,member_number=nullif(trim(p_member_number),''),reviewed_by=(select id from public.profiles where user_id=auth.uid()),reviewed_at=now(),joined_at=case when p_accept then now() else null end,updated_at=now() where id=p_membership_id;
  select p.user_id into v_user from public.producers pr join public.profiles p on p.id=pr.profile_id where pr.id=v_member.producer_id;
  select trade_name into v_org_name from public.organizations where id=v_member.organization_id;
  perform public.create_system_notification(v_user,'system',case when p_accept then 'Vínculo aprovado' else 'Vínculo não aprovado' end,case when p_accept then 'Você agora faz parte de '||v_org_name||'.' else 'Sua solicitação para '||v_org_name||' não foi aprovada.' end,jsonb_build_object('url','/profile/producer','membershipId',p_membership_id),'membership:review:'||p_membership_id||':'||p_accept);
end; $$;

create or replace function public.respond_membership_invite(p_membership_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_member public.organization_members%rowtype; manager_user uuid; v_org_name text;
begin
  select om.* into v_member from public.organization_members om join public.producers pr on pr.id=om.producer_id join public.profiles p on p.id=pr.profile_id where om.id=p_membership_id and p.user_id=auth.uid() for update;
  if not found or v_member.status <> 'invited' then raise exception 'Convite não encontrado ou já respondido.'; end if;
  update public.organization_members set status=case when p_accept then 'active' else 'rejected' end,reviewed_by=(select id from public.profiles where user_id=auth.uid()),reviewed_at=now(),joined_at=case when p_accept then now() else null end,updated_at=now() where id=p_membership_id;
  select trade_name into v_org_name from public.organizations where id=v_member.organization_id;
  for manager_user in select p.user_id from public.organization_users ou join public.profiles p on p.id=ou.profile_id where ou.organization_id=v_member.organization_id and ou.status='active' and ou.role in ('owner','administrator') loop
    perform public.create_system_notification(manager_user,'system',case when p_accept then 'Convite aceito' else 'Convite recusado' end,'O produtor '||case when p_accept then 'aceitou' else 'recusou' end||' o convite de '||v_org_name||'.',jsonb_build_object('url','/organizations','membershipId',p_membership_id),'membership:invite-response:'||p_membership_id||':'||p_accept);
  end loop;
end; $$;

create or replace function public.set_member_commercial_permission(p_membership_id uuid,p_allowed boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.organization_members where id=p_membership_id and status='active';
  if v_org is null or not public.can_manage_organization(v_org) then raise exception 'Associado ativo não encontrado ou sem permissão.'; end if;
  update public.organization_members set can_sell_through_organization=p_allowed,updated_at=now() where id=p_membership_id;
end; $$;

create or replace function public.deactivate_organization_membership(p_membership_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_member public.organization_members%rowtype; v_own boolean;
begin
  select * into v_member from public.organization_members where id=p_membership_id and status='active' for update;
  if not found then raise exception 'Vínculo ativo não encontrado.'; end if;
  select exists(select 1 from public.producers pr join public.profiles p on p.id=pr.profile_id where pr.id=v_member.producer_id and p.user_id=auth.uid()) into v_own;
  if not v_own and not public.can_manage_organization(v_member.organization_id) then raise exception 'Sem permissão para encerrar este vínculo.'; end if;
  update public.organization_members set status='inactive',can_sell_through_organization=false,updated_at=now() where id=p_membership_id;
end; $$;

revoke all on function public.request_organization_membership(uuid) from public;
revoke all on function public.invite_producer_to_organization(uuid,text) from public;
revoke all on function public.review_membership_request(uuid,boolean,text) from public;
revoke all on function public.respond_membership_invite(uuid,boolean) from public;
revoke all on function public.set_member_commercial_permission(uuid,boolean) from public;
revoke all on function public.deactivate_organization_membership(uuid) from public;
grant execute on function public.request_organization_membership(uuid) to authenticated;
grant execute on function public.invite_producer_to_organization(uuid,text) to authenticated;
grant execute on function public.review_membership_request(uuid,boolean,text) to authenticated;
grant execute on function public.respond_membership_invite(uuid,boolean) to authenticated;
grant execute on function public.set_member_commercial_permission(uuid,boolean) to authenticated;
grant execute on function public.deactivate_organization_membership(uuid) to authenticated;
