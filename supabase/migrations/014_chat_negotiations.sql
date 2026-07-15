-- Migration for Chat Negociações
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  demand_id uuid references public.demand_requests(id) on delete cascade,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  producer_id uuid not null references public.producers(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  
  -- Constraints
  constraint order_or_demand_not_null check (order_id is not null or demand_id is not null),
  constraint unique_order_conversation unique (order_id, buyer_id, producer_id),
  constraint unique_demand_conversation unique (demand_id, buyer_id, producer_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) <= 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz
);

-- Enable Row Level Security
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Index for conversations
create index if not exists idx_conversations_order_id on public.conversations(order_id);
create index if not exists idx_conversations_demand_id on public.conversations(demand_id);
create index if not exists idx_conversations_buyer_id on public.conversations(buyer_id);
create index if not exists idx_conversations_producer_id on public.conversations(producer_id);
create index if not exists idx_conversations_last_message_at on public.conversations(last_message_at desc);

-- Index for messages
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_sender_id on public.messages(sender_id);
create index if not exists idx_messages_created_at on public.messages(created_at asc);

-- Trigger to update conversation's last_message_at on new message insertion
create or replace function public.update_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create or replace trigger tr_update_conversation_last_message
after insert on public.messages
for each row
execute function public.update_conversation_last_message();

-- Conversations RLS Policies
create policy "buyers can access conversations" on public.conversations
  for all using (
    buyer_id in (
      select b.id from public.buyers b
      join public.profiles p on p.id = b.profile_id
      where p.user_id = auth.uid()
    )
  );

create policy "producers can access conversations" on public.conversations
  for all using (
    producer_id in (
      select pr.id from public.producers pr
      join public.profiles p on p.id = pr.profile_id
      where p.user_id = auth.uid()
    )
  );

create policy "admins can access conversations" on public.conversations
  for all using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.tipo = 'admin'
    )
  );

-- Messages RLS Policies
create policy "participants can view messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (
          c.buyer_id in (
            select b.id from public.buyers b
            join public.profiles p on p.id = b.profile_id
            where p.user_id = auth.uid()
          )
          or
          c.producer_id in (
            select pr.id from public.producers pr
            join public.profiles p on p.id = pr.profile_id
            where p.user_id = auth.uid()
          )
          or
          exists (
            select 1 from public.profiles p
            where p.user_id = auth.uid() and p.tipo = 'admin'
          )
        )
    )
  );

create policy "participants can insert messages" on public.messages
  for insert with check (
    -- The sender must be the user themselves (profiles.user_id = auth.uid())
    sender_id in (
      select id from public.profiles
      where user_id = auth.uid()
    )
    -- And the conversation must belong to them
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (
          c.buyer_id in (
            select b.id from public.buyers b
            join public.profiles p on p.id = b.profile_id
            where p.user_id = auth.uid()
          )
          or
          c.producer_id in (
            select pr.id from public.producers pr
            join public.profiles p on p.id = pr.profile_id
            where p.user_id = auth.uid()
          )
          or
          exists (
            select 1 from public.profiles p
            where p.user_id = auth.uid() and p.tipo = 'admin'
          )
        )
    )
  );

create policy "participants can update messages" on public.messages
  for update using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (
          c.buyer_id in (
            select b.id from public.buyers b
            join public.profiles p on p.id = b.profile_id
            where p.user_id = auth.uid()
          )
          or
          c.producer_id in (
            select pr.id from public.producers pr
            join public.profiles p on p.id = pr.profile_id
            where p.user_id = auth.uid()
          )
          or
          exists (
            select 1 from public.profiles p
            where p.user_id = auth.uid() and p.tipo = 'admin'
          )
        )
    )
  );

-- Enable Realtime replication for conversations and messages
alter table public.conversations replica identity full;
alter table public.messages replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.conversations;
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
