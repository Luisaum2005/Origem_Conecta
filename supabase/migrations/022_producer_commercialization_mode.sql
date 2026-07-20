-- Producers may use the platform for visibility before defining a fiscal seller.
alter table public.producers
  add column commercialization_mode text not null default 'undecided'
    check (commercialization_mode in ('own','organization','undecided')),
  add column commercial_verification_status text not null default 'self_declared'
    check (commercial_verification_status in ('self_declared','pending','verified','rejected'));

create table public.producer_commercial_documents (
  producer_id uuid primary key references public.producers(id) on delete cascade,
  cnpj text,
  caepf text,
  state_registration text,
  updated_at timestamptz not null default now()
);

insert into public.producer_commercial_documents(producer_id,cnpj)
select id,cnpj from public.producers where nullif(trim(cnpj),'') is not null
on conflict(producer_id) do nothing;

-- The legacy column is kept for compatibility but no longer stores private documents.
update public.producers set cnpj=null where cnpj is not null;

alter table public.producer_commercial_documents enable row level security;
create policy "producer owns commercial documents"
on public.producer_commercial_documents
for all to authenticated
using (producer_id in (
  select pr.id from public.producers pr
  join public.profiles p on p.id=pr.profile_id
  where p.user_id=auth.uid()
))
with check (producer_id in (
  select pr.id from public.producers pr
  join public.profiles p on p.id=pr.profile_id
  where p.user_id=auth.uid()
));

comment on column public.producers.commercialization_mode is
  'How the producer expects to commercialize: own identity, an organization, or not defined yet.';
comment on column public.producers.commercial_verification_status is
  'Platform verification status; this does not represent tax or legal certification.';
