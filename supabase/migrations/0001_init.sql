-- Socializer schema
-- Run with: supabase db push   (or paste into the Supabase SQL editor)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text,
  display_name        text,
  timezone            text not null default 'UTC',
  daily_item_target   int  not null default 12 check (daily_item_target between 3 and 40),
  voice               text not null default 'Conversational, concise, no hype.',
  stripe_customer_id  text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Interests: what the AI should go looking for
-- ---------------------------------------------------------------------------
create table if not exists public.interests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  topic       text not null,
  guidance    text,                                   -- e.g. "focus on indie devs, avoid politics"
  sources     text[] not null default '{news,blogs,x,reddit}',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists interests_user_idx on public.interests (user_id);

-- ---------------------------------------------------------------------------
-- Platform connections (X first; more later)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_connections (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  platform            text not null check (platform in ('x')),
  enabled             boolean not null default true,
  platform_user_id    text,
  platform_username   text,
  access_token_enc    text not null,
  refresh_token_enc   text,
  token_expires_at    timestamptz,
  scopes              text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, platform)
);

-- ---------------------------------------------------------------------------
-- Content items: the cards a user swipes on
-- ---------------------------------------------------------------------------
create table if not exists public.content_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  interest_id     uuid references public.interests (id) on delete set null,
  batch_date      date not null default current_date,
  title           text not null,
  summary         text not null,
  source_url      text,
  source_name     text,
  why_relevant    text,
  suggested_post  text not null,
  hashtags        text[] not null default '{}',
  status          text not null default 'pending'
                  check (status in ('pending','skipped','approved','posted','failed')),
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists content_items_user_status_idx on public.content_items (user_id, status, created_at desc);
create index if not exists content_items_user_batch_idx  on public.content_items (user_id, batch_date);

-- ---------------------------------------------------------------------------
-- Posts: what actually went out to a platform
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  content_item_id   uuid not null references public.content_items (id) on delete cascade,
  platform          text not null,
  platform_post_id  text,
  posted_text       text not null,
  status            text not null check (status in ('posted','failed')),
  error             text,
  posted_at         timestamptz not null default now()
);
create index if not exists posts_user_idx on public.posts (user_id, posted_at desc);

-- ---------------------------------------------------------------------------
-- Gather runs: one row per discovery job (cron or manual)
-- ---------------------------------------------------------------------------
create table if not exists public.gather_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  trigger        text not null check (trigger in ('cron','manual')),
  status         text not null default 'running' check (status in ('running','done','failed')),
  items_created  int  not null default 0,
  error          text,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz
);
create index if not exists gather_runs_user_idx on public.gather_runs (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Subscriptions (mirrored from Stripe via webhook)
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id                 uuid primary key references public.profiles (id) on delete cascade,
  stripe_subscription_id  text unique,
  status                  text not null,            -- trialing, active, past_due, canceled, ...
  price_id                text,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists platform_connections_set_updated_at on public.platform_connections;
create trigger platform_connections_set_updated_at before update on public.platform_connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile when a user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security: every user sees only their own rows.
-- The service-role key (used by cron + webhooks) bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.interests            enable row level security;
alter table public.platform_connections enable row level security;
alter table public.content_items        enable row level security;
alter table public.posts                enable row level security;
alter table public.gather_runs          enable row level security;
alter table public.subscriptions        enable row level security;

drop policy if exists "profiles: own" on public.profiles;
create policy "profiles: own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "interests: own" on public.interests;
create policy "interests: own" on public.interests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Users may read + toggle + delete their connections, but tokens are written
-- only by the server (service role) during the OAuth callback.
drop policy if exists "connections: read own" on public.platform_connections;
create policy "connections: read own" on public.platform_connections
  for select using (auth.uid() = user_id);
drop policy if exists "connections: update own" on public.platform_connections;
create policy "connections: update own" on public.platform_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "connections: delete own" on public.platform_connections;
create policy "connections: delete own" on public.platform_connections
  for delete using (auth.uid() = user_id);

drop policy if exists "content_items: own" on public.content_items;
create policy "content_items: own" on public.content_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "posts: read own" on public.posts;
create policy "posts: read own" on public.posts
  for select using (auth.uid() = user_id);

drop policy if exists "gather_runs: read own" on public.gather_runs;
create policy "gather_runs: read own" on public.gather_runs
  for select using (auth.uid() = user_id);

drop policy if exists "subscriptions: read own" on public.subscriptions;
create policy "subscriptions: read own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Hide encrypted tokens from browser-facing clients entirely.
-- Table-level SELECT is removed and re-granted per column, so `select *`
-- fails for the anon/authenticated roles and the app must name columns.
revoke select on public.platform_connections from anon, authenticated;
grant select (id, user_id, platform, enabled, platform_user_id, platform_username,
              token_expires_at, scopes, created_at, updated_at)
  on public.platform_connections to authenticated;
