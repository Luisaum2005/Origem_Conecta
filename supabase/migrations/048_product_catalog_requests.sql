-- Allow producers to request missing catalog entries without publishing them
-- to buyers before an administrator reviews the request.
alter table public.products
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz;

create or replace function public.request_catalog_product(
  p_name text,
  p_category text default 'Outros',
  p_default_unit text default 'unidade'
)
returns table(
  product_id uuid,
  request_status text,
  product_name text,
  already_existed boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile_id uuid;
  v_normalized_name text:=public.normalize_product_name(p_name);
  v_product public.products%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticacao obrigatoria.';
  end if;

  select p.id into v_profile_id
  from public.profiles p
  join public.producers pr on pr.profile_id=p.id
  where p.user_id=auth.uid()
    and p.tipo='produtor'
    and pr.ativo
  limit 1;

  if v_profile_id is null then
    raise exception 'Apenas produtores ativos podem solicitar produtos.';
  end if;
  if char_length(v_normalized_name)<2 or char_length(btrim(coalesce(p_name,'')))>120 then
    raise exception 'Informe um nome de produto entre 2 e 120 caracteres.';
  end if;
  if char_length(btrim(coalesce(p_category,'')))<2
     or char_length(btrim(p_category))>80 then
    raise exception 'Informe uma categoria valida.';
  end if;
  if btrim(coalesce(p_default_unit,'')) not in (
    'unidade','kg','g','litro','ml','maço','caixa','dúzia','bandeja','saco'
  ) then
    raise exception 'Informe uma unidade valida.';
  end if;

  select p.* into v_product
  from public.products p
  where p.normalized_name=v_normalized_name
    and p.status in ('active','pending')
  order by case when p.status='active' then 0 else 1 end
  limit 1;

  if v_product.id is not null then
    return query select
      v_product.id,
      v_product.status,
      v_product.nome,
      true;
    return;
  end if;

  begin
    insert into public.products(
      nome,categoria,unidade,descricao,ativo,status,created_by,normalized_name
    ) values (
      btrim(p_name),btrim(p_category),btrim(p_default_unit),null,false,'pending',
      v_profile_id,v_normalized_name
    )
    returning * into v_product;
  exception when unique_violation then
    select p.* into v_product
    from public.products p
    where p.normalized_name=v_normalized_name
      and p.status in ('active','pending')
    limit 1;
  end;

  return query select
    v_product.id,
    v_product.status,
    v_product.nome,
    v_product.created_by is distinct from v_profile_id;
end;
$$;

create or replace function public.list_my_product_requests()
returns table(
  product_id uuid,
  product_name text,
  category text,
  default_unit text,
  request_status text,
  review_note text,
  requested_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path=public
as $$
  select
    product.id,
    product.nome,
    product.categoria,
    product.unidade,
    product.status,
    product.review_note,
    product.created_at,
    product.reviewed_at
  from public.products product
  where product.created_by in (
    select profile.id from public.profiles profile where profile.user_id=auth.uid()
  )
  order by product.created_at desc;
$$;

create or replace function public.list_pending_product_requests()
returns table(
  product_id uuid,
  product_name text,
  category text,
  default_unit text,
  producer_name text,
  requested_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas administradores podem revisar solicitacoes.';
  end if;

  return query
  select
    product.id,
    product.nome,
    product.categoria,
    product.unidade,
    profile.nome,
    product.created_at
  from public.products product
  join public.profiles profile on profile.id=product.created_by
  where product.status='pending'
  order by product.created_at;
end;
$$;

create or replace function public.review_catalog_product_request(
  p_product_id uuid,
  p_decision text,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_request public.products%rowtype;
  v_reviewer_id uuid;
  v_requester_user_id uuid;
  v_producer_id uuid;
begin
  if p_decision not in ('active','rejected') then
    raise exception 'Decisao invalida.';
  end if;
  if char_length(coalesce(p_review_note,''))>500 then
    raise exception 'A observacao da revisao deve ter no maximo 500 caracteres.';
  end if;
  if not public.is_platform_admin() then
    raise exception 'Apenas administradores podem revisar solicitacoes.';
  end if;

  select id into v_reviewer_id
  from public.profiles
  where user_id=auth.uid() and tipo='admin'
  limit 1;

  select * into v_request
  from public.products
  where id=p_product_id
  for update;

  if v_request.id is null or v_request.status<>'pending' then
    raise exception 'Solicitacao pendente nao encontrada.';
  end if;

  update public.products
  set status=p_decision,
      review_note=nullif(btrim(coalesce(p_review_note,'')),''),
      reviewed_by=v_reviewer_id,
      reviewed_at=now()
  where id=p_product_id;

  if p_decision='rejected' then
    select id into v_producer_id
    from public.producers
    where profile_id=v_request.created_by
    limit 1;

    delete from public.producer_products
    where producer_id=v_producer_id and product_id=p_product_id;

    update public.producers producer
    set categorias_atendidas=coalesce((
      select array_agg(product.nome order by product.nome)
      from public.producer_products link
      join public.products product on product.id=link.product_id
      where link.producer_id=v_producer_id and product.status in ('active','pending')
    ),'{}'::text[])
    where producer.id=v_producer_id;
  end if;

  select user_id into v_requester_user_id
  from public.profiles
  where id=v_request.created_by;

  if v_requester_user_id is not null then
    insert into public.notifications(
      user_id,type,title,body,data,idempotency_key
    ) values (
      v_requester_user_id,
      'system',
      case when p_decision='active' then 'Produto aprovado' else 'Solicitacao de produto revisada' end,
      case
        when p_decision='active' then v_request.nome||' agora esta disponivel no catalogo.'
        else 'A solicitacao de '||v_request.nome||' nao foi aprovada.'||
          case when nullif(btrim(coalesce(p_review_note,'')),'') is null then ''
               else ' Motivo: '||btrim(p_review_note) end
      end,
      jsonb_build_object(
        'url','/profile/producer?edit=products',
        'kind','product_request_reviewed',
        'productId',p_product_id,
        'decision',p_decision
      ),
      'product-request:'||p_product_id||':'||p_decision
    )
    on conflict(user_id,idempotency_key) do nothing;
  end if;
end;
$$;

revoke all on function public.request_catalog_product(text,text,text) from public;
revoke all on function public.list_my_product_requests() from public;
revoke all on function public.list_pending_product_requests() from public;
revoke all on function public.review_catalog_product_request(uuid,text,text) from public;
grant execute on function public.request_catalog_product(text,text,text) to authenticated;
grant execute on function public.list_my_product_requests() to authenticated;
grant execute on function public.list_pending_product_requests() to authenticated;
grant execute on function public.review_catalog_product_request(uuid,text,text) to authenticated;
