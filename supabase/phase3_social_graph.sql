-- Memory Drop — Phase 3: Friend System / Social Graph
-- Run once, after supabase/phase2b_profile_polish.sql, in the Supabase SQL editor.
-- Safe to re-run: every statement is idempotent, except the CREATE FUNCTION
-- statements whose RETURNS TABLE shape changes — those DROP first (Postgres
-- won't let CREATE OR REPLACE change a function's return columns).

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('accepted', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_self_follow check (follower_id <> following_id),
  constraint unique_follow unique (follower_id, following_id)
);

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint no_self_block check (blocker_id <> blocked_id),
  constraint unique_block unique (blocker_id, blocked_id)
);

create table if not exists public.user_mutes (
  id uuid primary key default gen_random_uuid(),
  muter_id uuid not null references public.profiles (id) on delete cascade,
  muted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint no_self_mute check (muter_id <> muted_id),
  constraint unique_mute unique (muter_id, muted_id)
);

create table if not exists public.user_restrictions (
  id uuid primary key default gen_random_uuid(),
  restrictor_id uuid not null references public.profiles (id) on delete cascade,
  restricted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint no_self_restrict check (restrictor_id <> restricted_id),
  constraint unique_restriction unique (restrictor_id, restricted_id)
);

create index if not exists follows_follower_idx on public.follows (follower_id, status);
create index if not exists follows_following_idx on public.follows (following_id, status);

-- ---------------------------------------------------------------------------
-- 2. follows triggers
--
--    Status is derived, not client-set (same principle as profile_completed
--    in Phase 2): the client only ever inserts (follower_id, following_id);
--    this trigger decides accepted vs. pending from the target's privacy,
--    and rejects the insert if either side has blocked the other. It has to
--    be SECURITY DEFINER — profiles RLS only lets a user read their own row,
--    so checking a stranger's is_private (and the block tables, which are
--    similarly locked to their owner) would otherwise fail silently under
--    the caller's own RLS context.
-- ---------------------------------------------------------------------------
create or replace function public.set_follow_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_private boolean;
begin
  if exists (
    select 1 from public.user_blocks
    where (blocker_id = new.follower_id and blocked_id = new.following_id)
       or (blocker_id = new.following_id and blocked_id = new.follower_id)
  ) then
    raise exception 'You cannot follow this user.';
  end if;

  select is_private into target_private from public.profiles where id = new.following_id;
  new.status := case when coalesce(target_private, false) then 'pending' else 'accepted' end;
  return new;
end;
$$;

drop trigger if exists set_follow_status_trigger on public.follows;
create trigger set_follow_status_trigger
  before insert on public.follows
  for each row
  execute function public.set_follow_status();

-- Only two transitions are ever legitimate: nothing (insert) -> pending or
-- accepted, and pending -> accepted (an accept). Everything else — the
-- follower editing their own request, un-accepting, accepted -> pending —
-- goes through DELETE (unfollow / cancel / decline / remove-follower) and a
-- fresh INSERT instead.
create or replace function public.validate_follow_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    return new;
  end if;
  raise exception 'Invalid follow status transition.';
end;
$$;

drop trigger if exists validate_follow_transition on public.follows;
create trigger validate_follow_transition
  before update on public.follows
  for each row
  execute function public.validate_follow_status_transition();

drop trigger if exists set_follows_updated_at on public.follows;
create trigger set_follows_updated_at
  before update on public.follows
  for each row
  execute function public.set_updated_at();

-- Blocking either party severs any existing follow relationship between
-- them in both directions — matches "blocked users cannot follow" being a
-- standing rule, not just a rule at the moment of the block.
create or replace function public.cleanup_follows_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists cleanup_follows_on_block_trigger on public.user_blocks;
create trigger cleanup_follows_on_block_trigger
  after insert on public.user_blocks
  for each row
  execute function public.cleanup_follows_on_block();

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
--
--    Direct table access only ever exposes relationships the caller is a
--    party to. Anything that requires seeing another user's profile
--    alongside the relationship (search results, followers/following
--    lists, suggestions, mutual friends) goes through the SECURITY DEFINER
--    RPCs in section 4 — same split as get_profile_by_username in Phase 2.
-- ---------------------------------------------------------------------------
alter table public.follows enable row level security;

drop policy if exists "Users can view their own follow relationships" on public.follows;
create policy "Users can view their own follow relationships"
  on public.follows for select
  using (auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "Users can create their own follow requests" on public.follows;
create policy "Users can create their own follow requests"
  on public.follows for insert
  with check (auth.uid() = follower_id);

-- Only the person being followed can update a row, and only to accept —
-- enforced together with validate_follow_status_transition() above.
drop policy if exists "Users can accept requests sent to them" on public.follows;
create policy "Users can accept requests sent to them"
  on public.follows for update
  using (auth.uid() = following_id)
  with check (auth.uid() = following_id);

-- One policy covers four actions: the follower deleting their own row
-- (unfollow, or cancel a pending request) and the target deleting a row
-- (decline a pending request, or remove an accepted follower).
drop policy if exists "Users can delete follow relationships they are part of" on public.follows;
create policy "Users can delete follow relationships they are part of"
  on public.follows for delete
  using (auth.uid() = follower_id or auth.uid() = following_id);

alter table public.user_blocks enable row level security;

-- Deliberately blocker-only, not "either party": the blocked person isn't
-- shown that they've been blocked, same convention as Instagram/Twitter.
drop policy if exists "Users can view their own blocks" on public.user_blocks;
create policy "Users can view their own blocks"
  on public.user_blocks for select
  using (auth.uid() = blocker_id);

drop policy if exists "Users can block from their own account" on public.user_blocks;
create policy "Users can block from their own account"
  on public.user_blocks for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "Users can unblock their own blocks" on public.user_blocks;
create policy "Users can unblock their own blocks"
  on public.user_blocks for delete
  using (auth.uid() = blocker_id);

alter table public.user_mutes enable row level security;

drop policy if exists "Users can view their own mutes" on public.user_mutes;
create policy "Users can view their own mutes"
  on public.user_mutes for select
  using (auth.uid() = muter_id);

drop policy if exists "Users can mute from their own account" on public.user_mutes;
create policy "Users can mute from their own account"
  on public.user_mutes for insert
  with check (auth.uid() = muter_id);

drop policy if exists "Users can unmute their own mutes" on public.user_mutes;
create policy "Users can unmute their own mutes"
  on public.user_mutes for delete
  using (auth.uid() = muter_id);

alter table public.user_restrictions enable row level security;

drop policy if exists "Users can view their own restrictions" on public.user_restrictions;
create policy "Users can view their own restrictions"
  on public.user_restrictions for select
  using (auth.uid() = restrictor_id);

drop policy if exists "Users can restrict from their own account" on public.user_restrictions;
create policy "Users can restrict from their own account"
  on public.user_restrictions for insert
  with check (auth.uid() = restrictor_id);

drop policy if exists "Users can unrestrict their own restrictions" on public.user_restrictions;
create policy "Users can unrestrict their own restrictions"
  on public.user_restrictions for delete
  using (auth.uid() = restrictor_id);

-- ---------------------------------------------------------------------------
-- 4. RPCs
-- ---------------------------------------------------------------------------

-- One relationship, both directions, plus block/mute/restrict state — the
-- single source of truth FollowButton and RelationshipMenu render from.
create or replace function public.get_relationship(p_target_id uuid)
returns table (
  is_following boolean,
  is_pending boolean,
  is_followed_by boolean,
  i_blocked boolean,
  blocked_me boolean,
  i_muted boolean,
  i_restricted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    exists(select 1 from follows where follower_id = auth.uid() and following_id = p_target_id and status = 'accepted'),
    exists(select 1 from follows where follower_id = auth.uid() and following_id = p_target_id and status = 'pending'),
    exists(select 1 from follows where follower_id = p_target_id and following_id = auth.uid() and status = 'accepted'),
    exists(select 1 from user_blocks where blocker_id = auth.uid() and blocked_id = p_target_id),
    exists(select 1 from user_blocks where blocker_id = p_target_id and blocked_id = auth.uid()),
    exists(select 1 from user_mutes where muter_id = auth.uid() and muted_id = p_target_id),
    exists(select 1 from user_restrictions where restrictor_id = auth.uid() and restricted_id = p_target_id);
$$;

grant execute on function public.get_relationship(uuid) to authenticated;

-- Counts are shown even for private accounts (same as Instagram) — only
-- the follower/following *list contents* are privacy-gated, in
-- get_followers/get_following below.
create or replace function public.get_social_counts(p_profile_id uuid)
returns table (followers_count bigint, following_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from follows where following_id = p_profile_id and status = 'accepted'),
    (select count(*) from follows where follower_id = p_profile_id and status = 'accepted');
$$;

grant execute on function public.get_social_counts(uuid) to anon, authenticated;

drop function if exists public.search_users(text, int);
create function public.search_users(p_query text, p_limit int default 20)
returns table (
  id uuid, username text, display_name text, profile_photo_url text, is_private boolean,
  is_following boolean, is_pending boolean, is_followed_by boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_query is null or length(trim(p_query)) = 0 then
    return;
  end if;
  return query
    select
      p.id, p.username, p.display_name, p.profile_photo_url, p.is_private,
      exists(select 1 from follows where follower_id = auth.uid() and following_id = p.id and status = 'accepted'),
      exists(select 1 from follows where follower_id = auth.uid() and following_id = p.id and status = 'pending'),
      exists(select 1 from follows where follower_id = p.id and following_id = auth.uid() and status = 'accepted')
    from profiles p
    where p.id <> auth.uid()
      and p.username is not null
      and (p.username ilike '%' || p_query || '%' or p.display_name ilike '%' || p_query || '%')
      and p.id not in (select blocked_id from user_blocks where blocker_id = auth.uid())
      and p.id not in (select blocker_id from user_blocks where blocked_id = auth.uid())
    order by
      case
        when p.username = lower(p_query) then 0
        when p.username ilike p_query || '%' then 1
        when p.display_name ilike p_query || '%' then 2
        else 3
      end,
      p.username
    limit p_limit;
end;
$$;

grant execute on function public.search_users(text, int) to authenticated;

-- Second-degree candidates (people followed by people I follow), ranked by
-- mutual overlap; profiles with zero mutuals still fill out the list so it
-- never comes back thinner than p_limit just because mutuals are scarce.
drop function if exists public.get_suggested_friends(int);
create function public.get_suggested_friends(p_limit int default 10)
returns table (
  id uuid, username text, display_name text, profile_photo_url text, is_private boolean, mutual_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with my_following as (
    select following_id from follows where follower_id = auth.uid() and status = 'accepted'
  ),
  blocked as (
    select blocked_id as uid from user_blocks where blocker_id = auth.uid()
    union
    select blocker_id as uid from user_blocks where blocked_id = auth.uid()
  ),
  candidates as (
    select f.following_id as candidate_id, count(*) as mutual_count
    from follows f
    where f.follower_id in (select following_id from my_following)
      and f.status = 'accepted'
    group by f.following_id
  )
  select p.id, p.username, p.display_name, p.profile_photo_url, p.is_private,
    coalesce(c.mutual_count, 0) as mutual_count
  from profiles p
  left join candidates c on c.candidate_id = p.id
  where p.id <> auth.uid()
    and p.username is not null
    and p.id not in (select following_id from my_following)
    and p.id not in (select uid from blocked)
  order by mutual_count desc, p.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_suggested_friends(int) to authenticated;

create or replace function public.get_mutual_friends_count(p_target_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from follows a
  join follows b on a.following_id = b.following_id
  where a.follower_id = auth.uid() and a.status = 'accepted'
    and b.follower_id = p_target_id and b.status = 'accepted';
$$;

grant execute on function public.get_mutual_friends_count(uuid) to authenticated;

drop function if exists public.get_mutual_friends(uuid, int);
create function public.get_mutual_friends(p_target_id uuid, p_limit int default 3)
returns table (id uuid, username text, display_name text, profile_photo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.profile_photo_url
  from follows a
  join follows b on a.following_id = b.following_id
  join profiles p on p.id = a.following_id
  where a.follower_id = auth.uid() and a.status = 'accepted'
    and b.follower_id = p_target_id and b.status = 'accepted'
  limit p_limit;
$$;

grant execute on function public.get_mutual_friends(uuid, int) to authenticated;

-- get_followers / get_following: return an empty set (not an error) when
-- the viewer isn't allowed to see the list — the calling page already has
-- the target's is_private + relationship (it needed those for the profile
-- header) and uses that to tell "private, hidden" apart from "genuinely
-- has zero followers".
-- is_muted/is_restricted/i_blocked (from the viewer's side) ride along here
-- too — RelationshipMenu is shown on a viewer's own followers/following
-- lists, and needs to know the real current state to label its toggles
-- correctly (e.g. "Unmute" vs "Mute"), not assume everything starts unset.
drop function if exists public.get_followers(uuid);
create function public.get_followers(p_profile_id uuid)
returns table (
  id uuid, username text, display_name text, profile_photo_url text, is_private boolean,
  is_following boolean, is_pending boolean, is_followed_by boolean,
  is_muted boolean, is_restricted boolean, i_blocked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_private boolean;
  can_view boolean;
begin
  select p.is_private into target_private from profiles p where p.id = p_profile_id;
  if target_private is null then
    return;
  end if;
  can_view := (auth.uid() = p_profile_id) or not target_private or exists (
    select 1 from follows where follower_id = auth.uid() and following_id = p_profile_id and status = 'accepted'
  );
  if not can_view then
    return;
  end if;
  return query
    select p.id, p.username, p.display_name, p.profile_photo_url, p.is_private,
      exists(select 1 from follows where follower_id = auth.uid() and following_id = p.id and status = 'accepted'),
      exists(select 1 from follows where follower_id = auth.uid() and following_id = p.id and status = 'pending'),
      exists(select 1 from follows where follower_id = p.id and following_id = auth.uid() and status = 'accepted'),
      exists(select 1 from user_mutes where muter_id = auth.uid() and muted_id = p.id),
      exists(select 1 from user_restrictions where restrictor_id = auth.uid() and restricted_id = p.id),
      exists(select 1 from user_blocks where blocker_id = auth.uid() and blocked_id = p.id)
    from follows f
    join profiles p on p.id = f.follower_id
    where f.following_id = p_profile_id and f.status = 'accepted'
      and p.id not in (select blocked_id from user_blocks where blocker_id = auth.uid())
      and p.id not in (select blocker_id from user_blocks where blocked_id = auth.uid())
    order by p.username;
end;
$$;

grant execute on function public.get_followers(uuid) to authenticated;

drop function if exists public.get_following(uuid);
create function public.get_following(p_profile_id uuid)
returns table (
  id uuid, username text, display_name text, profile_photo_url text, is_private boolean,
  is_following boolean, is_pending boolean, is_followed_by boolean,
  is_muted boolean, is_restricted boolean, i_blocked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_private boolean;
  can_view boolean;
begin
  select p.is_private into target_private from profiles p where p.id = p_profile_id;
  if target_private is null then
    return;
  end if;
  can_view := (auth.uid() = p_profile_id) or not target_private or exists (
    select 1 from follows where follower_id = auth.uid() and following_id = p_profile_id and status = 'accepted'
  );
  if not can_view then
    return;
  end if;
  return query
    select p.id, p.username, p.display_name, p.profile_photo_url, p.is_private,
      exists(select 1 from follows where follower_id = auth.uid() and following_id = p.id and status = 'accepted'),
      exists(select 1 from follows where follower_id = auth.uid() and following_id = p.id and status = 'pending'),
      exists(select 1 from follows where follower_id = p.id and following_id = auth.uid() and status = 'accepted'),
      exists(select 1 from user_mutes where muter_id = auth.uid() and muted_id = p.id),
      exists(select 1 from user_restrictions where restrictor_id = auth.uid() and restricted_id = p.id),
      exists(select 1 from user_blocks where blocker_id = auth.uid() and blocked_id = p.id)
    from follows f
    join profiles p on p.id = f.following_id
    where f.follower_id = p_profile_id and f.status = 'accepted'
      and p.id not in (select blocked_id from user_blocks where blocker_id = auth.uid())
      and p.id not in (select blocker_id from user_blocks where blocked_id = auth.uid())
    order by p.username;
end;
$$;

grant execute on function public.get_following(uuid) to authenticated;

drop function if exists public.get_pending_requests_received();
create function public.get_pending_requests_received()
returns table (id uuid, username text, display_name text, profile_photo_url text, is_private boolean, requested_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.profile_photo_url, p.is_private, f.created_at
  from follows f
  join profiles p on p.id = f.follower_id
  where f.following_id = auth.uid() and f.status = 'pending'
  order by f.created_at desc;
$$;

grant execute on function public.get_pending_requests_received() to authenticated;

drop function if exists public.get_pending_requests_sent();
create function public.get_pending_requests_sent()
returns table (id uuid, username text, display_name text, profile_photo_url text, is_private boolean, requested_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.profile_photo_url, p.is_private, f.created_at
  from follows f
  join profiles p on p.id = f.following_id
  where f.follower_id = auth.uid() and f.status = 'pending'
  order by f.created_at desc;
$$;

grant execute on function public.get_pending_requests_sent() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. get_profile_by_username: extend privacy nulling from "owner only" to
--    "owner or accepted follower" now that follows exist, and hide the
--    profile entirely (zero rows, same as a nonexistent username) between
--    users with a block relationship in either direction. Same return
--    columns as Phase 2b, so CREATE OR REPLACE is fine here — no DROP needed.
-- ---------------------------------------------------------------------------
create or replace function public.get_profile_by_username(p_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  profile_photo_url text,
  cover_photo_url text,
  website text,
  location text,
  pronouns text,
  is_private boolean,
  profile_completed boolean,
  created_at timestamptz,
  is_own_profile boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    case when p.is_private and p.id <> auth.uid() and not exists (
      select 1 from follows where follower_id = auth.uid() and following_id = p.id and status = 'accepted'
    ) then null else p.bio end as bio,
    p.profile_photo_url,
    p.cover_photo_url,
    case when p.is_private and p.id <> auth.uid() and not exists (
      select 1 from follows where follower_id = auth.uid() and following_id = p.id and status = 'accepted'
    ) then null else p.website end as website,
    case when p.is_private and p.id <> auth.uid() and not exists (
      select 1 from follows where follower_id = auth.uid() and following_id = p.id and status = 'accepted'
    ) then null else p.location end as location,
    case when p.is_private and p.id <> auth.uid() and not exists (
      select 1 from follows where follower_id = auth.uid() and following_id = p.id and status = 'accepted'
    ) then null else p.pronouns end as pronouns,
    p.is_private,
    p.profile_completed,
    p.created_at,
    (p.id = auth.uid()) as is_own_profile
  from profiles p
  where p.username = lower(p_username)
    and not exists (
      select 1 from user_blocks
      where (blocker_id = auth.uid() and blocked_id = p.id)
         or (blocker_id = p.id and blocked_id = auth.uid())
    );
$$;

grant execute on function public.get_profile_by_username(text) to anon, authenticated;
