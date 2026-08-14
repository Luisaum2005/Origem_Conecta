-- Read and update the authenticated producer's private profile without exposing
-- operational address fields to other authenticated catalog users.

create or replace function public.get_my_producer_profile()
returns table(
  profile_name text,
  phone text,
  city text,
  state text,
  property_name text,
  responsible_name text,
  location text,
  postal_code text,
  address_line text,
  address_number text,
  address_complement text,
  neighborhood text,
  products text[],
  commercialization_mode text,
  commercial_verification_status text,
  cnpj text,
  caepf text,
  state_registration text
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select
    p.nome,
    coalesce(p.telefone,o.phone),
    coalesce(p.cidade,o.city),
    coalesce(p.estado,o.state),
    coalesce(pr.nome_propriedade,o.trade_name),
    coalesce(pr.responsavel,o.responsible_name),
    coalesce(pr.localizacao,concat_ws(', ',o.city,o.state)),
    coalesce(pr.postal_code,o.postal_code),
    coalesce(pr.address_line,o.address_line),
    coalesce(pr.address_number,o.address_number),
    coalesce(pr.address_complement,o.address_complement),
    coalesce(pr.neighborhood,o.neighborhood),
    pr.categorias_atendidas,
    pr.commercialization_mode,
    pr.commercial_verification_status,
    d.cnpj,
    d.caepf,
    d.state_registration
  from public.profiles p
  join public.producers pr on pr.profile_id=p.id
  left join public.producer_commercial_documents d on d.producer_id=pr.id
  left join lateral (
    select organization.*
    from public.organizations organization
    where organization.created_by=p.id and organization.status='active'
    order by organization.created_at
    limit 1
  ) o on true
  where p.user_id=auth.uid() and pr.ativo
  limit 1;
$$;

revoke all on function public.get_my_producer_profile() from public,anon;
grant execute on function public.get_my_producer_profile() to authenticated;

create or replace function public.secure_update_my_producer_profile(p_details jsonb)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_profile_id uuid;
  v_producer_id uuid;
  v_property_name text:=nullif(btrim(p_details->>'propertyName'),'');
  v_responsible_name text:=nullif(btrim(p_details->>'responsibleName'),'');
  v_phone text:=nullif(btrim(p_details->>'phone'),'');
  v_city text:=nullif(btrim(p_details->>'city'),'');
  v_state text:=upper(btrim(coalesce(p_details->>'state','')));
  v_postal_code text:=regexp_replace(coalesce(p_details->>'postalCode',''),'\D','','g');
  v_address_line text:=nullif(btrim(p_details->>'addressLine'),'');
  v_neighborhood text:=nullif(btrim(p_details->>'neighborhood'),'');
  v_mode text:=coalesce(nullif(btrim(p_details->>'commercializationMode'),''),'undecided');
  v_products text[];
begin
  if auth.uid() is null then
    raise exception 'Autenticacao obrigatoria.';
  end if;

  select p.id,pr.id into v_profile_id,v_producer_id
  from public.profiles p
  join public.producers pr on pr.profile_id=p.id
  where p.user_id=auth.uid() and pr.ativo
  limit 1;

  if v_producer_id is null then
    raise exception 'Perfil de produtor nao encontrado.';
  end if;
  if v_property_name is null or v_responsible_name is null or v_phone is null then
    raise exception 'Informe propriedade, responsavel e telefone.';
  end if;
  if length(v_postal_code)<>8 or v_address_line is null or v_neighborhood is null
     or v_city is null or v_state !~ '^[A-Z]{2}$' then
    raise exception 'Informe o endereco completo do produtor.';
  end if;
  if v_mode not in ('own','organization','undecided') then
    raise exception 'Forma de comercializacao invalida.';
  end if;

  select coalesce(array_agg(distinct product order by product),'{}'::text[])
  into v_products
  from (
    select nullif(btrim(value),'') as product
    from jsonb_array_elements_text(coalesce(p_details->'products','[]'::jsonb))
  ) normalized
  where product is not null;

  update public.profiles
  set nome=v_responsible_name,telefone=v_phone,cidade=v_city,estado=v_state
  where id=v_profile_id;

  update public.producers
  set nome_propriedade=v_property_name,
      responsavel=v_responsible_name,
      localizacao=concat_ws(', ',v_city,v_state),
      postal_code=v_postal_code,
      address_line=v_address_line,
      address_number=nullif(btrim(p_details->>'addressNumber'),''),
      address_complement=nullif(btrim(p_details->>'addressComplement'),''),
      neighborhood=v_neighborhood,
      categorias_atendidas=v_products,
      commercialization_mode=v_mode
  where id=v_producer_id;

  insert into public.producer_commercial_documents(
    producer_id,cnpj,caepf,state_registration,updated_at
  ) values (
    v_producer_id,
    nullif(regexp_replace(coalesce(p_details->>'cnpj',''),'\D','','g'),''),
    nullif(regexp_replace(coalesce(p_details->>'caepf',''),'\D','','g'),''),
    nullif(btrim(p_details->>'stateRegistration'),''),
    now()
  )
  on conflict(producer_id) do update
  set cnpj=excluded.cnpj,
      caepf=excluded.caepf,
      state_registration=excluded.state_registration,
      updated_at=now();
end;
$$;

revoke all on function public.secure_update_my_producer_profile(jsonb) from public,anon;
grant execute on function public.secure_update_my_producer_profile(jsonb) to authenticated;

-- A cancelled order no longer has a usable delivery handshake. Do not return
-- its secret code even to the buyer after cancellation.
create or replace function public.get_my_order_delivery_codes(p_order_ids uuid[])
returns table(order_id uuid,delivery_code text)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;
  if p_order_ids is null or cardinality(p_order_ids) not between 1 and 100 then
    raise exception 'Informe entre 1 e 100 pedidos.';
  end if;

  return query
  select o.id,o.codigo_entrega
  from public.orders o
  join public.buyers b on b.id=o.buyer_id
  join public.profiles p on p.id=b.profile_id
  where p.user_id=auth.uid()
    and o.id=any(p_order_ids)
    and o.status<>'cancelado';
end;
$$;

revoke all on function public.get_my_order_delivery_codes(uuid[]) from public,anon;
grant execute on function public.get_my_order_delivery_codes(uuid[]) to authenticated;
