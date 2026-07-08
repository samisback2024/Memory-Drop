-- Memory Drop — Phase 1: Authentication & User Accounts
-- Run this whole file once in the Supabase SQL editor (or via `supabase db push`
-- if you keep it under supabase/migrations). Safe to re-run: every statement is
-- idempotent (CREATE ... IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS first).

-- ---------------------------------------------------------------------------
-- 1. profiles table
-- ---------------------------------------------------------------------------
-- username is nullable at the DB level on purpose: Google OAuth sign-ins land
-- a row here (via the trigger below) before the user has picked a username.
-- The app forces those users through /complete-profile before /dashboard.
-- Postgres allows multiple NULLs under a UNIQUE constraint, so this doesn't
-- weaken the "username must be unique" rule for users who do have one.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  date_of_birth date,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (
    username is null or username ~ '^[a-z0-9_.]{3,20}$'
  ),
  constraint age_13_plus check (
    date_of_birth is null or date_of_birth <= (current_date - interval '13 years')
  )
);

comment on table public.profiles is 'Phase 1: one row per auth.users row. Extended with social fields in Phase 2.';

-- ---------------------------------------------------------------------------
-- 2. updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. auto-create a profile row for every new auth user
-- ---------------------------------------------------------------------------
-- Reads whatever the client passed as signUp() options.data (see
-- src/hooks/useAuth.tsx). Email/password sign-ups pass username,
-- display_name and date_of_birth up front. Google OAuth sign-ups pass none
-- of these — the row is created with just the id, and the app's
-- ProtectedRoute sends the user to /complete-profile until username and
-- date_of_birth are filled in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, date_of_birth)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'date_of_birth', '')::date
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. username availability check (callable by signed-out visitors)
-- ---------------------------------------------------------------------------
-- Runs as a narrow SECURITY DEFINER function instead of relying on the
-- broader "public read" RLS policy below, so the availability check keeps
-- working even if that policy is ever tightened.
create or replace function public.is_username_available(check_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    check_username ~ '^[a-z0-9_.]{3,20}$'
    and not exists (
      select 1 from public.profiles where username = lower(check_username)
    );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No delete policy: profiles are removed automatically via
-- `on delete cascade` when the underlying auth.users row is deleted.
