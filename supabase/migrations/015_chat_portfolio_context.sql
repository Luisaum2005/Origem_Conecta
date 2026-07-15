-- Migration to support portfolio context in chats
alter table public.conversations
  drop constraint if exists order_or_demand_not_null;

alter table public.conversations
  add column if not exists portfolio_product_id text,
  add column if not exists conversation_context text default 'portfolio' check (conversation_context in ('portfolio', 'demand', 'order')),
  add constraint chat_context_not_null check (order_id is not null or demand_id is not null or portfolio_product_id is not null),
  add constraint unique_portfolio_conversation unique (portfolio_product_id, buyer_id, producer_id);

create index if not exists idx_conversations_portfolio_product_id on public.conversations(portfolio_product_id);
