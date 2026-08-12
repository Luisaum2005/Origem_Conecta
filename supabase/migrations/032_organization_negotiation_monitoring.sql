-- Read-only operational monitoring for negotiations made under an organization.
create or replace function public.list_managed_organization_negotiations()
returns table(
  order_id uuid,
  organization_id uuid,
  organization_name text,
  buyer_name text,
  order_status text,
  created_at timestamptz,
  delivery_label text,
  items jsonb
)
language sql
stable
security definer
set search_path=public
as $$
  select
    o.id,
    oi.seller_organization_id,
    max(oi.seller_organization_name),
    coalesce(nullif(trim(o.buyer_name),''),'Comprador'),
    o.status::text,
    o.criado_em,
    o.entrega_label,
    jsonb_agg(
      jsonb_build_object(
        'productName',oi.product_name,
        'quantity',oi.quantidade,
        'unit',oi.unidade,
        'producerId',oi.producer_id,
        'producerName',coalesce(nullif(trim(oi.producer_name),''),'Produtor'),
        'confirmedAt',oi.producer_confirmed_at,
        'shippedAt',oi.producer_shipped_at,
        'deliveredAt',oi.producer_delivered_at
      )
      order by oi.product_name
    )
  from public.orders o
  join public.order_items oi on oi.order_id=o.id
  where oi.seller_organization_id is not null
    and public.can_manage_organization(oi.seller_organization_id)
  group by o.id,oi.seller_organization_id,o.buyer_name,o.status,o.criado_em,o.entrega_label
  order by o.criado_em desc;
$$;

revoke all on function public.list_managed_organization_negotiations() from public;
grant execute on function public.list_managed_organization_negotiations() to authenticated;
