-- Promote products to the canonical supplier catalog while preserving the
-- legacy text arrays until every consumer has migrated to product ids.
create or replace function public.normalize_product_name(p_value text)
returns text
language sql
immutable
set search_path=public
as $$
  select btrim(regexp_replace(
    translate(
      lower(coalesce(p_value,'')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  ));
$$;

alter table public.products
  add column if not exists normalized_name text,
  add column if not exists status text not null default 'active',
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check
  check(status in ('active','pending','rejected'));

update public.products
set normalized_name=public.normalize_product_name(nome),
    status=case when ativo then 'active' else 'rejected' end
where normalized_name is null or normalized_name='';

update public.products
set status='rejected',ativo=false,updated_at=now()
where normalized_name='';

with duplicates as (
  select id,row_number() over(
    partition by normalized_name order by ativo desc,created_at,id
  ) as position
  from public.products
  where status in ('active','pending')
)
update public.products p
set status='rejected',ativo=false,updated_at=now()
from duplicates d
where p.id=d.id and d.position>1;

alter table public.products alter column normalized_name set not null;

create unique index if not exists products_normalized_available_unique
  on public.products(normalized_name)
  where status in ('active','pending');
create index if not exists products_catalog_category_name_idx
  on public.products(categoria,nome)
  where status='active';

create or replace function public.prepare_catalog_product()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.nome:=btrim(new.nome);
  new.categoria:=btrim(new.categoria);
  new.unidade:=btrim(new.unidade);
  new.normalized_name:=public.normalize_product_name(new.nome);
  new.ativo:=new.status='active';
  new.updated_at:=now();
  if new.normalized_name='' then
    raise exception 'Nome do produto obrigatorio.';
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_catalog_product on public.products;
create trigger prepare_catalog_product
before insert or update of nome,categoria,unidade,status on public.products
for each row execute function public.prepare_catalog_product();

create table if not exists public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  unique(normalized_alias)
);

create or replace function public.prepare_product_alias()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.alias:=btrim(new.alias);
  new.normalized_alias:=public.normalize_product_name(new.alias);
  if new.normalized_alias='' then
    raise exception 'Apelido do produto obrigatorio.';
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_product_alias on public.product_aliases;
create trigger prepare_product_alias
before insert or update of alias on public.product_aliases
for each row execute function public.prepare_product_alias();

create table if not exists public.producer_products (
  producer_id uuid not null references public.producers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(producer_id,product_id)
);
create index if not exists producer_products_product_idx
  on public.producer_products(product_id,producer_id);

alter table public.product_aliases enable row level security;
alter table public.producer_products enable row level security;

drop policy if exists "products readable" on public.products;
drop policy if exists "catalog products readable" on public.products;
create policy "catalog products readable" on public.products for select to authenticated
using (
  status='active'
  or created_by in (select id from public.profiles where user_id=auth.uid())
  or public.is_platform_admin()
);

drop policy if exists "catalog aliases readable" on public.product_aliases;
create policy "catalog aliases readable" on public.product_aliases for select to authenticated
using (
  exists(
    select 1 from public.products p
    where p.id=product_id and (
      p.status='active'
      or p.created_by in (select id from public.profiles where user_id=auth.uid())
      or public.is_platform_admin()
    )
  )
);

drop policy if exists "producers read own product links" on public.producer_products;
create policy "producers read own product links" on public.producer_products for select to authenticated
using (
  producer_id in (
    select pr.id from public.producers pr
    join public.profiles p on p.id=pr.profile_id
    where p.user_id=auth.uid()
  )
  or public.is_platform_admin()
);

with catalog(category,default_unit,items) as (
  values
  ('Hortaliças e Folhosos','unidade',array[
    'Alface Americana','Alface Crespa','Alface Lisa','Alface Roxa','Rúcula','Agrião',
    'Espinafre','Couve Manteiga','Couve Chinesa','Repolho Verde','Repolho Roxo','Acelga',
    'Almeirão','Chicória','Salsa','Cebolinha','Coentro','Manjericão','Hortelã'
  ]::text[]),
  ('Legumes e Frutos','kg',array[
    'Tomate Italiano','Tomate Cereja','Tomate Caqui','Tomate Débora','Pimentão Vermelho',
    'Pimentão Verde','Pimentão Amarelo','Abobrinha Italiana','Abobrinha Brasileira','Berinjela',
    'Pepino Comum','Pepino Japonês','Quiabo','Jiló','Chuchu','Abóbora Cabotiá',
    'Abóbora Moranga','Milho Verde','Vagem','Ervilha'
  ]::text[]),
  ('Raízes e Tubérculos','kg',array[
    'Cenoura','Beterraba','Batata Inglesa','Batata Doce','Batata Baroa','Mandioca','Inhame',
    'Cará','Rabanete','Nabo','Gengibre','Alho','Cebola'
  ]::text[]),
  ('Brássicas','unidade',array[
    'Brócolis Ninja','Brócolis Ramoso','Couve-flor','Couve de Bruxelas'
  ]::text[]),
  ('Frutas','kg',array[
    'Banana Prata','Banana Nanica','Banana da Terra','Maçã Gala','Maçã Fuji','Pera',
    'Mamão Formosa','Mamão Papaya','Melancia','Melão','Abacaxi','Manga Palmer','Manga Tommy',
    'Laranja Pera','Laranja Lima','Tangerina','Limão Tahiti','Limão Siciliano','Maracujá',
    'Goiaba','Abacate','Uva','Morango','Kiwi','Coco Verde','Laranja Pera Rio',
    'Laranja Pera Natal','Poncã','Tangerina Cravo','Murcot','Pitaya Roxa','Pitaya Amarela',
    'Pitaya Branca','Figo','Mamão','Amora e Morango','Manga e Maracujá'
  ]::text[]),
  ('Ervas e Temperos','maço',array[
    'Alecrim','Tomilho','Sálvia','Orégano','Louro','Cebolete'
  ]::text[]),
  ('Leite e Derivados','unidade',array[
    'Leite Pasteurizado Integral','Leite Pasteurizado Semi-desnatado',
    'Leite Pasteurizado Desnatado','Leite Cru','Leite de Cabra','Leite de Ovelha','Mussarela',
    'Queijo Minas Frescal','Queijo Coalho','Queijo Prato','Queijo Parmesão','Requeijão Cremoso',
    'Manteiga','Iogurte Natural','Iogurte de Frutas','Doce de Leite','Leite Condensado',
    'Creme de Leite','Ricota','Coalho para Churrasco'
  ]::text[]),
  ('Doces, geleias e conservas artesanais','unidade',array[
    'Doce Figo Ramy','Geleia laranja com pimenta','Abacaxi com pimenta',
    'Picles de Botão Floral de Pitaya','Paçoca artesanal','Cocada artesanal','Doce de abóbora'
  ]::text[]),
  ('Massas, pães e bolos artesanais','unidade',array[
    'Fettuccine de Pitaya','Pão caseiro','Bolacha de nata','Bolo de milho','Bolo de mandioca',
    'Bolo recheado de brigadeiro','Bolo recheado de abacaxi'
  ]::text[]),
  ('Snacks artesanais','unidade',array['Chips de mandioca','Chips de batata']::text[]),
  ('Cafés','kg',array[
    'Café tradicional','Café especial','Café torrado em grãos','Café torrado e moído',
    'Café orgânico','Café gourmet'
  ]::text[])
), catalog_rows as (
  select category,default_unit,unnest(items) as product_name from catalog
)
insert into public.products(
  nome,categoria,unidade,descricao,ativo,status,normalized_name
)
select
  product_name,category,default_unit,null,true,'active',
  public.normalize_product_name(product_name)
from catalog_rows
on conflict do nothing;

insert into public.product_aliases(product_id,alias,normalized_alias)
select id,'Limão Taiti',public.normalize_product_name('Limão Taiti')
from public.products where normalized_name=public.normalize_product_name('Limão Tahiti')
on conflict do nothing;
insert into public.product_aliases(product_id,alias,normalized_alias)
select id,'Ponkan',public.normalize_product_name('Ponkan')
from public.products where normalized_name=public.normalize_product_name('Poncã')
on conflict do nothing;
insert into public.product_aliases(product_id,alias,normalized_alias)
select id,'Muçarela',public.normalize_product_name('Muçarela')
from public.products where normalized_name=public.normalize_product_name('Mussarela')
on conflict do nothing;

create or replace function public.search_product_catalog(p_query text default '')
returns table(
  id uuid,
  name text,
  category text,
  default_unit text,
  status text
)
language sql
stable
security definer
set search_path=public
as $$
  with input as (
    select public.normalize_product_name(coalesce(p_query,'')) as query
  )
  select distinct p.id,p.nome,p.categoria,p.unidade,p.status
  from public.products p
  cross join input i
  left join public.product_aliases pa on pa.product_id=p.id
  where (
      p.status='active'
      or (
        p.status='pending'
        and p.created_by in (select id from public.profiles where user_id=auth.uid())
      )
    )
    and (
      i.query=''
      or p.normalized_name like '%'||i.query||'%'
      or pa.normalized_alias like '%'||i.query||'%'
    )
  order by p.categoria,p.nome
  limit 100;
$$;

create or replace function public.list_my_producer_product_ids()
returns table(product_id uuid)
language sql
stable
security definer
set search_path=public
as $$
  select pp.product_id
  from public.producer_products pp
  join public.producers pr on pr.id=pp.producer_id
  join public.profiles p on p.id=pr.profile_id
  where p.user_id=auth.uid() and pr.ativo
  order by pp.created_at;
$$;

create or replace function public.set_my_producer_products(p_product_ids uuid[])
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile_id uuid;
  v_producer_id uuid;
  v_requested_count integer;
  v_allowed_count integer;
begin
  if auth.uid() is null then raise exception 'Autenticacao obrigatoria.'; end if;

  select p.id,pr.id into v_profile_id,v_producer_id
  from public.profiles p
  join public.producers pr on pr.profile_id=p.id
  where p.user_id=auth.uid() and pr.ativo
  limit 1;
  if v_producer_id is null then raise exception 'Perfil de produtor nao encontrado.'; end if;

  select count(distinct id) into v_requested_count
  from unnest(coalesce(p_product_ids,'{}'::uuid[])) requested(id);
  select count(*) into v_allowed_count
  from public.products product
  where product.id=any(coalesce(p_product_ids,'{}'::uuid[]))
    and (
      product.status='active'
      or (product.status='pending' and product.created_by=v_profile_id)
    );
  if v_requested_count<>v_allowed_count then
    raise exception 'Um ou mais produtos nao estao disponiveis para este produtor.';
  end if;

  delete from public.producer_products where producer_id=v_producer_id;
  insert into public.producer_products(producer_id,product_id)
  select v_producer_id,requested.id
  from unnest(coalesce(p_product_ids,'{}'::uuid[])) requested(id)
  on conflict do nothing;

  update public.producers pr
  set categorias_atendidas=coalesce((
    select array_agg(product.nome order by product.nome)
    from public.producer_products pp
    join public.products product on product.id=pp.product_id
    where pp.producer_id=v_producer_id
  ),'{}'::text[])
  where pr.id=v_producer_id;
end;
$$;

revoke all on function public.normalize_product_name(text) from public;
revoke all on function public.search_product_catalog(text) from public;
revoke all on function public.list_my_producer_product_ids() from public;
revoke all on function public.set_my_producer_products(uuid[]) from public;
grant execute on function public.search_product_catalog(text) to authenticated;
grant execute on function public.list_my_producer_product_ids() to authenticated;
grant execute on function public.set_my_producer_products(uuid[]) to authenticated;
