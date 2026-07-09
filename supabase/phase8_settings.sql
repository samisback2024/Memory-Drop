-- Memory Drop — Phase 8: Settings & Privacy.
-- Run once, after supabase/phase7_memories.sql, in the Supabase SQL
-- editor. Safe to re-run — every statement is idempotent.
--
-- Numbering note: the product brief for this phase called itself
-- "Phase 7," but Phase 7 already shipped as Memories. Everything here is
-- filed as Phase 8 instead — see the README roadmap.
--
-- Four new tables, all strictly personal (owner-only, no visibility
-- rules to reconcile with anyone else's), plus two SECURITY DEFINER
-- RPCs for the two things that genuinely need elevated privilege:
-- joining profiles for blocked/muted/restricted/close-friends lists, and
-- deleting a row from `auth.users` (which an ordinary client role can't
-- do directly, and which self-service account deletion needs).

-- ---------------------------------------------------------------------------
-- 1. user_settings — one row per user, created automatically alongside
--    their profile (trigger below), never something the client has to
--    upsert-on-first-load. Bundles Profile defaults, Appearance, and
--    Accessibility together rather than one table per settings section —
--    they're all "a handful of small preferences read on every page
--    load," not independent domains with their own lifecycle.
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  default_drop_visibility text not null default 'public' check (default_drop_visibility in ('public', 'followers', 'private')),
  default_moment_visibility text not null default 'everyone' check (default_moment_visibility in ('everyone', 'followers', 'close_friends', 'only_me')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  font_size text not null default 'medium' check (font_size in ('small', 'medium', 'large', 'xlarge')),
  reduced_motion boolean not null default false,
  high_contrast boolean not null default false,
  larger_touch_targets boolean not null default false,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Users can view their own settings" on public.user_settings;
create policy "Users can view their own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own settings" on public.user_settings;
create policy "Users can update their own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own settings" on public.user_settings;
create policy "Users can create their own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create or replace function public.touch_user_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_settings_touch_updated_at on public.user_settings;
create trigger user_settings_touch_updated_at
  before update on public.user_settings
  for each row
  execute function public.touch_user_settings_updated_at();

-- ---------------------------------------------------------------------------
-- 2. notification_preferences — store-only, per the phase's own
--    instructions: no push delivery exists yet, but every toggle here is
--    real, persisted, and ready for whichever future phase sends the
--    actual notifications.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  unlock_reminders boolean not null default true,
  new_followers boolean not null default true,
  follow_requests boolean not null default true,
  comments boolean not null default true,
  reactions boolean not null default true,
  replies boolean not null default true,
  weekly_recap boolean not null default true,
  product_updates boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "Users can view their own notification preferences" on public.notification_preferences;
create policy "Users can view their own notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own notification preferences" on public.notification_preferences;
create policy "Users can update their own notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own notification preferences" on public.notification_preferences;
create policy "Users can create their own notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

drop trigger if exists notification_preferences_touch_updated_at on public.notification_preferences;
create trigger notification_preferences_touch_updated_at
  before update on public.notification_preferences
  for each row
  execute function public.touch_user_settings_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Auto-create both rows the moment a profile exists — new signups
--    never need an upsert-on-first-load; a one-time backfill (below)
--    covers everyone who already existed before this migration.
-- ---------------------------------------------------------------------------
create or replace function public.create_default_settings_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_settings (user_id) values (new.id) on conflict do nothing;
  insert into notification_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_create_default_settings on public.profiles;
create trigger profiles_create_default_settings
  after insert on public.profiles
  for each row
  execute function public.create_default_settings_rows();

insert into user_settings (user_id) select id from profiles on conflict do nothing;
insert into notification_preferences (user_id) select id from profiles on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4. user_sessions — a self-reported login log, not a live view into
--    Supabase Auth's internal session store (the client SDK doesn't
--    expose that, and this app has no service-role backend to query it
--    with). The client inserts one row per sign-in with a best-effort
--    device label parsed from its own user agent; "Sign out of all
--    devices" is a real, separate feature (Supabase's
--    `auth.signOut({ scope: 'global' })`, which actually revokes every
--    refresh token) — this table is a history log alongside it, not what
--    powers it.
-- ---------------------------------------------------------------------------
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_label text,
  created_at timestamptz not null default now()
);

create index if not exists user_sessions_user_id_idx on public.user_sessions (user_id, created_at desc);

alter table public.user_sessions enable row level security;

drop policy if exists "Users can view their own session history" on public.user_sessions;
create policy "Users can view their own session history"
  on public.user_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can record their own sign-in" on public.user_sessions;
create policy "Users can record their own sign-in"
  on public.user_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can clear their own session history" on public.user_sessions;
create policy "Users can clear their own session history"
  on public.user_sessions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. feedback_reports — bug reports, feedback, and support requests.
--    Same one-way-mailbox discipline as Phase 4's `reports`: write-only
--    from the client, no SELECT policy at all, reviewing these is an
--    admin-tool concern explicitly out of scope for this phase.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('bug', 'feedback', 'support')),
  subject text,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_reports_user_id_idx on public.feedback_reports (user_id);

alter table public.feedback_reports enable row level security;

drop policy if exists "Users can submit feedback" on public.feedback_reports;
create policy "Users can submit feedback"
  on public.feedback_reports for insert
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. get_blocked_users / get_muted_users / get_restricted_users /
--    get_close_friends — Phase 3 and Phase 5 both stored these
--    relationships and let a client toggle them from a profile's kebab
--    menu, but never gave anyone a page listing "everyone I've blocked."
--    These four RPCs are what that Manage page in Settings needed and
--    didn't have — always "my own list," never parameterized to look at
--    anyone else's, so there's no visibility question to get wrong.
-- ---------------------------------------------------------------------------
create or replace function public.get_blocked_users()
returns table (id uuid, username text, display_name text, profile_photo_url text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.username, pr.display_name, pr.profile_photo_url, ub.created_at
  from user_blocks ub
  join profiles pr on pr.id = ub.blocked_id
  where ub.blocker_id = auth.uid()
  order by ub.created_at desc;
$$;

grant execute on function public.get_blocked_users() to authenticated;

create or replace function public.get_muted_users()
returns table (id uuid, username text, display_name text, profile_photo_url text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.username, pr.display_name, pr.profile_photo_url, um.created_at
  from user_mutes um
  join profiles pr on pr.id = um.muted_id
  where um.muter_id = auth.uid()
  order by um.created_at desc;
$$;

grant execute on function public.get_muted_users() to authenticated;

create or replace function public.get_restricted_users()
returns table (id uuid, username text, display_name text, profile_photo_url text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.username, pr.display_name, pr.profile_photo_url, ur.created_at
  from user_restrictions ur
  join profiles pr on pr.id = ur.restricted_id
  where ur.restrictor_id = auth.uid()
  order by ur.created_at desc;
$$;

grant execute on function public.get_restricted_users() to authenticated;

create or replace function public.get_close_friends()
returns table (id uuid, username text, display_name text, profile_photo_url text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.username, pr.display_name, pr.profile_photo_url, cf.created_at
  from close_friends cf
  join profiles pr on pr.id = cf.friend_id
  where cf.owner_id = auth.uid()
  order by cf.created_at desc;
$$;

grant execute on function public.get_close_friends() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. delete_my_account — a single DELETE against auth.users, which an
--    ordinary authenticated client role cannot do directly (no admin API
--    access from the browser, and no service-role backend in this app).
--    SECURITY DEFINER functions created via the SQL editor run with the
--    privileges of their owner (the project's postgres role), which does
--    have DELETE on auth.users — this is the standard self-service
--    account deletion pattern for a pure client+Supabase app. Everything
--    else (profile, posts, capsules, moments, follows, every table in
--    this schema) cascades automatically: every one of them already has
--    `user_id references profiles(id) on delete cascade`, and
--    `profiles.id references auth.users(id) on delete cascade` closes
--    the loop. Storage files are not cleaned up by this — see the
--    README's Known limitations, same caveat every delete flow in this
--    app already has.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
