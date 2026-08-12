-- Managers may maintain operational contact and address data without changing the
-- organization's legal identity or verification state.
create or replace function public.update_managed_organization_settings(
  p_organization_id uuid,
  p_trade_name text,
  p_email text,
  p_phone text,
  p_address_line text,
  p_address_number text,
  p_address_complement text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_responsible_name text,
  p_responsible_role text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_state text := upper(trim(coalesce(p_state,'')));
  v_postal_code text := regexp_replace(coalesce(p_postal_code,''),'\D','','g');
  v_phone text := regexp_replace(coalesce(p_phone,''),'\D','','g');
begin
  if not public.can_manage_organization(p_organization_id) then
    raise exception 'Você não tem permissão para editar esta organização.';
  end if;

  if nullif(trim(p_trade_name),'') is null
    or nullif(trim(p_email),'') is null
    or nullif(trim(p_address_line),'') is null
    or nullif(trim(p_neighborhood),'') is null
    or nullif(trim(p_city),'') is null
    or nullif(trim(p_responsible_name),'') is null
    or nullif(trim(p_responsible_role),'') is null then
    raise exception 'Preencha todos os campos obrigatórios.';
  end if;
  if trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Informe um e-mail válido.';
  end if;
  if length(v_phone) not between 10 and 11 then
    raise exception 'Informe um telefone com DDD.';
  end if;
  if length(v_postal_code) <> 8 then
    raise exception 'Informe um CEP com 8 números.';
  end if;
  if v_state !~ '^[A-Z]{2}$' then
    raise exception 'Informe uma UF válida.';
  end if;

  update public.organizations
  set trade_name=trim(p_trade_name),
      email=lower(trim(p_email)),
      phone=v_phone,
      address_line=trim(p_address_line),
      address_number=nullif(trim(p_address_number),''),
      address_complement=nullif(trim(p_address_complement),''),
      neighborhood=trim(p_neighborhood),
      city=trim(p_city),
      state=v_state,
      postal_code=v_postal_code,
      responsible_name=trim(p_responsible_name),
      responsible_role=trim(p_responsible_role),
      updated_at=now()
  where id=p_organization_id;

  if not found then
    raise exception 'Organização não encontrada.';
  end if;
end;
$$;

revoke all on function public.update_managed_organization_settings(
  uuid,text,text,text,text,text,text,text,text,text,text,text,text
) from public;
grant execute on function public.update_managed_organization_settings(
  uuid,text,text,text,text,text,text,text,text,text,text,text,text
) to authenticated;
