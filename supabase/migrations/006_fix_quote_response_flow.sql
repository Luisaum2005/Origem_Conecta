drop policy if exists "quote requests readable by producers" on public.quote_requests;
drop policy if exists "quote requests response by producer" on public.quote_requests;

create policy "quote requests readable by producers" on public.quote_requests
  for select using (
    status = 'aberta'
    or producer_id in (
      select producers.id from public.producers
      join public.profiles on profiles.id = producers.profile_id
      where profiles.user_id = auth.uid()
    )
  );

create policy "quote requests response by producer" on public.quote_requests
  for update using (
    status = 'aberta'
    and producer_id is null
  )
  with check (
    status = 'respondida'
    and producer_id in (
      select producers.id from public.producers
      join public.profiles on profiles.id = producers.profile_id
      where profiles.user_id = auth.uid()
    )
  );
