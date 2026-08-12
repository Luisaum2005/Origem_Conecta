-- Safely associates a conversation with an organization when every item handled by
-- that producer in the negotiation uses the same organization. Managers receive
-- read-only access through narrow RPCs; participant RLS policies remain unchanged.
alter table public.conversations
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists conversations_organization_last_message_idx
  on public.conversations(organization_id,last_message_at desc)
  where organization_id is not null;

create or replace function public.infer_conversation_organization()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.organization_id := null;

  if new.order_id is not null then
    select max(oi.seller_organization_id::text)::uuid
    into new.organization_id
    from public.order_items oi
    where oi.order_id=new.order_id
      and oi.producer_id=new.producer_id
    having count(*) > 0
      and count(*) filter (where oi.seller_organization_id is null)=0
      and count(distinct oi.seller_organization_id)=1;
  elsif new.portfolio_product_id is not null then
    select pi.seller_organization_id
    into new.organization_id
    from public.producer_inventory pi
    where pi.id::text=new.portfolio_product_id
      and pi.producer_id=new.producer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists infer_conversation_organization_on_write on public.conversations;
create trigger infer_conversation_organization_on_write
before insert or update of order_id,producer_id,portfolio_product_id
on public.conversations
for each row execute function public.infer_conversation_organization();

with inferred as (
  select
    c.id,
    case
      when c.order_id is not null then (
        select max(oi.seller_organization_id::text)::uuid
        from public.order_items oi
        where oi.order_id=c.order_id
          and oi.producer_id=c.producer_id
        having count(*) > 0
          and count(*) filter (where oi.seller_organization_id is null)=0
          and count(distinct oi.seller_organization_id)=1
      )
      when c.portfolio_product_id is not null then (
        select pi.seller_organization_id
        from public.producer_inventory pi
        where pi.id::text=c.portfolio_product_id
          and pi.producer_id=c.producer_id
        limit 1
      )
      else null
    end as organization_id
  from public.conversations c
)
update public.conversations c
set organization_id=i.organization_id
from inferred i
where i.id=c.id
  and c.organization_id is distinct from i.organization_id;

create or replace function public.list_managed_organization_conversations(p_limit integer default 100)
returns table(
  conversation_id uuid,
  organization_id uuid,
  organization_name text,
  order_id uuid,
  buyer_name text,
  producer_name text,
  last_message_at timestamptz,
  last_message_text text,
  message_count bigint
)
language sql
stable
security definer
set search_path=public
as $$
  select
    c.id,
    o.id,
    o.trade_name,
    c.order_id,
    coalesce(nullif(trim(ord.buyer_name),''),nullif(trim(b.nome_empresa),''),bp.nome,'Comprador'),
    coalesce(nullif(trim(pr.nome_propriedade),''),nullif(trim(pr.responsavel),''),pp.nome,'Produtor'),
    c.last_message_at,
    latest.message,
    coalesce(message_totals.total,0)
  from public.conversations c
  join public.organizations o on o.id=c.organization_id
  left join public.orders ord on ord.id=c.order_id
  left join public.buyers b on b.id=c.buyer_id
  left join public.profiles bp on bp.id=b.profile_id
  left join public.producers pr on pr.id=c.producer_id
  left join public.profiles pp on pp.id=pr.profile_id
  left join lateral (
    select m.message
    from public.messages m
    where m.conversation_id=c.id and m.deleted_at is null
    order by m.created_at desc,m.id desc
    limit 1
  ) latest on true
  left join lateral (
    select count(*)::bigint as total
    from public.messages m
    where m.conversation_id=c.id and m.deleted_at is null
  ) message_totals on true
  where public.can_manage_organization(o.id)
  order by c.last_message_at desc
  limit greatest(1,least(coalesce(p_limit,100),200));
$$;

create or replace function public.list_managed_organization_messages(
  p_conversation_id uuid,
  p_limit integer default 200
)
returns table(
  message_id uuid,
  sender_kind text,
  sender_name text,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not exists (
    select 1
    from public.conversations c
    where c.id=p_conversation_id
      and c.organization_id is not null
      and public.can_manage_organization(c.organization_id)
  ) then
    raise exception 'Conversa institucional não encontrada ou sem permissão.';
  end if;

  return query
  select
    m.id,
    case
      when m.sender_id=b.profile_id then 'buyer'
      when m.sender_id=pr.profile_id then 'producer'
      else 'participant'
    end,
    case
      when m.sender_id=b.profile_id then coalesce(nullif(trim(b.nome_empresa),''),bp.nome,'Comprador')
      when m.sender_id=pr.profile_id then coalesce(nullif(trim(pr.nome_propriedade),''),nullif(trim(pr.responsavel),''),pp.nome,'Produtor')
      else coalesce(sp.nome,'Participante')
    end,
    m.message,
    m.created_at
  from public.messages m
  join public.conversations c on c.id=m.conversation_id
  left join public.buyers b on b.id=c.buyer_id
  left join public.profiles bp on bp.id=b.profile_id
  left join public.producers pr on pr.id=c.producer_id
  left join public.profiles pp on pp.id=pr.profile_id
  left join public.profiles sp on sp.id=m.sender_id
  where m.conversation_id=p_conversation_id
    and m.deleted_at is null
  order by m.created_at asc,m.id asc
  limit greatest(1,least(coalesce(p_limit,200),500));
end;
$$;

revoke all on function public.list_managed_organization_conversations(integer) from public;
revoke all on function public.list_managed_organization_messages(uuid,integer) from public;
grant execute on function public.list_managed_organization_conversations(integer) to authenticated;
grant execute on function public.list_managed_organization_messages(uuid,integer) to authenticated;
