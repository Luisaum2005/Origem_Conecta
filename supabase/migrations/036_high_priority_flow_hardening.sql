-- P1 hardening: account integrity, atomic demand/quote writes and safer uploads.

-- Application identities are created only by handle_application_signup. Browser
-- clients may read/update their own operational fields, but cannot create/delete
-- identities or cascade-delete business history.
drop policy if exists "profiles own row" on public.profiles;
create policy "profiles read own row" on public.profiles
  for select to authenticated using (user_id=auth.uid());
create policy "profiles update own row" on public.profiles
  for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "producers own insert" on public.producers;
drop policy if exists "buyers own data" on public.buyers;
create policy "buyers read own data" on public.buyers
  for select to authenticated
  using (profile_id in (select id from public.profiles where user_id=auth.uid()));
create policy "buyers update own data" on public.buyers
  for update to authenticated
  using (profile_id in (select id from public.profiles where user_id=auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id=auth.uid()));

drop policy if exists "users add own initial roles" on public.profile_roles;
drop policy if exists "users create active unverified organizations" on public.organizations;

create unique index if not exists profiles_one_per_auth_user
  on public.profiles(user_id) where user_id is not null;
create unique index if not exists producers_one_per_profile
  on public.producers(profile_id) where profile_id is not null;
create unique index if not exists buyers_one_per_profile
  on public.buyers(profile_id) where profile_id is not null;

create or replace function public.protect_profile_identity_fields()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if (
    new.user_id is distinct from old.user_id
    or new.tipo is distinct from old.tipo
    or new.email is distinct from old.email
  ) and coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'Os dados de identidade da conta nao podem ser alterados por esta operacao.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_identity_fields on public.profiles;
create trigger protect_profile_identity_fields
before update of user_id,tipo,email on public.profiles
for each row execute function public.protect_profile_identity_fields();

-- Existing organization-only accounts receive the producer context adopted by
-- the current product flow. This avoids leaving older users trapped in a route
-- set that no longer represents the application model.
insert into public.producers(
  profile_id,nome_propriedade,responsavel,cnpj,localizacao,categorias_atendidas,
  commercialization_mode,commercial_verification_status,ativo
)
select
  p.id,o.trade_name,o.responsible_name,null,
  concat_ws(', ',nullif(o.city,''),nullif(o.state,'')),'{}'::text[],
  'organization','self_declared',true
from public.organizations o
join public.profiles p on p.id=o.created_by
where not exists(select 1 from public.producers pr where pr.profile_id=p.id);

insert into public.profile_roles(profile_id,role)
select distinct o.created_by,'produtor'
from public.organizations o
on conflict do nothing;

insert into public.organization_members(
  organization_id,producer_id,status,requested_by,can_sell_through_organization,
  reviewed_by,reviewed_at,joined_at
)
select o.id,pr.id,'active',o.created_by,true,o.created_by,now(),now()
from public.organizations o
join public.producers pr on pr.profile_id=o.created_by
on conflict(organization_id,producer_id) do nothing;

alter table public.profiles disable trigger protect_profile_type;
alter table public.profiles disable trigger protect_profile_identity_fields;
update public.profiles p
set tipo='produtor'
where tipo='organizacao'
  and exists(select 1 from public.organizations o where o.created_by=p.id);
alter table public.profiles enable trigger protect_profile_identity_fields;
alter table public.profiles enable trigger protect_profile_type;

create or replace function public.require_organization_creator_producer()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if not exists(
    select 1 from public.producers pr
    where pr.profile_id=new.created_by and pr.ativo
  ) then
    raise exception 'A conta responsavel pela organizacao precisa ter um perfil de produtor.';
  end if;
  return new;
end;
$$;

drop trigger if exists require_organization_creator_producer on public.organizations;
create trigger require_organization_creator_producer
before insert on public.organizations
for each row execute function public.require_organization_creator_producer();

-- Producers may choose how they commercialize, but cannot approve their own
-- fiscal verification state.
create or replace function public.protect_producer_commercial_verification()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if (
    new.commercial_verification_status is distinct from old.commercial_verification_status
    or new.score_confiabilidade is distinct from old.score_confiabilidade
    or new.taxa_entrega_no_prazo is distinct from old.taxa_entrega_no_prazo
  )
     and coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'A verificacao e as metricas comerciais so podem ser alteradas pelo servico.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_producer_commercial_verification on public.producers;
create trigger protect_producer_commercial_verification
before update of commercial_verification_status,score_confiabilidade,taxa_entrega_no_prazo on public.producers
for each row execute function public.protect_producer_commercial_verification();

-- Create the demand and every item in one transaction. Values that affect the
-- buyer identity and initial status are derived by the database.
create or replace function public.secure_create_demand(p_demand jsonb,p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_buyer public.buyers%rowtype;
  v_demand public.demand_requests%rowtype;
  v_item jsonb;
  v_quantity numeric;
  v_delivery_date date;
  v_product_name text;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;
  select b.* into v_buyer
  from public.buyers b
  join public.profiles p on p.id=b.profile_id
  where p.user_id=auth.uid() and b.ativo;
  if not found then raise exception 'Cadastro de comprador ativo nao encontrado.'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'A demanda precisa ter entre 1 e 50 itens.';
  end if;
  begin
    v_delivery_date:=(p_demand->>'deliveryDate')::date;
  exception when others then
    raise exception 'Informe uma data de entrega valida.';
  end;
  if v_delivery_date<current_date then raise exception 'A data de entrega nao pode estar no passado.'; end if;
  if coalesce(p_demand->>'urgency','normal') not in ('normal','urgente') then
    raise exception 'Urgencia invalida.';
  end if;
  if char_length(coalesce(p_demand->>'notes',''))>2000
     or char_length(coalesce(p_demand->>'paymentNotes',''))>1000 then
    raise exception 'As observacoes excedem o limite permitido.';
  end if;

  insert into public.demand_requests(
    buyer_id,buyer_name,delivery_date,urgency,status,payment_method,payment_notes,notes
  ) values (
    v_buyer.id,v_buyer.nome_empresa,v_delivery_date,coalesce(p_demand->>'urgency','normal'),
    'aberta',coalesce(nullif(btrim(p_demand->>'paymentMethod'),''),'A combinar'),
    nullif(btrim(p_demand->>'paymentNotes'),''),nullif(btrim(p_demand->>'notes'),'')
  ) returning * into v_demand;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_name:=nullif(btrim(v_item->>'productName'),'');
    begin
      v_quantity:=(v_item->>'quantity')::numeric;
    exception when others then
      raise exception 'Quantidade invalida na demanda.';
    end;
    if v_product_name is null or char_length(v_product_name)>120 or v_quantity<=0 then
      raise exception 'Revise o produto e a quantidade informados.';
    end if;
    if nullif(btrim(v_item->>'unit'),'') is null or char_length(v_item->>'unit')>20 then
      raise exception 'Unidade de medida invalida.';
    end if;
    insert into public.demand_items(demand_id,product_name,quantity,unit,product_state,notes)
    values(
      v_demand.id,v_product_name,v_quantity,btrim(v_item->>'unit'),
      coalesce(nullif(btrim(v_item->>'productState'),''),'Indiferente'),
      nullif(left(btrim(v_item->>'notes'),1000),'')
    );
  end loop;
  return jsonb_build_object('id',v_demand.id,'createdAt',v_demand.created_at);
end;
$$;

-- A response and its prices are also written atomically. Product names and units
-- come from the original demand item instead of browser-controlled snapshots.
create or replace function public.secure_respond_demand(
  p_demand_id uuid,p_response jsonb,p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_producer public.producers%rowtype;
  v_demand public.demand_requests%rowtype;
  v_response public.demand_responses%rowtype;
  v_demand_item public.demand_items%rowtype;
  v_item jsonb;
  v_quantity numeric;
  v_price numeric;
  v_can_supply boolean;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;
  select pr.* into v_producer
  from public.producers pr
  join public.profiles p on p.id=pr.profile_id
  where p.user_id=auth.uid() and pr.ativo;
  if not found then raise exception 'Cadastro de produtor ativo nao encontrado.'; end if;
  select * into v_demand from public.demand_requests
  where id=p_demand_id and status in ('aberta','respondida') for update;
  if not found then raise exception 'Demanda nao encontrada ou encerrada.'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'A resposta precisa informar os itens atendidos.';
  end if;
  if char_length(coalesce(p_response->>'notes',''))>2000 then
    raise exception 'As observacoes excedem o limite permitido.';
  end if;

  insert into public.demand_responses(demand_id,producer_id,producer_name,status,notes)
  values(
    v_demand.id,v_producer.id,coalesce(v_producer.responsavel,v_producer.nome_propriedade),
    'enviada',nullif(btrim(p_response->>'notes'),'')
  ) returning * into v_response;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_demand_item
    from public.demand_items
    where id=(v_item->>'demandItemId')::uuid and demand_id=v_demand.id;
    if not found then raise exception 'Um item da resposta nao pertence a esta demanda.'; end if;
    begin
      v_quantity:=coalesce((v_item->>'quantity')::numeric,0);
      v_price:=coalesce((v_item->>'price')::numeric,0);
      v_can_supply:=coalesce((v_item->>'canSupply')::boolean,false);
    exception when others then
      raise exception 'Quantidade ou preco invalido na resposta.';
    end;
    if v_quantity<0 or v_price<0 or (v_can_supply and (v_quantity<=0 or v_price<=0)) then
      raise exception 'Itens atendidos precisam ter quantidade e preco positivos.';
    end if;
    insert into public.demand_response_items(
      response_id,demand_item_id,product_name,quantity,unit,price,can_supply,notes
    ) values (
      v_response.id,v_demand_item.id,v_demand_item.product_name,v_quantity,v_demand_item.unit,
      v_price,v_can_supply,nullif(left(btrim(v_item->>'notes'),1000),'')
    );
  end loop;
  if not exists(
    select 1 from public.demand_response_items ri
    where ri.response_id=v_response.id and ri.can_supply and ri.quantity>0 and ri.price>0
  ) then
    raise exception 'Informe ao menos um item que pode ser atendido.';
  end if;
  update public.demand_requests set status='respondida' where id=v_demand.id;
  return jsonb_build_object('id',v_response.id,'createdAt',v_response.created_at);
exception when unique_violation then
  raise exception 'Voce ja respondeu a esta demanda.';
end;
$$;

revoke all on function public.secure_create_demand(jsonb,jsonb) from public,anon;
revoke all on function public.secure_respond_demand(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.secure_create_demand(jsonb,jsonb) to authenticated;
grant execute on function public.secure_respond_demand(uuid,jsonb,jsonb) to authenticated;

drop policy if exists "Comprador cria demanda" on public.demand_requests;
drop policy if exists "Comprador atualiza propria demanda" on public.demand_requests;
drop policy if exists "Comprador cria itens da demanda" on public.demand_items;
drop policy if exists "Produtor responde demanda aberta" on public.demand_responses;
drop policy if exists "Comprador aprova resposta" on public.demand_responses;
drop policy if exists "Produtor cria itens de resposta" on public.demand_response_items;

drop policy if exists "Itens de resposta visiveis" on public.demand_response_items;
create policy "response items visible to participants" on public.demand_response_items
  for select to authenticated
  using (exists (
    select 1
    from public.demand_responses r
    join public.demand_requests d on d.id=r.demand_id
    where r.id=demand_response_items.response_id
      and (
        r.producer_id in (
          select pr.id from public.producers pr
          join public.profiles p on p.id=pr.profile_id where p.user_id=auth.uid()
        )
        or d.buyer_id in (
          select b.id from public.buyers b
          join public.profiles p on p.id=b.profile_id where p.user_id=auth.uid()
        )
      )
  ));

-- Quote creation is validated server-side; a producer sees open requests plus
-- their own response, never another producer's commercial proposal.
create or replace function public.secure_create_quote(p_quote jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_buyer public.buyers%rowtype;
  v_quote public.quote_requests%rowtype;
  v_quantity numeric;
  v_target numeric;
  v_product text:=nullif(btrim(p_quote->>'productName'),'');
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;
  select b.* into v_buyer from public.buyers b join public.profiles p on p.id=b.profile_id
  where p.user_id=auth.uid() and b.ativo;
  if not found then raise exception 'Cadastro de comprador ativo nao encontrado.'; end if;
  begin
    v_quantity:=(p_quote->>'quantity')::numeric;
    v_target:=nullif(p_quote->>'targetPrice','')::numeric;
  exception when others then
    raise exception 'Quantidade ou preco alvo invalido.';
  end;
  if v_product is null or char_length(v_product)>120 or v_quantity<=0
     or (v_target is not null and v_target<0) then
    raise exception 'Revise os dados da solicitacao.';
  end if;
  if nullif(btrim(p_quote->>'unit'),'') is null or char_length(p_quote->>'unit')>20 then
    raise exception 'Unidade de medida invalida.';
  end if;
  if nullif(p_quote->>'deliveryDate','')::date < current_date then
    raise exception 'A data de entrega nao pode estar no passado.';
  end if;
  if char_length(coalesce(p_quote->>'notes',''))>2000 then
    raise exception 'As observacoes excedem o limite permitido.';
  end if;
  insert into public.quote_requests(
    buyer_id,nome_produto,quantidade,unidade,entrega_desejada,preco_alvo,observacoes,status
  ) values (
    v_buyer.id,v_product,v_quantity,btrim(p_quote->>'unit'),
    nullif(p_quote->>'deliveryDate','')::date,v_target,nullif(btrim(p_quote->>'notes'),''),'aberta'
  ) returning * into v_quote;
  return jsonb_build_object('id',v_quote.id,'createdAt',v_quote.criado_em);
end;
$$;

revoke all on function public.secure_create_quote(jsonb) from public,anon;
grant execute on function public.secure_create_quote(jsonb) to authenticated;

drop policy if exists "quote requests by buyer" on public.quote_requests;
drop policy if exists "quote requests readable by producers" on public.quote_requests;
drop policy if exists "quote requests by admin" on public.quote_requests;
create policy "buyers read own quote requests" on public.quote_requests
  for select to authenticated
  using (buyer_id in (
    select b.id from public.buyers b join public.profiles p on p.id=b.profile_id
    where p.user_id=auth.uid()
  ));
create policy "producers read open or own quote requests" on public.quote_requests
  for select to authenticated
  using (
    status='aberta'
    or producer_id in (
      select pr.id from public.producers pr join public.profiles p on p.id=pr.profile_id
      where p.user_id=auth.uid()
    )
  );

-- Every producer in a multi-producer order may rate the buyer once.
alter table public.buyer_ratings drop constraint if exists unique_order_rating;
alter table public.buyer_ratings drop constraint if exists buyer_ratings_order_producer_unique;
alter table public.buyer_ratings add constraint buyer_ratings_order_producer_unique
  unique(order_id,producer_id);

-- Reject blank chat messages even when sent outside the UI.
alter table public.messages drop constraint if exists messages_nonblank;
alter table public.messages add constraint messages_nonblank
  check (char_length(btrim(message)) between 1 and 2000) not valid;

-- The browser validates files for usability; Storage enforces the same ceiling.
update storage.buckets
set file_size_limit=31457280,
    allowed_mime_types=array[
      'image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'
    ]
where id='product-photos';
