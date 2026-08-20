-- Track the missing-products profile task as a single resolvable notification.
alter table public.notifications
  add column if not exists resolved_at timestamptz;

create index if not exists notifications_user_unresolved_created_idx
  on public.notifications(user_id,created_at desc)
  where resolved_at is null;

create or replace function public.sync_missing_producer_products_notification()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid;
  v_key text:='producer:missing-products:'||new.id;
begin
  select p.user_id into v_user_id
  from public.profiles p
  where p.id=new.profile_id;

  if v_user_id is null then
    return new;
  end if;

  if coalesce(cardinality(new.categorias_atendidas),0)=0 then
    insert into public.notifications(
      user_id,type,title,body,data,idempotency_key,read_at,resolved_at
    ) values (
      v_user_id,
      'system',
      'Complete seu perfil',
      'Informe o que voce produz ou fornece para aparecer nas buscas e receber demandas compativeis.',
      jsonb_build_object(
        'url','/profile/producer?edit=products',
        'producerId',new.id,
        'kind','missing_products'
      ),
      v_key,
      null,
      null
    )
    on conflict(user_id,idempotency_key) do update set
      title=excluded.title,
      body=excluded.body,
      data=excluded.data,
      read_at=null,
      resolved_at=null,
      push_status='pending',
      push_attempted_at=null,
      push_attempt_count=0,
      push_last_error=null,
      created_at=now();
  else
    update public.notifications
    set resolved_at=coalesce(resolved_at,now()),
        read_at=coalesce(read_at,now())
    where user_id=v_user_id
      and idempotency_key=v_key
      and resolved_at is null;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_missing_producer_products_notification() from public;

drop trigger if exists sync_missing_products_after_insert on public.producers;
create trigger sync_missing_products_after_insert
after insert on public.producers
for each row
execute function public.sync_missing_producer_products_notification();

drop trigger if exists sync_missing_products_after_update on public.producers;
create trigger sync_missing_products_after_update
after update of categorias_atendidas on public.producers
for each row
when (old.categorias_atendidas is distinct from new.categorias_atendidas)
execute function public.sync_missing_producer_products_notification();

-- Create one unresolved task for existing active producers that still have no products.
insert into public.notifications(
  user_id,type,title,body,data,idempotency_key
)
select
  p.user_id,
  'system',
  'Complete seu perfil',
  'Informe o que voce produz ou fornece para aparecer nas buscas e receber demandas compativeis.',
  jsonb_build_object(
    'url','/profile/producer?edit=products',
    'producerId',pr.id,
    'kind','missing_products'
  ),
  'producer:missing-products:'||pr.id
from public.producers pr
join public.profiles p on p.id=pr.profile_id
where pr.ativo
  and coalesce(cardinality(pr.categorias_atendidas),0)=0
on conflict(user_id,idempotency_key) do update set
  title=excluded.title,
  body=excluded.body,
  data=excluded.data,
  read_at=null,
  resolved_at=null;
