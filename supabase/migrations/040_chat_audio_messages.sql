-- Private audio messages for conversations. Files remain accessible only to
-- authenticated conversation participants through short-lived signed URLs.

alter table public.messages
  add column if not exists message_type text not null default 'text',
  add column if not exists audio_path text,
  add column if not exists audio_duration_seconds integer,
  add column if not exists audio_mime_type text;

alter table public.messages drop constraint if exists messages_content_valid;
alter table public.messages add constraint messages_content_valid check (
  (
    message_type='text'
    and audio_path is null
    and audio_duration_seconds is null
    and audio_mime_type is null
  )
  or
  (
    message_type='audio'
    and audio_path is not null
    and audio_path like conversation_id::text || '/%'
    and audio_duration_seconds between 1 and 120
    and audio_mime_type in ('audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav')
  )
) not valid;

alter table public.messages validate constraint messages_content_valid;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'chat-audio','chat-audio',false,10485760,
  array['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "chat participants read audio" on storage.objects;
create policy "chat participants read audio" on storage.objects
for select to authenticated
using (
  bucket_id='chat-audio'
  and exists (
    select 1
    from public.conversations c
    where c.id::text=(storage.foldername(name))[1]
      and (
        exists (
          select 1 from public.buyers b
          join public.profiles p on p.id=b.profile_id
          where b.id=c.buyer_id and p.user_id=auth.uid()
        )
        or exists (
          select 1 from public.producers pr
          join public.profiles p on p.id=pr.profile_id
          where pr.id=c.producer_id and p.user_id=auth.uid()
        )
        or exists (
          select 1 from public.profiles p
          where p.user_id=auth.uid() and p.tipo='admin'
        )
      )
  )
);

drop policy if exists "chat participants upload audio" on storage.objects;
create policy "chat participants upload audio" on storage.objects
for insert to authenticated
with check (
  bucket_id='chat-audio'
  and exists (
    select 1
    from public.conversations c
    where c.id::text=(storage.foldername(name))[1]
      and (
        exists (
          select 1 from public.buyers b
          join public.profiles p on p.id=b.profile_id
          where b.id=c.buyer_id and p.user_id=auth.uid()
        )
        or exists (
          select 1 from public.producers pr
          join public.profiles p on p.id=pr.profile_id
          where pr.id=c.producer_id and p.user_id=auth.uid()
        )
        or exists (
          select 1 from public.profiles p
          where p.user_id=auth.uid() and p.tipo='admin'
        )
      )
  )
);

drop policy if exists "audio owner deletes own file" on storage.objects;
create policy "audio owner deletes own file" on storage.objects
for delete to authenticated
using (bucket_id='chat-audio' and owner_id=auth.uid()::text);
