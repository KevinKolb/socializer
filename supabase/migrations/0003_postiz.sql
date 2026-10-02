-- Postiz integration: each user connects their own Postiz account (API key).
-- Channels (integrations) are synced from Postiz and the user picks which
-- ones Socializer may post to.

create table if not exists public.postiz_settings (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  base_url      text not null default 'https://api.postiz.com',
  api_key_enc   text not null,
  api_key_hint  text not null,            -- last 4 characters, for display only
  last_synced_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.postiz_channels (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  integration_id  text not null,          -- Postiz integration id
  identifier      text not null,          -- Postiz provider id: x, linkedin, facebook, ...
  name            text not null,
  profile         text,
  picture         text,
  disabled        boolean not null default false,  -- disabled on the Postiz side
  enabled         boolean not null default true,   -- Socializer may post here
  synced_at       timestamptz not null default now(),
  primary key (user_id, integration_id)
);
create index if not exists postiz_channels_user_idx on public.postiz_channels (user_id);

drop trigger if exists postiz_settings_set_updated_at on public.postiz_settings;
create trigger postiz_settings_set_updated_at before update on public.postiz_settings
  for each row execute function public.set_updated_at();

alter table public.postiz_settings enable row level security;
alter table public.postiz_channels enable row level security;

-- Settings: users may see that they are connected (never the key) and may
-- delete the connection. Writes happen server-side with the service role.
drop policy if exists "postiz_settings: read own" on public.postiz_settings;
create policy "postiz_settings: read own" on public.postiz_settings
  for select using (auth.uid() = user_id);
drop policy if exists "postiz_settings: delete own" on public.postiz_settings;
create policy "postiz_settings: delete own" on public.postiz_settings
  for delete using (auth.uid() = user_id);

revoke select on public.postiz_settings from anon, authenticated;
grant select (user_id, base_url, api_key_hint, last_synced_at, created_at, updated_at)
  on public.postiz_settings to authenticated;

-- Channels: users read and toggle their own; sync writes with the service role.
drop policy if exists "postiz_channels: read own" on public.postiz_channels;
create policy "postiz_channels: read own" on public.postiz_channels
  for select using (auth.uid() = user_id);
drop policy if exists "postiz_channels: update own" on public.postiz_channels;
create policy "postiz_channels: update own" on public.postiz_channels
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
