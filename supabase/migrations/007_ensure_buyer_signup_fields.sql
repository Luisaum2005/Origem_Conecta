alter table public.buyers
add column if not exists cnpj text;

drop policy if exists "buyers own data" on public.buyers;

create policy "buyers own data" on public.buyers
  for all using (profile_id in (
    select id from public.profiles where user_id = auth.uid()
  ))
  with check (profile_id in (
    select id from public.profiles where user_id = auth.uid()
  ));
