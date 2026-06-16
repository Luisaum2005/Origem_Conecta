alter table public.orders
  add column if not exists payment_method text,
  add column if not exists payment_notes text;

create table if not exists public.demand_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id) on delete cascade,
  buyer_name text not null,
  delivery_date date not null,
  urgency text not null default 'normal',
  status text not null default 'aberta',
  payment_method text,
  payment_notes text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.demand_items (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.demand_requests(id) on delete cascade,
  product_name text not null,
  quantity numeric not null default 0,
  unit text not null default 'kg',
  product_state text not null default 'Indiferente',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.demand_responses (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.demand_requests(id) on delete cascade,
  producer_id uuid not null references public.producers(id) on delete cascade,
  producer_name text not null,
  status text not null default 'enviada',
  notes text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (demand_id, producer_id)
);

create table if not exists public.demand_response_items (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.demand_responses(id) on delete cascade,
  demand_item_id uuid references public.demand_items(id) on delete set null,
  product_name text not null,
  quantity numeric not null default 0,
  unit text not null default 'kg',
  price numeric not null default 0,
  can_supply boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists origem_demanda_id uuid references public.demand_requests(id);

alter table public.demand_requests enable row level security;
alter table public.demand_items enable row level security;
alter table public.demand_responses enable row level security;
alter table public.demand_response_items enable row level security;

drop policy if exists "Demandas visiveis por perfil" on public.demand_requests;
create policy "Demandas visiveis por perfil"
on public.demand_requests for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.tipo in ('produtor', 'admin')
        or exists (
          select 1 from public.buyers b
          where b.id = demand_requests.buyer_id and b.profile_id = p.id
        )
      )
  )
);

drop policy if exists "Comprador cria demanda" on public.demand_requests;
create policy "Comprador cria demanda"
on public.demand_requests for insert
to authenticated
with check (
  exists (
    select 1 from public.buyers b
    join public.profiles p on p.id = b.profile_id
    where b.id = buyer_id and p.user_id = auth.uid() and p.tipo = 'comprador'
  )
);

drop policy if exists "Comprador atualiza propria demanda" on public.demand_requests;
create policy "Comprador atualiza propria demanda"
on public.demand_requests for update
to authenticated
using (
  exists (
    select 1 from public.buyers b
    join public.profiles p on p.id = b.profile_id
    where b.id = demand_requests.buyer_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.buyers b
    join public.profiles p on p.id = b.profile_id
    where b.id = demand_requests.buyer_id and p.user_id = auth.uid()
  )
);

drop policy if exists "Itens visiveis por demanda" on public.demand_items;
create policy "Itens visiveis por demanda"
on public.demand_items for select
to authenticated
using (
  exists (
    select 1 from public.demand_requests d
    where d.id = demand_items.demand_id
  )
);

drop policy if exists "Comprador cria itens da demanda" on public.demand_items;
create policy "Comprador cria itens da demanda"
on public.demand_items for insert
to authenticated
with check (
  exists (
    select 1 from public.demand_requests d
    join public.buyers b on b.id = d.buyer_id
    join public.profiles p on p.id = b.profile_id
    where d.id = demand_items.demand_id and p.user_id = auth.uid()
  )
);

drop policy if exists "Respostas visiveis por perfil" on public.demand_responses;
create policy "Respostas visiveis por perfil"
on public.demand_responses for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.tipo = 'admin'
        or exists (
          select 1 from public.producers pr
          where pr.id = demand_responses.producer_id and pr.profile_id = p.id
        )
        or exists (
          select 1 from public.demand_requests d
          join public.buyers b on b.id = d.buyer_id
          where d.id = demand_responses.demand_id and b.profile_id = p.id
        )
      )
  )
);

drop policy if exists "Produtor responde demanda aberta" on public.demand_responses;
create policy "Produtor responde demanda aberta"
on public.demand_responses for insert
to authenticated
with check (
  exists (
    select 1 from public.producers pr
    join public.profiles p on p.id = pr.profile_id
    join public.demand_requests d on d.id = demand_id
    where pr.id = producer_id and p.user_id = auth.uid() and d.status in ('aberta', 'respondida')
  )
);

drop policy if exists "Comprador aprova resposta" on public.demand_responses;
create policy "Comprador aprova resposta"
on public.demand_responses for update
to authenticated
using (
  exists (
    select 1 from public.demand_requests d
    join public.buyers b on b.id = d.buyer_id
    join public.profiles p on p.id = b.profile_id
    where d.id = demand_responses.demand_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.demand_requests d
    join public.buyers b on b.id = d.buyer_id
    join public.profiles p on p.id = b.profile_id
    where d.id = demand_responses.demand_id and p.user_id = auth.uid()
  )
);

drop policy if exists "Itens de resposta visiveis" on public.demand_response_items;
create policy "Itens de resposta visiveis"
on public.demand_response_items for select
to authenticated
using (
  exists (
    select 1 from public.demand_responses r
    where r.id = demand_response_items.response_id
  )
);

drop policy if exists "Produtor cria itens de resposta" on public.demand_response_items;
create policy "Produtor cria itens de resposta"
on public.demand_response_items for insert
to authenticated
with check (
  exists (
    select 1 from public.demand_responses r
    join public.producers pr on pr.id = r.producer_id
    join public.profiles p on p.id = pr.profile_id
    where r.id = demand_response_items.response_id and p.user_id = auth.uid()
  )
);
