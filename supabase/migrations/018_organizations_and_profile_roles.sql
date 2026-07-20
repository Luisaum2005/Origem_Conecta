-- Sprint 1: cooperatives/associations, managers and multiple roles per account.
alter type public.profile_type add value if not exists 'organizacao';

create table public.profile_roles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('comprador','produtor','gestor_organizacao','admin')),
  created_at timestamptz not null default now(),
  primary key (profile_id, role)
);

insert into public.profile_roles(profile_id, role)
select id, case when tipo::text='organizacao' then 'gestor_organizacao' else tipo::text end
from public.profiles
on conflict do nothing;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('cooperativa','associacao')),
  legal_name text not null,
  trade_name text not null,
  cnpj text not null,
  state_registration text,
  email text not null,
  phone text not null,
  address_line text not null,
  address_number text,
  address_complement text,
  neighborhood text,
  city text not null,
  state text not null check (char_length(state)=2),
  postal_code text not null,
  responsible_name text not null,
  responsible_role text not null,
  status text not null default 'pending' check (status in ('pending','active','rejected','suspended')),
  created_by uuid not null references public.profiles(id),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_cnpj_digits check (cnpj ~ '^[0-9]{14}$')
);
create unique index organizations_cnpj_unique on public.organizations(cnpj);
create index organizations_status_idx on public.organizations(status, created_at desc);

create table public.organization_users (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','administrator','commercial','viewer')),
  status text not null default 'active' check (status in ('invited','active','inactive')),
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

alter table public.profile_roles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_users enable row level security;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where user_id=auth.uid() and tipo='admin');
$$;
revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

create policy "users read own roles" on public.profile_roles for select to authenticated
  using (profile_id in (select id from public.profiles where user_id=auth.uid()) or public.is_platform_admin());
create policy "users add own initial roles" on public.profile_roles for insert to authenticated
  with check (
    profile_id in (select id from public.profiles where user_id=auth.uid())
    and (
      (role <> 'admin' and role = (select case when tipo::text='organizacao' then 'gestor_organizacao' else tipo::text end from public.profiles where id=profile_id))
      or (role='gestor_organizacao' and exists(select 1 from public.organizations where created_by=profile_id))
    )
  );

create or replace function public.has_organization_access(p_organization_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.organization_users ou join public.profiles p on p.id=ou.profile_id where ou.organization_id=p_organization_id and p.user_id=auth.uid() and ou.status='active');
$$;
revoke all on function public.has_organization_access(uuid) from public;
grant execute on function public.has_organization_access(uuid) to authenticated;

create policy "organization managers and admins read organizations" on public.organizations for select to authenticated
  using (public.is_platform_admin() or created_by in (select id from public.profiles where user_id=auth.uid()) or public.has_organization_access(id));
create policy "users create organizations" on public.organizations for insert to authenticated
  with check (created_by in (select id from public.profiles where user_id=auth.uid()) and status='pending');
create policy "managers update pending organization" on public.organizations for update to authenticated
  using (status='pending' and created_by in (select id from public.profiles where user_id=auth.uid()))
  with check (status='pending' and created_by in (select id from public.profiles where user_id=auth.uid()));

create or replace function public.prevent_profile_type_change() returns trigger language plpgsql set search_path=public as $$
begin
  if new.tipo is distinct from old.tipo and not public.is_platform_admin() then
    raise exception 'O tipo principal do perfil não pode ser alterado diretamente.';
  end if;
  return new;
end; $$;
drop trigger if exists protect_profile_type on public.profiles;
create trigger protect_profile_type before update of tipo on public.profiles for each row execute function public.prevent_profile_type_change();

create or replace function public.prevent_unauthorized_admin_profile() returns trigger language plpgsql set search_path=public as $$
begin
  if new.tipo::text='admin' and not public.is_platform_admin() then
    raise exception 'Perfis administrativos só podem ser criados por um administrador.';
  end if;
  return new;
end; $$;
drop trigger if exists protect_admin_profile_creation on public.profiles;
create trigger protect_admin_profile_creation before insert on public.profiles for each row execute function public.prevent_unauthorized_admin_profile();

create policy "organization users read own team" on public.organization_users for select to authenticated
  using (public.is_platform_admin() or public.has_organization_access(organization_id));
create policy "creator adds self as owner" on public.organization_users for insert to authenticated
  with check (profile_id in (select id from public.profiles where user_id=auth.uid()) and role='owner' and exists(select 1 from public.organizations o where o.id=organization_id and o.created_by=profile_id));

create or replace function public.review_organization(p_organization_id uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
declare reviewer uuid;
begin
  if not public.is_platform_admin() then raise exception 'Apenas administradores podem revisar organizações.'; end if;
  if p_status not in ('active','rejected','suspended') then raise exception 'Status de revisão inválido.'; end if;
  select id into reviewer from public.profiles where user_id=auth.uid();
  update public.organizations set status=p_status, rejection_reason=case when p_status='rejected' then nullif(trim(p_reason),'') else null end,
    verified_by=reviewer, verified_at=case when p_status='active' then now() else verified_at end, updated_at=now()
  where id=p_organization_id;
  if not found then raise exception 'Organização não encontrada.'; end if;
end; $$;
revoke all on function public.review_organization(uuid,text,text) from public;
grant execute on function public.review_organization(uuid,text,text) to authenticated;
