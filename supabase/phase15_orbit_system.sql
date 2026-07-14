-- Memory Drop — Phase 15: Replace the Follow system with Orbit.
-- Run once, after supabase/phase14v_delete_conversation.sql, in the
-- Supabase SQL editor.
--
-- This is a real rename, not a relabel: the `follows` table, its columns,
-- and every function that touches it get renamed. Two techniques, chosen
-- per statement by whether a function's RETURNS TABLE shape changes:
--
--   1. Rename-in-place (ALTER TABLE/FUNCTION/TRIGGER/INDEX ... RENAME TO)
--      followed by CREATE OR REPLACE to fix the body text. Postgres
--      preserves grants, RLS attachment, and trigger wiring automatically
--      across a rename (triggers store the function by OID, not by name),
--      so this is safe wherever the output columns aren't changing.
--   2. Drop + recreate + re-grant, required wherever RETURNS TABLE column
--      names change (e.g. is_following -> is_in_orbit) — Postgres rejects
--      CREATE OR REPLACE for an output-shape change. This fails loudly
--      with a clear dependency error if run out of order; it can't
--      silently corrupt data.
--
-- Deliberately NOT touched: the *stored* visibility-tier enum value
-- 'followers' in posts.visibility / capsules.visibility / moments.privacy /
-- user_settings.default_drop_visibility / default_moment_visibility /
-- messaging_privacy. Renaming those would mean a data migration across
-- every existing row for zero visible benefit — nobody ever sees the
-- stored string, only the label. Only the *display label* for that tier
-- becomes "Orbit" (handled in the frontend). Same for RLS policies that
-- gate visibility on posts/capsules/moments/messaging: none of them
-- reference `follows` directly — they all go through the four generic
-- helper predicates below (can_view_author_posts/can_view_drop/
-- can_view_capsule/can_message), so none of those ~20 policy files need
-- to change at all.

-- ---------------------------------------------------------------------------
-- 1. Rename the table itself, its columns, indexes, and constraints.
-- ---------------------------------------------------------------------------
alter table public.follows rename to orbits;
alter table public.orbits rename column follower_id to orbiter_id;
alter table public.orbits rename column following_id to orbiting_id;
alter table public.orbits rename constraint no_self_follow to no_self_orbit;
alter table public.orbits rename constraint unique_follow to unique_orbit;
alter index public.follows_follower_idx rename to orbits_orbiter_idx;
alter index public.follows_following_idx rename to orbits_orbiting_idx;

-- ---------------------------------------------------------------------------
-- 2. Rename RLS policies on the table (cosmetic, zero functional change —
--    policies stay attached to the table across a rename automatically).
-- ---------------------------------------------------------------------------
alter policy "Users can view their own follow relationships" on public.orbits
  rename to "Users can view their own orbit relationships";
alter policy "Users can create their own follow requests" on public.orbits
  rename to "Users can create their own orbit requests";
alter policy "Users can accept requests sent to them" on public.orbits
  rename to "Users can accept orbit requests sent to them";
alter policy "Users can delete follow relationships they are part of" on public.orbits
  rename to "Users can delete orbit relationships they are part of";

-- ---------------------------------------------------------------------------
-- 3. Trigger functions — rename-in-place, then fix body text. Triggers on
--    public.orbits keep firing automatically (they reference the function
--    by OID), no CREATE TRIGGER needed. Trigger names renamed too, purely
--    cosmetic.
-- ---------------------------------------------------------------------------
alter function public.set_follow_status() rename to set_orbit_status;

create or replace function public.set_orbit_status()
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
    where (blocker_id = new.orbiter_id and blocked_id = new.orbiting_id)
       or (blocker_id = new.orbiting_id and blocked_id = new.orbiter_id)
  ) then
    raise exception 'You cannot orbit this user.';
  end if;

  select is_private into target_private from public.profiles where id = new.orbiting_id;
  new.status := case when coalesce(target_private, false) then 'pending' else 'accepted' end;
  return new;
end;
$$;

alter trigger set_follow_status_trigger on public.orbits rename to set_orbit_status_trigger;

alter function public.validate_follow_status_transition() rename to validate_orbit_status_transition;

create or replace function public.validate_orbit_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    return new;
  end if;
  raise exception 'Invalid orbit status transition.';
end;
$$;

alter trigger validate_follow_transition on public.orbits rename to validate_orbit_transition;
alter trigger set_follows_updated_at on public.orbits rename to set_orbits_updated_at;

alter function public.cleanup_follows_on_block() rename to cleanup_orbits_on_block;

create or replace function public.cleanup_orbits_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.orbits
  where (orbiter_id = new.blocker_id and orbiting_id = new.blocked_id)
     or (orbiter_id = new.blocked_id and orbiting_id = new.blocker_id);
  return new;
end;
$$;

alter trigger cleanup_follows_on_block_trigger on public.user_blocks rename to cleanup_orbits_on_block_trigger;

alter function public.notify_on_follow() rename to notify_on_orbit;

create or replace function public.notify_on_orbit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
begin
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.orbiter_id;

  if tg_op = 'INSERT' and new.status = 'accepted' then
    perform create_notification('orbit', new.orbiter_id, new.orbiting_id, 'user', new.orbiter_id,
      'new_orbiter', v_actor_name || ' entered your Orbit.', null, '{}'::jsonb, 'new_orbiters');
  elsif tg_op = 'INSERT' and new.status = 'pending' then
    perform create_notification('orbit_request', new.orbiter_id, new.orbiting_id, 'user', new.orbiter_id,
      'orbit_request', v_actor_name || ' requested to join your Orbit.', null, '{}'::jsonb, 'orbit_requests');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform create_notification('orbit_accept', new.orbiting_id, new.orbiter_id, 'user', new.orbiting_id,
      'orbit_accepted', v_actor_name || ' accepted your Orbit request.', null, '{}'::jsonb, 'new_orbiters');
  end if;
  return new;
end;
$$;

alter trigger notify_on_follow_trigger on public.orbits rename to notify_on_orbit_trigger;

-- Drop the old constraint FIRST — it doesn't allow the new literals yet,
-- so the backfill UPDATEs below would fail against it if it were still
-- active (the old constraint only permits 'new_follower'/'follow_request'/
-- 'follow_accepted', not 'new_orbiter'/'orbit_request'/'orbit_accepted').
alter table public.notifications drop constraint if exists notifications_type_check;

-- Existing notification rows (real history, not just future inserts) still
-- carry the old type strings — the new constraint below will reject them
-- if they're not updated first. notifications_update_rules (phase11) is a
-- BEFORE UPDATE trigger that forces new.type = old.type on every update
-- (it exists to stop a client from tampering with notification content) —
-- it would silently no-op these UPDATEs, so it's disabled for this one
-- migration-only data fix and re-enabled immediately after.
alter table public.notifications disable trigger notifications_update_rules;
update public.notifications set type = 'new_orbiter' where type = 'new_follower';
update public.notifications set type = 'orbit_request' where type = 'follow_request';
update public.notifications set type = 'orbit_accepted' where type = 'follow_accepted';
alter table public.notifications enable trigger notifications_update_rules;

-- Now every row conforms to the renamed literals — safe to add the final,
-- narrower constraint.
alter table public.notifications add constraint notifications_type_check check (type in (
  'new_orbiter', 'orbit_request', 'orbit_accepted', 'mention',
  'drop_save_to_unlock', 'drop_good_vibes', 'drop_cant_wait', 'drop_interested',
  'drop_unlock_viewed', 'drop_liked', 'drop_commented', 'drop_replied', 'drop_reflected',
  'moment_viewed', 'moment_replied', 'moment_reacted',
  'capsule_unlock_reminder', 'capsule_unlocked', 'capsule_viewed', 'capsule_liked',
  'capsule_commented', 'capsule_replied', 'capsule_reflected',
  'weekly_recap', 'security_alert', 'password_changed', 'new_login', 'product_announcement',
  'new_message', 'message_reaction', 'message_request'
));

-- ---------------------------------------------------------------------------
-- 4. notification_preferences — rename the two orbit-related columns.
--    Plain column rename, preserves every user's existing preference.
-- ---------------------------------------------------------------------------
alter table public.notification_preferences rename column new_followers to new_orbiters;
alter table public.notification_preferences rename column follow_requests to orbit_requests;

-- ---------------------------------------------------------------------------
-- 5. Simple bool/text-returning functions — name changes, no output-shape
--    change, so rename-in-place + CREATE OR REPLACE is enough.
-- ---------------------------------------------------------------------------
alter function public.is_mutual_follow(uuid) rename to is_mutual_orbit;

create or replace function public.is_mutual_orbit(p_other_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p_other_id and status = 'accepted')
    and exists (select 1 from orbits where orbiter_id = p_other_id and orbiting_id = auth.uid() and status = 'accepted');
$$;

-- ---------------------------------------------------------------------------
-- 6. Functions whose name stays the same (already generic / not
--    Follow-specific) — body-only fix so every RLS policy across the
--    other ~20 migration files that calls these by name keeps working
--    completely unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_author_posts(p_author_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_author_id = auth.uid()
    or coalesce((select not is_private from profiles where id = p_author_id), false)
    or exists (
      select 1 from orbits
      where orbiter_id = auth.uid() and orbiting_id = p_author_id and status = 'accepted'
    );
$$;

create or replace function public.can_view_drop(p_owner_id uuid, p_visibility text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner_id = auth.uid()
    or (
      p_visibility = 'public' and can_view_author_posts(p_owner_id)
    )
    or (
      p_visibility = 'followers' and exists (
        select 1 from orbits
        where orbiter_id = auth.uid() and orbiting_id = p_owner_id and status = 'accepted'
      )
    );
    -- p_visibility = 'private' never matches for anyone but the owner.
    -- p_visibility literal 'followers' is the stored tier value — see the
    -- file header note on why that string itself isn't renamed.
$$;

create or replace function public.can_view_capsule(p_owner_id uuid, p_visibility text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner_id = auth.uid()
    or (
      p_visibility = 'public' and can_view_author_posts(p_owner_id)
    )
    or (
      p_visibility = 'followers' and exists (
        select 1 from orbits
        where orbiter_id = auth.uid() and orbiting_id = p_owner_id and status = 'accepted'
      )
    );
    -- p_visibility = 'only_me' never matches for anyone but the owner.
$$;

create or replace function public.can_view_moment(p_owner_id uuid, p_privacy text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner_id = auth.uid()
    or (
      p_privacy = 'everyone' and can_view_author_posts(p_owner_id)
    )
    or (
      p_privacy = 'followers' and exists (
        select 1 from orbits
        where orbiter_id = auth.uid() and orbiting_id = p_owner_id and status = 'accepted'
      )
    )
    or (
      p_privacy = 'close_friends' and exists (
        select 1 from close_friends
        where owner_id = p_owner_id and friend_id = auth.uid()
      )
    );
    -- p_privacy = 'only_me' never matches for anyone but the owner.
$$;

create or replace function public.get_moments_tray(p_limit int default 50)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  media_type text,
  mood text,
  expires_at timestamptz,
  created_at timestamptz,
  is_viewed boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.user_id, pr.username, pr.display_name, pr.profile_photo_url,
    m.media_type, m.mood, m.expires_at, m.created_at,
    exists(select 1 from moment_views mv where mv.moment_id = m.id and mv.viewer_id = auth.uid()) as is_viewed
  from moments m
  join profiles pr on pr.id = m.user_id
  where
    m.expires_at > now()
    and not is_blocked_either_way(m.user_id)
    and (
      m.user_id = auth.uid()
      or exists(select 1 from orbits f where f.orbiter_id = auth.uid() and f.orbiting_id = m.user_id and f.status = 'accepted')
    )
    and can_view_moment(m.user_id, m.privacy)
  order by
    (exists(select 1 from moment_views mv where mv.moment_id = m.id and mv.viewer_id = auth.uid())) asc,
    m.created_at desc
  limit p_limit;
$$;

create or replace function public.can_message(p_recipient_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_privacy text;
  v_allow_requests boolean;
begin
  if p_recipient_id = auth.uid() then
    return 'blocked';
  end if;
  if is_blocked_either_way(p_recipient_id) then
    return 'blocked';
  end if;

  select coalesce(messaging_privacy, 'everyone'), coalesce(allow_message_requests, true)
    into v_privacy, v_allow_requests
    from user_settings where user_id = p_recipient_id;
  v_privacy := coalesce(v_privacy, 'everyone');
  v_allow_requests := coalesce(v_allow_requests, true);

  if v_privacy = 'everyone' then
    return 'allowed';
  end if;
  if v_privacy = 'followers' and exists (
    select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p_recipient_id and status = 'accepted'
  ) then
    return 'allowed';
  end if;
  if v_privacy = 'mutual_followers' and is_mutual_orbit(p_recipient_id) then
    return 'allowed';
  end if;

  return case when v_allow_requests then 'request' else 'blocked' end;
end;
$$;

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
      select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p.id and status = 'accepted'
    ) then null else p.bio end as bio,
    p.profile_photo_url,
    p.cover_photo_url,
    case when p.is_private and p.id <> auth.uid() and not exists (
      select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p.id and status = 'accepted'
    ) then null else p.website end as website,
    case when p.is_private and p.id <> auth.uid() and not exists (
      select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p.id and status = 'accepted'
    ) then null else p.location end as location,
    case when p.is_private and p.id <> auth.uid() and not exists (
      select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p.id and status = 'accepted'
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

-- get_feed: superseded by get_drops_feed in the live app (no frontend
-- caller left — grepped, confirmed) but fixed anyway so it isn't a
-- landmine referencing a table that no longer exists. Tab key
-- 'following' is this function's own internal string, independent of the
-- frontend's DropTab enum, so it's left as-is here (nothing renames it).
create or replace function public.get_feed(p_tab text, p_limit int default 10, p_offset int default 0)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  is_private boolean,
  caption text,
  post_type text,
  video_url text,
  images jsonb,
  like_count int,
  comment_count int,
  share_count int,
  save_count int,
  is_liked boolean,
  is_saved boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select
      p.id, p.user_id, pr.username, pr.display_name, pr.profile_photo_url, pr.is_private,
      p.caption, p.post_type, p.video_url,
      coalesce(
        (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'position', pi.position) order by pi.position)
         from post_images pi where pi.post_id = p.id),
        '[]'::jsonb
      ) as images,
      p.like_count, p.comment_count, p.share_count, p.save_count,
      exists(select 1 from likes l where l.post_id = p.id and l.user_id = auth.uid()) as is_liked,
      exists(select 1 from saved_posts sp where sp.post_id = p.id and sp.user_id = auth.uid()) as is_saved,
      p.created_at
    from posts p
    join profiles pr on pr.id = p.user_id
    where
      not exists (select 1 from hidden_posts h where h.post_id = p.id and h.user_id = auth.uid())
      and not is_blocked_either_way(p.user_id)
      and (
        case p_tab
          when 'following' then (
            p.user_id = auth.uid()
            or exists (select 1 from orbits f where f.orbiter_id = auth.uid() and f.orbiting_id = p.user_id and f.status = 'accepted')
          )
          when 'discover' then not pr.is_private
          else can_view_author_posts(p.user_id) -- trending, recent
        end
      )
    order by
      case when p_tab = 'trending' then p.like_count else null end desc nulls last,
      p.created_at desc,
      p.id desc
    limit p_limit offset p_offset;
end;
$$;

-- get_drops_feed: the live 4-arg version (matches phase14s). The
-- frontend's DropTab 'following' key is being renamed to 'in_orbit' in
-- this same phase, so the p_tab branch below is renamed to match.
create or replace function public.get_drops_feed(p_tab text, p_limit int default 10, p_offset int default 0, p_post_type text default null)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  is_private boolean,
  caption text,
  post_type text,
  video_url text,
  audio_url text,
  images jsonb,
  mood text,
  visibility text,
  unlock_date timestamptz,
  is_unlocked boolean,
  like_count int,
  is_liked boolean,
  comment_count int,
  share_count int,
  save_count int,
  is_saved boolean,
  interested_count int,
  cant_wait_count int,
  good_vibes_count int,
  save_to_unlock_count int,
  is_interested boolean,
  is_cant_wait boolean,
  is_good_vibes boolean,
  is_saved_to_unlock boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select
      p.id, p.user_id, pr.username, pr.display_name, pr.profile_photo_url, pr.is_private,
      case when p.unlock_date <= now() then p.caption else null end,
      p.post_type,
      case when p.unlock_date <= now() then p.video_url else null end,
      case when p.unlock_date <= now() then p.audio_url else null end,
      case when p.unlock_date <= now() then coalesce(
        (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'position', pi.position) order by pi.position)
         from post_images pi where pi.post_id = p.id),
        '[]'::jsonb
      ) else '[]'::jsonb end as images,
      p.mood,
      p.visibility,
      p.unlock_date,
      (p.unlock_date <= now()) as is_unlocked,
      p.like_count,
      exists(select 1 from likes lk where lk.post_id = p.id and lk.user_id = auth.uid()) as is_liked,
      p.comment_count, p.share_count, p.save_count,
      exists(select 1 from saved_posts sp where sp.post_id = p.id and sp.user_id = auth.uid()) as is_saved,
      case when p.user_id = auth.uid() or coalesce(us.show_interest_counts, true) then p.interested_count else 0 end,
      case when p.user_id = auth.uid() or coalesce(us.show_interest_counts, true) then p.cant_wait_count else 0 end,
      case when p.user_id = auth.uid() or coalesce(us.show_interest_counts, true) then p.good_vibes_count else 0 end,
      case when p.user_id = auth.uid() or coalesce(us.show_interest_counts, true) then p.save_to_unlock_count else 0 end,
      exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'interested') as is_interested,
      exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'cant_wait') as is_cant_wait,
      exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'good_vibes') as is_good_vibes,
      exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'save_to_unlock') as is_saved_to_unlock,
      p.created_at
    from posts p
    join profiles pr on pr.id = p.user_id
    left join user_settings us on us.user_id = p.user_id
    where
      p.deleted_at is null
      and not exists (select 1 from hidden_posts h where h.post_id = p.id and h.user_id = auth.uid())
      and not is_blocked_either_way(p.user_id)
      and (p_post_type is null or p.post_type = p_post_type)
      and (
        case p_tab
          when 'my_drops' then p.user_id = auth.uid()
          when 'in_orbit' then
            p.user_id <> auth.uid()
            and exists(select 1 from orbits f where f.orbiter_id = auth.uid() and f.orbiting_id = p.user_id and f.status = 'accepted')
            and can_view_drop(p.user_id, p.visibility)
          when 'public_drops' then
            p.user_id <> auth.uid()
            and p.visibility = 'public'
            and not coalesce(pr.is_private, false)
          when 'unlocking_soon' then p.unlock_date > now() and can_view_drop(p.user_id, p.visibility)
          when 'today_unlocks' then p.unlock_date::date = current_date and can_view_drop(p.user_id, p.visibility)
          when 'saved_to_unlock' then
            p.unlock_date > now()
            and exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'save_to_unlock')
            and (p.user_id = auth.uid() or can_view_drop(p.user_id, p.visibility))
          else false
        end
      )
    order by
      case when p_tab in ('unlocking_soon', 'today_unlocks', 'saved_to_unlock') then p.unlock_date end asc,
      case when p_tab in ('public_drops', 'in_orbit') then p.created_at end desc,
      p.created_at desc,
      p.id desc
    limit p_limit offset p_offset;
end;
$$;

create or replace function public.notify_on_drop_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_visibility text;
  v_actor_name text;
  v_parent_author uuid;
  v_username text;
  v_mentioned_id uuid;
  v_can_view boolean;
begin
  if new.is_reflection then
    return new;
  end if;

  select user_id, visibility into v_owner_id, v_visibility from posts where id = new.post_id;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.user_id;

  if new.parent_comment_id is not null then
    select user_id into v_parent_author from comments where id = new.parent_comment_id;
    if v_parent_author is not null then
      perform create_notification('drop_reply', new.user_id, v_parent_author, 'drop', new.post_id,
        'drop_replied', v_actor_name || ' replied to your comment.', left(new.content, 140), '{}'::jsonb, 'replies');
    end if;
  else
    perform create_notification('drop_comment', new.user_id, v_owner_id, 'drop', new.post_id,
      'drop_commented', v_actor_name || ' commented on your unlocked Drop.', left(new.content, 140), '{}'::jsonb, 'comments');
  end if;

  for v_username in select (regexp_matches(new.content, '@([a-zA-Z0-9_]{3,20})\y', 'g'))[1] loop
    select id into v_mentioned_id from profiles where lower(username) = lower(v_username);
    if v_mentioned_id is null or v_mentioned_id = new.user_id then
      continue;
    end if;
    v_can_view := (
      v_owner_id = v_mentioned_id
      or (v_visibility = 'public')
      or (v_visibility = 'followers' and exists (
        select 1 from orbits where orbiter_id = v_mentioned_id and orbiting_id = v_owner_id and status = 'accepted'
      ))
    );
    if v_can_view then
      perform create_notification('mention', new.user_id, v_mentioned_id, 'drop', new.post_id,
        'mention', v_actor_name || ' mentioned you in a comment.', left(new.content, 140), '{}'::jsonb, 'mentions');
    end if;
  end loop;

  return new;
end;
$$;

create or replace function public.notify_on_capsule_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_visibility text;
  v_actor_name text;
  v_parent_author uuid;
  v_username text;
  v_mentioned_id uuid;
  v_can_view boolean;
begin
  select user_id, visibility into v_owner_id, v_visibility from capsules where id = new.capsule_id;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.user_id;

  if new.parent_comment_id is not null then
    select user_id into v_parent_author from capsule_comments where id = new.parent_comment_id;
    if v_parent_author is not null then
      perform create_notification('capsule_reply', new.user_id, v_parent_author, 'capsule', new.capsule_id,
        'capsule_replied', v_actor_name || ' replied to your comment.', left(new.content, 140), '{}'::jsonb, 'replies');
    end if;
  else
    perform create_notification('capsule_comment', new.user_id, v_owner_id, 'capsule', new.capsule_id,
      'capsule_commented', v_actor_name || ' commented on your unlocked Capsule.', left(new.content, 140), '{}'::jsonb, 'comments');
  end if;

  for v_username in select (regexp_matches(new.content, '@([a-zA-Z0-9_]{3,20})\y', 'g'))[1] loop
    select id into v_mentioned_id from profiles where lower(username) = lower(v_username);
    if v_mentioned_id is null or v_mentioned_id = new.user_id then
      continue;
    end if;
    v_can_view := (
      v_owner_id = v_mentioned_id
      or (v_visibility = 'public')
      or (v_visibility = 'followers' and exists (
        select 1 from orbits where orbiter_id = v_mentioned_id and orbiting_id = v_owner_id and status = 'accepted'
      ))
    );
    if v_can_view then
      perform create_notification('mention', new.user_id, v_mentioned_id, 'capsule', new.capsule_id,
        'mention', v_actor_name || ' mentioned you in a comment.', left(new.content, 140), '{}'::jsonb, 'mentions');
    end if;
  end loop;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Functions whose RETURNS TABLE column names change — must DROP then
--    CREATE (Postgres rejects CREATE OR REPLACE for an output-shape
--    change), then re-GRANT (DROP removes existing grants).
-- ---------------------------------------------------------------------------
drop function if exists public.get_relationship(uuid);
create function public.get_relationship(p_target_id uuid)
returns table (
  is_in_orbit boolean,
  is_orbit_pending boolean,
  is_orbiting_you boolean,
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
    exists(select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p_target_id and status = 'accepted'),
    exists(select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p_target_id and status = 'pending'),
    exists(select 1 from orbits where orbiter_id = p_target_id and orbiting_id = auth.uid() and status = 'accepted'),
    exists(select 1 from user_blocks where blocker_id = auth.uid() and blocked_id = p_target_id),
    exists(select 1 from user_blocks where blocker_id = p_target_id and blocked_id = auth.uid()),
    exists(select 1 from user_mutes where muter_id = auth.uid() and muted_id = p_target_id),
    exists(select 1 from user_restrictions where restrictor_id = auth.uid() and restricted_id = p_target_id);
$$;

grant execute on function public.get_relationship(uuid) to authenticated;

drop function if exists public.get_social_counts(uuid);
create function public.get_social_counts(p_profile_id uuid)
returns table (orbiting_count bigint, in_orbit_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from orbits where orbiting_id = p_profile_id and status = 'accepted'),
    (select count(*) from orbits where orbiter_id = p_profile_id and status = 'accepted');
$$;

grant execute on function public.get_social_counts(uuid) to anon, authenticated;

drop function if exists public.search_users(text, int);
create function public.search_users(p_query text, p_limit int default 20)
returns table (
  id uuid, username text, display_name text, profile_photo_url text, is_private boolean,
  is_in_orbit boolean, is_orbit_pending boolean, is_orbiting_you boolean
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
      exists(select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p.id and status = 'accepted'),
      exists(select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p.id and status = 'pending'),
      exists(select 1 from orbits where orbiter_id = p.id and orbiting_id = auth.uid() and status = 'accepted')
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

-- get_suggested_friends keeps its name — "Friends" stays a distinct,
-- separate concept per product decision; this RPC just needs its
-- internal orbits references fixed.
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
  with my_orbiting as (
    select orbiting_id from orbits where orbiter_id = auth.uid() and status = 'accepted'
  ),
  blocked as (
    select blocked_id as uid from user_blocks where blocker_id = auth.uid()
    union
    select blocker_id as uid from user_blocks where blocked_id = auth.uid()
  ),
  candidates as (
    select f.orbiting_id as candidate_id, count(*) as mutual_count
    from orbits f
    where f.orbiter_id in (select orbiting_id from my_orbiting)
      and f.status = 'accepted'
    group by f.orbiting_id
  )
  select p.id, p.username, p.display_name, p.profile_photo_url, p.is_private,
    coalesce(c.mutual_count, 0) as mutual_count
  from profiles p
  left join candidates c on c.candidate_id = p.id
  where p.id <> auth.uid()
    and p.username is not null
    and p.id not in (select orbiting_id from my_orbiting)
    and p.id not in (select uid from blocked)
  order by mutual_count desc, p.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_suggested_friends(int) to authenticated;

-- get_mutual_friends_count / get_mutual_friends keep their names too, same
-- reason — "Friends" (mutual orbit) is a deliberately preserved concept.
create or replace function public.get_mutual_friends_count(p_target_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from orbits a
  join orbits b on a.orbiting_id = b.orbiting_id
  where a.orbiter_id = auth.uid() and a.status = 'accepted'
    and b.orbiter_id = p_target_id and b.status = 'accepted';
$$;

drop function if exists public.get_mutual_friends(uuid, int);
create function public.get_mutual_friends(p_target_id uuid, p_limit int default 3)
returns table (id uuid, username text, display_name text, profile_photo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.profile_photo_url
  from orbits a
  join orbits b on a.orbiting_id = b.orbiting_id
  join profiles p on p.id = a.orbiting_id
  where a.orbiter_id = auth.uid() and a.status = 'accepted'
    and b.orbiter_id = p_target_id and b.status = 'accepted'
  limit p_limit;
$$;

grant execute on function public.get_mutual_friends(uuid, int) to authenticated;

drop function if exists public.get_followers(uuid);
create function public.get_orbiters(p_profile_id uuid)
returns table (
  id uuid, username text, display_name text, profile_photo_url text, is_private boolean,
  is_in_orbit boolean, is_orbit_pending boolean, is_orbiting_you boolean,
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
    select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p_profile_id and status = 'accepted'
  );
  if not can_view then
    return;
  end if;
  return query
    select p.id, p.username, p.display_name, p.profile_photo_url, p.is_private,
      exists(select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p.id and status = 'accepted'),
      exists(select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p.id and status = 'pending'),
      exists(select 1 from orbits where orbiter_id = p.id and orbiting_id = auth.uid() and status = 'accepted'),
      exists(select 1 from user_mutes where muter_id = auth.uid() and muted_id = p.id),
      exists(select 1 from user_restrictions where restrictor_id = auth.uid() and restricted_id = p.id),
      exists(select 1 from user_blocks where blocker_id = auth.uid() and blocked_id = p.id)
    from orbits f
    join profiles p on p.id = f.orbiter_id
    where f.orbiting_id = p_profile_id and f.status = 'accepted'
      and p.id not in (select blocked_id from user_blocks where blocker_id = auth.uid())
      and p.id not in (select blocker_id from user_blocks where blocked_id = auth.uid())
    order by p.username;
end;
$$;

grant execute on function public.get_orbiters(uuid) to authenticated;

drop function if exists public.get_following(uuid);
create function public.get_orbiting(p_profile_id uuid)
returns table (
  id uuid, username text, display_name text, profile_photo_url text, is_private boolean,
  is_in_orbit boolean, is_orbit_pending boolean, is_orbiting_you boolean,
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
    select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p_profile_id and status = 'accepted'
  );
  if not can_view then
    return;
  end if;
  return query
    select p.id, p.username, p.display_name, p.profile_photo_url, p.is_private,
      exists(select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p.id and status = 'accepted'),
      exists(select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p.id and status = 'pending'),
      exists(select 1 from orbits where orbiter_id = p.id and orbiting_id = auth.uid() and status = 'accepted'),
      exists(select 1 from user_mutes where muter_id = auth.uid() and muted_id = p.id),
      exists(select 1 from user_restrictions where restrictor_id = auth.uid() and restricted_id = p.id),
      exists(select 1 from user_blocks where blocker_id = auth.uid() and blocked_id = p.id)
    from orbits f
    join profiles p on p.id = f.orbiting_id
    where f.orbiter_id = p_profile_id and f.status = 'accepted'
      and p.id not in (select blocked_id from user_blocks where blocker_id = auth.uid())
      and p.id not in (select blocker_id from user_blocks where blocked_id = auth.uid())
    order by p.username;
end;
$$;

grant execute on function public.get_orbiting(uuid) to authenticated;

drop function if exists public.get_pending_requests_received();
create function public.get_orbit_requests_received()
returns table (id uuid, username text, display_name text, profile_photo_url text, is_private boolean, requested_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.profile_photo_url, p.is_private, f.created_at
  from orbits f
  join profiles p on p.id = f.orbiter_id
  where f.orbiting_id = auth.uid() and f.status = 'pending'
  order by f.created_at desc;
$$;

grant execute on function public.get_orbit_requests_received() to authenticated;

drop function if exists public.get_pending_requests_sent();
create function public.get_orbit_requests_sent()
returns table (id uuid, username text, display_name text, profile_photo_url text, is_private boolean, requested_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.profile_photo_url, p.is_private, f.created_at
  from orbits f
  join profiles p on p.id = f.orbiting_id
  where f.orbiter_id = auth.uid() and f.status = 'pending'
  order by f.created_at desc;
$$;

grant execute on function public.get_orbit_requests_sent() to authenticated;

drop function if exists public.get_memory_stats();
create function public.get_memory_stats()
returns table (
  total_drops bigint,
  locked_items bigint,
  unlocked_items bigint,
  expired_moments bigint,
  saved_to_unlock bigint,
  public_drops bigint,
  orbiting_count bigint,
  in_orbit_count bigint,
  total_views bigint,
  total_unlocks bigint,
  total_reactions bigint,
  total_comments bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from posts where user_id = auth.uid() and deleted_at is null),
    (select count(*) from memory_items_view where owner_id = auth.uid() and status = 'locked'),
    (select count(*) from memory_items_view where owner_id = auth.uid() and status in ('unlocked', 'expired')),
    (select count(*) from moments where user_id = auth.uid() and expires_at <= now()),
    (select count(*) from drop_interests di join posts p on p.id = di.drop_id where p.user_id = auth.uid() and p.deleted_at is null and di.interest_type = 'save_to_unlock'),
    (select count(*) from posts where user_id = auth.uid() and deleted_at is null and visibility = 'public'),
    (select count(*) from orbits where orbiting_id = auth.uid() and status = 'accepted'),
    (select count(*) from orbits where orbiter_id = auth.uid() and status = 'accepted'),
    (
      coalesce((select count(*) from capsule_views cv join capsules c on c.id = cv.capsule_id where c.user_id = auth.uid()), 0)
      + coalesce((select count(*) from drop_unlock_views dv join posts p on p.id = dv.drop_id where p.user_id = auth.uid() and p.deleted_at is null), 0)
      + coalesce((select count(*) from moment_views mv join moments m on m.id = mv.moment_id where m.user_id = auth.uid()), 0)
    ),
    (
      coalesce((select count(*) from capsule_unlocks cu join capsules c on c.id = cu.capsule_id where c.user_id = auth.uid()), 0)
      + coalesce((select count(*) from drop_unlock_views dv join posts p on p.id = dv.drop_id where p.user_id = auth.uid() and p.deleted_at is null), 0)
      + coalesce((select count(*) from moment_views mv join moments m on m.id = mv.moment_id where m.user_id = auth.uid()), 0)
    ),
    (
      coalesce((select sum(like_count) from posts where user_id = auth.uid() and deleted_at is null), 0)
      + coalesce((select sum(like_count) from capsules where user_id = auth.uid()), 0)
      + coalesce((select count(*) from moment_reactions mr join moments m on m.id = mr.moment_id where m.user_id = auth.uid()), 0)
      + coalesce((select count(*) from drop_interests di join posts p on p.id = di.drop_id where p.user_id = auth.uid() and p.deleted_at is null), 0)
    ),
    (
      coalesce((select sum(comment_count) from posts where user_id = auth.uid() and deleted_at is null), 0)
      + coalesce((select sum(comment_count) from capsules where user_id = auth.uid()), 0)
      + coalesce((select count(*) from moment_replies mr join moments m on m.id = mr.moment_id where m.user_id = auth.uid()), 0)
    );
$$;

grant execute on function public.get_memory_stats() to authenticated;

drop function if exists public.get_public_stats(uuid);
create function public.get_public_stats(p_user_id uuid)
returns table (
  public_memories_count bigint,
  orbiting_count bigint,
  in_orbit_count bigint,
  total_drops bigint,
  locked_items bigint,
  unlocked_items bigint,
  expired_moments bigint,
  saved_to_unlock bigint,
  public_drops bigint,
  total_views bigint,
  total_unlocks bigint,
  total_reactions bigint,
  total_comments bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      coalesce((select count(*) from posts p where p.user_id = p_user_id and p.deleted_at is null and p.visibility = 'public' and p.unlock_date <= now() and not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)), 0)
      + coalesce((select count(*) from capsules c where c.user_id = p_user_id and c.visibility = 'public' and c.unlock_date <= now() and c.hidden_at is null and not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)), 0)
      + coalesce((select count(*) from moments m where m.user_id = p_user_id and m.privacy = 'everyone' and m.expires_at <= now() and m.hidden_at is null and not is_blocked_either_way(m.user_id) and can_view_moment(m.user_id, m.privacy)), 0)
    ),
    (select count(*) from orbits where orbiting_id = p_user_id and status = 'accepted'),
    (select count(*) from orbits where orbiter_id = p_user_id and status = 'accepted'),

    case when 'total_drops' = any(vs.visible_stats) then
      (select count(*) from posts where user_id = p_user_id and deleted_at is null)
    end,
    case when 'locked_items' = any(vs.visible_stats) then
      (select count(*) from memory_items_view where owner_id = p_user_id and status = 'locked')
    end,
    case when 'unlocked_items' = any(vs.visible_stats) then
      (select count(*) from memory_items_view where owner_id = p_user_id and status in ('unlocked', 'expired'))
    end,
    case when 'expired_moments' = any(vs.visible_stats) then
      (select count(*) from moments where user_id = p_user_id and expires_at <= now())
    end,
    case when 'saved_to_unlock' = any(vs.visible_stats) then
      (select count(*) from drop_interests di join posts p on p.id = di.drop_id where p.user_id = p_user_id and p.deleted_at is null and di.interest_type = 'save_to_unlock')
    end,
    case when 'public_drops' = any(vs.visible_stats) then
      (select count(*) from posts where user_id = p_user_id and deleted_at is null and visibility = 'public')
    end,
    case when 'total_views' = any(vs.visible_stats) then
      coalesce((select count(*) from capsule_views cv join capsules c on c.id = cv.capsule_id where c.user_id = p_user_id), 0)
      + coalesce((select count(*) from drop_unlock_views dv join posts p on p.id = dv.drop_id where p.user_id = p_user_id and p.deleted_at is null), 0)
      + coalesce((select count(*) from moment_views mv join moments m on m.id = mv.moment_id where m.user_id = p_user_id), 0)
    end,
    case when 'total_unlocks' = any(vs.visible_stats) then
      coalesce((select count(*) from capsule_unlocks cu join capsules c on c.id = cu.capsule_id where c.user_id = p_user_id), 0)
      + coalesce((select count(*) from drop_unlock_views dv join posts p on p.id = dv.drop_id where p.user_id = p_user_id and p.deleted_at is null), 0)
      + coalesce((select count(*) from moment_views mv join moments m on m.id = mv.moment_id where m.user_id = p_user_id), 0)
    end,
    case when 'total_reactions' = any(vs.visible_stats) then
      coalesce((select sum(like_count) from posts where user_id = p_user_id and deleted_at is null), 0)
      + coalesce((select sum(like_count) from capsules where user_id = p_user_id), 0)
      + coalesce((select count(*) from moment_reactions mr join moments m on m.id = mr.moment_id where m.user_id = p_user_id), 0)
      + coalesce((select count(*) from drop_interests di join posts p on p.id = di.drop_id where p.user_id = p_user_id and p.deleted_at is null), 0)
    end,
    case when 'total_comments' = any(vs.visible_stats) then
      coalesce((select sum(comment_count) from posts where user_id = p_user_id and deleted_at is null), 0)
      + coalesce((select sum(comment_count) from capsules where user_id = p_user_id), 0)
      + coalesce((select count(*) from moment_replies mr join moments m on m.id = mr.moment_id where m.user_id = p_user_id), 0)
    end
  from (select coalesce((select us.visible_stats from user_settings us where us.user_id = p_user_id), '{}'::text[]) as visible_stats) vs;
$$;

grant execute on function public.get_public_stats(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Done. Nothing else needs to change: every RLS policy on posts/capsules/
-- moments/comments/messaging across the other migration files calls
-- can_view_author_posts/can_view_drop/can_view_capsule/can_view_moment/
-- can_message by name — none of those names changed, so none of those
-- policies need to be touched or re-run.
-- ---------------------------------------------------------------------------
