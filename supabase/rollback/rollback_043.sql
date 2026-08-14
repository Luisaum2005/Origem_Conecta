-- Roll back the scoped producer membership projection introduced by migration 043.
drop function if exists public.list_my_producer_memberships();
