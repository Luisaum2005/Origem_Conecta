alter table public.orders
  add column if not exists confirmado_em timestamptz,
  add column if not exists saiu_entrega_em timestamptz,
  add column if not exists entregue_em timestamptz,
  add column if not exists cancelamento_limite_em timestamptz,
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_por text,
  add column if not exists motivo_cancelamento text,
  add column if not exists codigo_entrega text,
  add column if not exists codigo_recibo text,
  add column if not exists reclamacao_texto text,
  add column if not exists reclamacao_status text,
  add column if not exists reclamacao_criada_em timestamptz;

update public.orders
set cancelamento_limite_em = coalesce(cancelamento_limite_em, criado_em + interval '2 hours')
where cancelamento_limite_em is null;

update public.orders
set codigo_entrega = coalesce(codigo_entrega, lpad((floor(random() * 9000) + 1000)::int::text, 4, '0'))
where codigo_entrega is null;
