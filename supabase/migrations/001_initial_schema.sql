create type public.profile_type as enum ('comprador', 'produtor', 'admin');
create type public.order_status as enum ('recebido', 'em_separacao', 'em_entrega', 'entregue', 'cancelado');
create type public.risk_level as enum ('baixo', 'medio', 'alto');
create type public.quote_status as enum ('aberta', 'respondida', 'aprovada', 'recusada');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tipo public.profile_type not null,
  nome text not null,
  telefone text,
  email text,
  cidade text,
  estado text,
  criado_em timestamptz not null default now()
);

create table public.producers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  nome_propriedade text not null,
  responsavel text not null,
  cnpj text,
  localizacao text,
  categorias_atendidas text[] not null default '{}',
  score_confiabilidade numeric(3,2) not null default 0,
  taxa_entrega_no_prazo numeric(5,2) not null default 0,
  ativo boolean not null default true
);

create table public.buyers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  nome_empresa text not null,
  tipo_empresa text not null,
  fornecedor_atual text,
  gasto_medio_mensal numeric(12,2),
  ativo boolean not null default true
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null,
  unidade text not null,
  descricao text,
  emoji text,
  ativo boolean not null default true
);

create table public.product_substitutes (
  product_id uuid references public.products(id) on delete cascade,
  substitute_product_id uuid references public.products(id) on delete cascade,
  primary key (product_id, substitute_product_id)
);

create table public.producer_inventory (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid references public.producers(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  nome_produto text,
  unidade text not null default 'kg',
  quantidade_disponivel numeric(12,2) not null default 0,
  preco numeric(12,2) not null,
  data_colheita date,
  validade date,
  observacoes text,
  imagem_url text,
  ativo boolean not null default true,
  risco_falta public.risk_level not null default 'baixo',
  atualizado_em timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id) on delete cascade,
  buyer_name text,
  status public.order_status not null default 'recebido',
  subtotal numeric(12,2) not null default 0,
  delivery numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  entrega_prevista timestamptz,
  entrega_label text,
  criado_em timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_ref text,
  product_name text not null,
  quantidade numeric(12,2) not null,
  unidade text not null default 'kg',
  preco_unitario numeric(12,2) not null,
  producer_id uuid references public.producers(id),
  producer_ref text,
  producer_name text,
  escolha_manual_produtor boolean not null default false,
  line_total numeric(12,2) not null default 0
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  status text not null default 'aguardando',
  entregue_no_prazo boolean,
  data_entrega timestamptz,
  observacoes text
);

create table public.recurring_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id) on delete cascade,
  nome text not null,
  frequencia text not null,
  dia_preferido_entrega text,
  ativo boolean not null default true,
  itens jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id) on delete cascade,
  product_id uuid references public.products(id),
  nome_produto text not null,
  quantidade numeric(12,2) not null,
  unidade text not null,
  entrega_desejada date,
  preco_alvo numeric(12,2),
  observacoes text,
  status public.quote_status not null default 'aberta',
  producer_id uuid references public.producers(id),
  preco_resposta numeric(12,2),
  observacoes_resposta text,
  criado_em timestamptz not null default now(),
  respondido_em timestamptz
);

create table public.market_references (
  id uuid primary key default gen_random_uuid(),
  nome_produto text not null,
  unidade text not null default 'kg',
  preco_ceasa numeric,
  preco_conab numeric,
  preco_cepea numeric,
  tendencia text check (tendencia in ('up', 'down', 'flat')) default 'flat',
  variacao text,
  fonte text,
  data_referencia date default current_date,
  atualizado_em timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.producers enable row level security;
alter table public.buyers enable row level security;
alter table public.products enable row level security;
alter table public.product_substitutes enable row level security;
alter table public.producer_inventory enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.deliveries enable row level security;
alter table public.recurring_orders enable row level security;
alter table public.quote_requests enable row level security;
alter table public.market_references enable row level security;

create policy "profiles own row" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "products readable" on public.products for select using (true);
create policy "substitutes readable" on public.product_substitutes for select using (true);
create policy "inventory readable" on public.producer_inventory for select using (true);
create policy "producers readable" on public.producers for select using (true);

create policy "producers own insert" on public.producers
  for insert with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

create policy "producers own update" on public.producers
  for update using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

create policy "buyers own data" on public.buyers
  for all using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

create policy "orders by buyer" on public.orders
  for all using (buyer_id in (
    select buyers.id from public.buyers
    join public.profiles on profiles.id = buyers.profile_id
    where profiles.user_id = auth.uid()
  ))
  with check (buyer_id in (
    select buyers.id from public.buyers
    join public.profiles on profiles.id = buyers.profile_id
    where profiles.user_id = auth.uid()
  ));

create policy "orders by admin" on public.orders
  for all using (exists (
    select 1 from public.profiles where profiles.user_id = auth.uid() and profiles.tipo = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles where profiles.user_id = auth.uid() and profiles.tipo = 'admin'
  ));

create policy "orders readable by producer" on public.orders
  for select using (exists (
    select 1 from public.order_items
    join public.producers on producers.id = order_items.producer_id
    join public.profiles on profiles.id = producers.profile_id
    where order_items.order_id = orders.id and profiles.user_id = auth.uid()
  ));

create policy "orders status by producer" on public.orders
  for update using (exists (
    select 1 from public.order_items
    join public.producers on producers.id = order_items.producer_id
    join public.profiles on profiles.id = producers.profile_id
    where order_items.order_id = orders.id and profiles.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.order_items
    join public.producers on producers.id = order_items.producer_id
    join public.profiles on profiles.id = producers.profile_id
    where order_items.order_id = orders.id and profiles.user_id = auth.uid()
  ));

create policy "order items by order buyer" on public.order_items
  for all using (order_id in (
    select orders.id from public.orders
    join public.buyers on buyers.id = orders.buyer_id
    join public.profiles on profiles.id = buyers.profile_id
    where profiles.user_id = auth.uid()
  ))
  with check (order_id in (
    select orders.id from public.orders
    join public.buyers on buyers.id = orders.buyer_id
    join public.profiles on profiles.id = buyers.profile_id
    where profiles.user_id = auth.uid()
  ));

create policy "order items by admin" on public.order_items
  for all using (exists (
    select 1 from public.profiles where profiles.user_id = auth.uid() and profiles.tipo = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles where profiles.user_id = auth.uid() and profiles.tipo = 'admin'
  ));

create policy "order items readable by producer" on public.order_items
  for select using (producer_id in (
    select producers.id from public.producers
    join public.profiles on profiles.id = producers.profile_id
    where profiles.user_id = auth.uid()
  ));

create policy "producer inventory own write" on public.producer_inventory
  for all using (producer_id in (
    select producers.id from public.producers
    join public.profiles on profiles.id = producers.profile_id
    where profiles.user_id = auth.uid()
  ))
  with check (producer_id in (
    select producers.id from public.producers
    join public.profiles on profiles.id = producers.profile_id
    where profiles.user_id = auth.uid()
  ));

create policy "recurring orders by buyer" on public.recurring_orders
  for all using (buyer_id in (
    select buyers.id from public.buyers
    join public.profiles on profiles.id = buyers.profile_id
    where profiles.user_id = auth.uid()
  ))
  with check (buyer_id in (
    select buyers.id from public.buyers
    join public.profiles on profiles.id = buyers.profile_id
    where profiles.user_id = auth.uid()
  ));

create policy "quote requests by buyer" on public.quote_requests
  for all using (buyer_id in (
    select buyers.id from public.buyers
    join public.profiles on profiles.id = buyers.profile_id
    where profiles.user_id = auth.uid()
  ))
  with check (buyer_id in (
    select buyers.id from public.buyers
    join public.profiles on profiles.id = buyers.profile_id
    where profiles.user_id = auth.uid()
  ));

create policy "quote requests readable by producers" on public.quote_requests
  for select using (
    status in ('aberta', 'respondida', 'aprovada')
    or producer_id in (
      select producers.id from public.producers
      join public.profiles on profiles.id = producers.profile_id
      where profiles.user_id = auth.uid()
    )
  );

create policy "quote requests by admin" on public.quote_requests
  for all using (exists (
    select 1 from public.profiles where profiles.user_id = auth.uid() and profiles.tipo = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles where profiles.user_id = auth.uid() and profiles.tipo = 'admin'
  ));

create policy "quote requests response by producer" on public.quote_requests
  for update using (
    producer_id is null
    or producer_id in (
      select producers.id from public.producers
      join public.profiles on profiles.id = producers.profile_id
      where profiles.user_id = auth.uid()
    )
  );

create policy "market references readable" on public.market_references
  for select using (true);

create policy "market references by admin" on public.market_references
  for all using (exists (
    select 1 from public.profiles where profiles.user_id = auth.uid() and profiles.tipo = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles where profiles.user_id = auth.uid() and profiles.tipo = 'admin'
  ));

insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do update set public = true;

create policy "product photos readable" on storage.objects
  for select using (bucket_id = 'product-photos');

create policy "product photos by producer insert" on storage.objects
  for insert with check (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] in (
      select producers.id::text from public.producers
      join public.profiles on profiles.id = producers.profile_id
      where profiles.user_id = auth.uid()
    )
  );

create policy "product photos by producer update" on storage.objects
  for update using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] in (
      select producers.id::text from public.producers
      join public.profiles on profiles.id = producers.profile_id
      where profiles.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] in (
      select producers.id::text from public.producers
      join public.profiles on profiles.id = producers.profile_id
      where profiles.user_id = auth.uid()
    )
  );

create policy "product photos by producer delete" on storage.objects
  for delete using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] in (
      select producers.id::text from public.producers
      join public.profiles on profiles.id = producers.profile_id
      where profiles.user_id = auth.uid()
    )
  );

create or replace function public.decrement_inventory_for_order(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  inventory_id uuid;
  amount numeric;
begin
  for item in select * from jsonb_array_elements(p_items)
  loop
    begin
      inventory_id := nullif(item->>'productId', '')::uuid;
    exception
      when invalid_text_representation then
        inventory_id := null;
    end;

    amount := coalesce((item->>'quantity')::numeric, 0);

    if inventory_id is not null and amount > 0 then
      update public.producer_inventory
      set quantidade_disponivel = greatest(0, quantidade_disponivel - amount),
          atualizado_em = now()
      where id = inventory_id;
    end if;
  end loop;
end;
$$;

grant execute on function public.decrement_inventory_for_order(jsonb) to authenticated;
