-- Removes everything created by migrations/0001_init.sql.
-- WARNING: drops all Socializer data. Only run this in a project where
-- `profiles`, `handle_new_user` and `set_updated_at` were created by Socializer.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists
  public.posts, public.gather_runs, public.content_items,
  public.platform_connections, public.interests, public.subscriptions
  cascade;
drop table if exists public.profiles cascade;
drop function if exists public.set_updated_at();
