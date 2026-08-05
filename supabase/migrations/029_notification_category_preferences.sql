-- Allow users to control push delivery for system and inventory alerts.
alter table public.notification_preferences
  add column if not exists system_notifications boolean not null default true;
