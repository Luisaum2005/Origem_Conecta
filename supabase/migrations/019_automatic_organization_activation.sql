-- Organizations are activated automatically. Identity verification is a separate,
-- server-controlled state that can later be updated by an external CNPJ provider.
alter table public.organizations
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','failed')),
  add column if not exists verification_source text,
  add column if not exists verification_checked_at timestamptz;

alter table public.organizations alter column status set default 'active';
update public.organizations set status='active', updated_at=now() where status='pending';

create or replace function public.is_valid_cnpj(value text)
returns boolean language plpgsql immutable strict as $$
declare
  digits text := regexp_replace(value, '\D', '', 'g');
  weights1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  weights2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  total int := 0; check1 int; check2 int; i int;
begin
  if length(digits) <> 14 or digits ~ '^(\d)\1{13}$' then return false; end if;
  for i in 1..12 loop total := total + substring(digits,i,1)::int * weights1[i]; end loop;
  check1 := case when total % 11 < 2 then 0 else 11 - total % 11 end;
  total := 0;
  for i in 1..13 loop total := total + substring(digits,i,1)::int * weights2[i]; end loop;
  check2 := case when total % 11 < 2 then 0 else 11 - total % 11 end;
  return substring(digits,13,1)::int=check1 and substring(digits,14,1)::int=check2;
end; $$;

alter table public.organizations drop constraint if exists organizations_valid_cnpj;
alter table public.organizations add constraint organizations_valid_cnpj
  check (public.is_valid_cnpj(cnpj)) not valid;

drop policy if exists "users create organizations" on public.organizations;
create policy "users create active unverified organizations" on public.organizations for insert to authenticated
  with check (
    created_by in (select id from public.profiles where user_id=auth.uid())
    and status='active'
    and verification_status='unverified'
  );

drop policy if exists "managers update pending organization" on public.organizations;
create policy "owners update own organization data" on public.organizations for update to authenticated
  using (created_by in (select id from public.profiles where user_id=auth.uid()) and status='active')
  with check (created_by in (select id from public.profiles where user_id=auth.uid()) and status='active');

create or replace function public.protect_organization_verification()
returns trigger language plpgsql set search_path=public as $$
begin
  if (
    new.status is distinct from old.status
    or new.verification_status is distinct from old.verification_status
    or new.verification_source is distinct from old.verification_source
    or new.verification_checked_at is distinct from old.verification_checked_at
  ) and coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'O estado de verificação só pode ser alterado pelo serviço de validação.';
  end if;
  return new;
end; $$;
drop trigger if exists protect_organization_verification_fields on public.organizations;
create trigger protect_organization_verification_fields before update on public.organizations
  for each row execute function public.protect_organization_verification();

revoke execute on function public.review_organization(uuid,text,text) from authenticated;
drop function if exists public.review_organization(uuid,text,text);
