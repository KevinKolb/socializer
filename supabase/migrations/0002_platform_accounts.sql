-- Platform accounts: the handle a user has on each platform, recorded before
-- (and independently of) an OAuth connection. platform_connections still holds
-- tokens for platforms where posting is live.

create table if not exists public.platform_accounts (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  platform    text not null,
  username    text not null check (char_length(username) between 1 and 100),
  updated_at  timestamptz not null default now(),
  primary key (user_id, platform)
);

alter table public.platform_accounts enable row level security;

drop policy if exists "platform_accounts: own" on public.platform_accounts;
create policy "platform_accounts: own" on public.platform_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists platform_accounts_set_updated_at on public.platform_accounts;
create trigger platform_accounts_set_updated_at before update on public.platform_accounts
  for each row execute function public.set_updated_at();
