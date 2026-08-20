-- Normalize confusing catalog entries while preserving producer links and
-- keeping former spellings searchable as aliases.
create or replace function public.migrate_catalog_product(
  p_old_name text,
  p_new_name text,
  p_category text default null,
  p_unit text default null
)
returns void
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_old_id uuid;
  v_target_id uuid;
begin
  select id into v_old_id
  from public.products
  where normalized_name=public.normalize_product_name(p_old_name)
    and status in ('active','pending')
  order by case when status='active' then 0 else 1 end,created_at,id
  limit 1;

  if v_old_id is null then return; end if;

  select id into v_target_id
  from public.products
  where normalized_name=public.normalize_product_name(p_new_name)
    and status in ('active','pending')
    and id<>v_old_id
  order by case when status='active' then 0 else 1 end,created_at,id
  limit 1;

  if v_target_id is not null then
    insert into public.producer_products(producer_id,product_id,created_at)
    select producer_id,v_target_id,created_at
    from public.producer_products
    where product_id=v_old_id
    on conflict do nothing;

    delete from public.producer_products where product_id=v_old_id;
    update public.producer_inventory set product_id=v_target_id where product_id=v_old_id;

    insert into public.product_substitutes(product_id,substitute_product_id)
    select
      case when product_id=v_old_id then v_target_id else product_id end,
      case when substitute_product_id=v_old_id then v_target_id else substitute_product_id end
    from public.product_substitutes
    where product_id=v_old_id or substitute_product_id=v_old_id
      and case when product_id=v_old_id then v_target_id else product_id end
          <> case when substitute_product_id=v_old_id then v_target_id else substitute_product_id end
    on conflict do nothing;
    delete from public.product_substitutes
    where product_id=v_old_id or substitute_product_id=v_old_id;

    update public.products
    set status='rejected',ativo=false,updated_at=now()
    where id=v_old_id;
  else
    update public.products
    set nome=p_new_name,
        categoria=coalesce(p_category,categoria),
        unidade=coalesce(p_unit,unidade),
        status='active',
        ativo=true,
        updated_at=now()
    where id=v_old_id;
    v_target_id:=v_old_id;
  end if;

  delete from public.product_aliases
  where product_id=v_target_id
    and normalized_alias=public.normalize_product_name(p_new_name);

  if public.normalize_product_name(p_old_name)<>public.normalize_product_name(p_new_name) then
    insert into public.product_aliases(product_id,alias,normalized_alias)
    values(v_target_id,p_old_name,public.normalize_product_name(p_old_name))
    on conflict do nothing;
  end if;
end;
$$;

select public.migrate_catalog_product('Limão Taiti','Limão Tahiti','Frutas','kg');
select public.migrate_catalog_product('Poncã','Tangerina Ponkan','Frutas','kg');
select public.migrate_catalog_product('Murcot','Tangerina Murcott','Frutas','kg');
select public.migrate_catalog_product('Mussarela','Muçarela','Leite e Derivados','unidade');
select public.migrate_catalog_product(
  'Leite Pasteurizado Semi-desnatado',
  'Leite Pasteurizado Semidesnatado',
  'Leite e Derivados',
  'litro'
);
select public.migrate_catalog_product(
  'Coalho para Churrasco',
  'Queijo Coalho para Churrasco',
  'Leite e Derivados',
  'unidade'
);
select public.migrate_catalog_product(
  'Doce Figo Ramy',
  'Doce de Figo Ramy',
  'Doces, geleias e conservas artesanais',
  'unidade'
);
select public.migrate_catalog_product(
  'Geleia laranja com pimenta',
  'Geleia de Laranja com Pimenta',
  'Doces, geleias e conservas artesanais',
  'unidade'
);
select public.migrate_catalog_product(
  'Abacaxi com pimenta',
  'Geleia de Abacaxi com Pimenta',
  'Doces, geleias e conservas artesanais',
  'unidade'
);
select public.migrate_catalog_product(
  'Amora e Morango',
  'Geleia de Amora com Morango',
  'Doces, geleias e conservas artesanais',
  'unidade'
);
select public.migrate_catalog_product(
  'Manga e Maracujá',
  'Geleia de Manga com Maracujá',
  'Doces, geleias e conservas artesanais',
  'unidade'
);
select public.migrate_catalog_product('Batata Baroa','Mandioquinha-salsa','Raízes, tubérculos e bulbos','kg');
select public.migrate_catalog_product('Batata Doce','Batata-doce','Raízes, tubérculos e bulbos','kg');
select public.migrate_catalog_product('Couve Manteiga','Couve-manteiga','Folhas e verduras','unidade');
select public.migrate_catalog_product('Couve Chinesa','Couve-chinesa','Folhas e verduras','unidade');
select public.migrate_catalog_product('Couve de Bruxelas','Couve-de-bruxelas','Brócolis, couves e repolhos','unidade');
select public.migrate_catalog_product('Banana da Terra','Banana-da-terra','Frutas','kg');
select public.migrate_catalog_product('Coco Verde','Coco-verde','Frutas','kg');
select public.migrate_catalog_product('Milho Verde','Milho-verde','Legumes','kg');

update public.products set categoria='Folhas e verduras',updated_at=now()
where categoria='Hortaliças e Folhosos' and status='active';
update public.products set categoria='Legumes',updated_at=now()
where categoria='Legumes e Frutos' and status='active';
update public.products set categoria='Raízes, tubérculos e bulbos',updated_at=now()
where categoria='Raízes e Tubérculos' and status='active';
update public.products set categoria='Brócolis, couves e repolhos',updated_at=now()
where categoria='Brássicas' and status='active';

-- Raw milk is not offered as a regular commercial catalog option.
update public.producer_inventory inventory
set ativo=false,atualizado_em=now()
from public.products product
where inventory.product_id=product.id
  and product.normalized_name=public.normalize_product_name('Leite Cru');
delete from public.producer_products link
using public.products product
where link.product_id=product.id
  and product.normalized_name=public.normalize_product_name('Leite Cru');
update public.products
set status='rejected',ativo=false,updated_at=now()
where normalized_name=public.normalize_product_name('Leite Cru');

with additions(nome,categoria,unidade) as (
  values
    ('Alho-poró','Folhas e verduras','unidade'),
    ('Alcachofra','Folhas e verduras','unidade'),
    ('Catalonha','Folhas e verduras','maço'),
    ('Escarola','Folhas e verduras','unidade'),
    ('Mostarda','Folhas e verduras','maço'),
    ('Salsão','Folhas e verduras','unidade'),
    ('Taioba','Folhas e verduras','maço'),
    ('Maxixe','Legumes','kg'),
    ('Pimenta','Legumes','kg'),
    ('Tomate Grape','Legumes','kg'),
    ('Tomate Salada','Legumes','kg'),
    ('Acerola','Frutas','kg'),
    ('Ameixa','Frutas','kg'),
    ('Amora','Frutas','kg'),
    ('Atemoia','Frutas','kg'),
    ('Caju','Frutas','kg'),
    ('Caqui','Frutas','kg'),
    ('Carambola','Frutas','kg'),
    ('Framboesa','Frutas','kg'),
    ('Fruta-do-conde','Frutas','kg'),
    ('Jabuticaba','Frutas','kg'),
    ('Jaca','Frutas','kg'),
    ('Lichia','Frutas','kg'),
    ('Mirtilo','Frutas','kg'),
    ('Nectarina','Frutas','kg'),
    ('Nêspera','Frutas','kg'),
    ('Pêssego','Frutas','kg'),
    ('Capim-cidreira','Ervas e Temperos','maço'),
    ('Endro','Ervas e Temperos','maço'),
    ('Erva-doce','Ervas e Temperos','maço'),
    ('Manjerona','Ervas e Temperos','maço')
)
insert into public.products(nome,categoria,unidade,descricao,ativo,status,normalized_name)
select nome,categoria,unidade,null,true,'active',public.normalize_product_name(nome)
from additions
on conflict do nothing;

update public.producers producer
set categorias_atendidas=coalesce((
  select array_agg(product.nome order by product.nome)
  from public.producer_products link
  join public.products product on product.id=link.product_id
  where link.producer_id=producer.id and product.status='active'
),'{}'::text[]);

drop function public.migrate_catalog_product(text,text,text,text);
