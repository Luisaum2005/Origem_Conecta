-- Preserve every operational address field collected during producer signup.
-- The public catalog continues to expose only municipality/UF; the complete
-- address remains private to the producer's own profile.

alter table public.producers
  add column if not exists postal_code text,
  add column if not exists address_line text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists neighborhood text;

create or replace function public.capture_producer_address_from_signup()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_payload jsonb;
  v_producer jsonb;
  v_postal_code text;
  v_address_line text;
  v_neighborhood text;
  v_city text;
  v_state text;
begin
  select raw_user_meta_data->'signup_payload'
    into v_payload
  from auth.users
  where id=(select user_id from public.profiles where id=new.profile_id);

  v_producer:=v_payload->'producer';
  -- Organization creators also receive a producer profile. Their address is
  -- already preserved in organizations, so do not require a duplicate payload.
  if v_producer is null or not (v_producer ? 'addressLine') then
    return new;
  end if;

  v_postal_code:=regexp_replace(coalesce(v_producer->>'postalCode',''),'\D','','g');
  v_address_line:=nullif(btrim(v_producer->>'addressLine'),'');
  v_neighborhood:=nullif(btrim(v_producer->>'neighborhood'),'');
  select nullif(btrim(cidade),''),upper(btrim(coalesce(estado,'')))
    into v_city,v_state
  from public.profiles
  where id=new.profile_id;

  if length(v_postal_code)<>8
     or v_address_line is null
     or v_neighborhood is null
     or v_city is null
     or v_state !~ '^[A-Z]{2}$' then
    raise exception 'Informe o endereço completo do produtor.';
  end if;

  update public.producers
  set postal_code=v_postal_code,
      address_line=v_address_line,
      address_number=nullif(btrim(v_producer->>'addressNumber'),''),
      address_complement=nullif(btrim(v_producer->>'addressComplement'),''),
      neighborhood=v_neighborhood
  where id=new.id;

  return new;
end;
$$;

drop trigger if exists capture_producer_address_from_signup on public.producers;
create trigger capture_producer_address_from_signup
after insert on public.producers
for each row execute function public.capture_producer_address_from_signup();
