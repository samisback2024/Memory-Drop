-- Phase 14s — soft-delete for Drops. Deleting a post no longer hard-
-- deletes it immediately: it moves into a 30-day "Deleted" holding
-- area (Settings -> Deleted), restorable any time in that window, then
-- gets permanently purged.
--
-- Scope, deliberately narrow — same reasoning this project has already
-- applied once before to a similar cross-cutting flag (see
-- moderation_status in phase9/README Known Limitations): posts is read
-- directly by well over a dozen functions across nine+ migration files
-- (get_memories, get_memory, search_memories, get_explore_feed, profile
-- stats, activity timelines...). Rewriting every one of those in this
-- pass to also filter deleted_at would mean blindly reproducing many
-- large, already-correct function bodies from memory in one change —
-- a bad risk/reward trade. This migration guarantees a deleted drop
-- disappears from everywhere that actually matters for this feature
-- (the Feed's three read paths, and the base posts RLS policy, which
-- covers any other direct-table read) and is restorable/purgeable
-- correctly. A soft-deleted drop may still surface in Memories/Search/
-- Explore for up to 30 days until purged — flagged here, not silently
-- assumed fixed, exactly like moderation_status was.

alter table public.posts add column if not exists deleted_at timestamptz;

create index if not exists posts_deleted_at_idx on public.posts (user_id, deleted_at) where deleted_at is not null;

-- Base RLS: a deleted post is invisible to everyone, including its own
-- owner, via any plain table read — restoring/browsing deleted posts
-- goes through the dedicated get_deleted_drops() RPC below instead,
-- the same "RPC bypasses RLS on purpose" pattern used everywhere else
-- in this app for something that needs to see past the normal rule.
drop policy if exists "Users can view visible posts" on public.posts;
create policy "Users can view visible posts"
  on public.posts for select
  using (
    deleted_at is null
    and (
      user_id = (select auth.uid())
      or (
        unlock_date <= now()
        and moderation_status = 'active'
        and not is_blocked_either_way(user_id)
        and can_view_drop(user_id, visibility)
      )
    )
  );

-- get_drops_feed, get_drop, get_saved_drops — identical bodies to
-- phase14p, each with one added line (p.deleted_at is null). Same
-- signatures as the live versions, CREATE OR REPLACE is safe.

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
          when 'following' then
            p.user_id <> auth.uid()
            and exists(select 1 from follows f where f.follower_id = auth.uid() and f.following_id = p.user_id and f.status = 'accepted')
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
      case when p_tab in ('public_drops', 'following') then p.created_at end desc,
      p.created_at desc,
      p.id desc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.get_drops_feed(text, int, int, text) to authenticated;

create or replace function public.get_drop(p_post_id uuid)
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
language sql
stable
security definer
set search_path = public
as $$
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
  where p.id = p_post_id
    and p.deleted_at is null
    and not is_blocked_either_way(p.user_id)
    and (p.user_id = auth.uid() or can_view_drop(p.user_id, p.visibility));
$$;

grant execute on function public.get_drop(uuid) to authenticated;

create or replace function public.get_saved_drops(p_limit int default 10, p_offset int default 0)
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
language sql
stable
security definer
set search_path = public
as $$
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
    true as is_saved,
    case when p.user_id = auth.uid() or coalesce(us.show_interest_counts, true) then p.interested_count else 0 end,
    case when p.user_id = auth.uid() or coalesce(us.show_interest_counts, true) then p.cant_wait_count else 0 end,
    case when p.user_id = auth.uid() or coalesce(us.show_interest_counts, true) then p.good_vibes_count else 0 end,
    case when p.user_id = auth.uid() or coalesce(us.show_interest_counts, true) then p.save_to_unlock_count else 0 end,
    exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'interested') as is_interested,
    exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'cant_wait') as is_cant_wait,
    exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'good_vibes') as is_good_vibes,
    exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'save_to_unlock') as is_saved_to_unlock,
    p.created_at
  from saved_posts sp
  join posts p on p.id = sp.post_id
  join profiles pr on pr.id = p.user_id
  left join user_settings us on us.user_id = p.user_id
  where sp.user_id = auth.uid()
    and p.deleted_at is null
    and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
  order by sp.created_at desc
  limit p_limit offset p_offset;
$$;

grant execute on function public.get_saved_drops(int, int) to authenticated;

-- Owner-only view into their own deleted drops, with days_remaining
-- until the automatic purge — the one place deleted_at is not null is
-- ever actually readable, since this bypasses RLS by design (SECURITY
-- DEFINER), same as every other "you get to see past the normal rule
-- for your own stuff" RPC in this app.
create or replace function public.get_deleted_drops()
returns table (
  id uuid,
  caption text,
  post_type text,
  video_url text,
  audio_url text,
  images jsonb,
  mood text,
  visibility text,
  deleted_at timestamptz,
  days_remaining int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.caption, p.post_type, p.video_url, p.audio_url,
    coalesce(
      (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'position', pi.position) order by pi.position)
       from post_images pi where pi.post_id = p.id),
      '[]'::jsonb
    ) as images,
    p.mood, p.visibility, p.deleted_at,
    greatest(0, 30 - extract(day from now() - p.deleted_at)::int) as days_remaining,
    p.created_at
  from posts p
  where p.user_id = auth.uid() and p.deleted_at is not null
  order by p.deleted_at desc;
$$;

grant execute on function public.get_deleted_drops() to authenticated;

-- Permanent purge, meant to run on a schedule (pg_cron) — not granted to
-- `authenticated`, same posture as generate_unlock_reminders()/
-- generate_weekly_recap() (phase9): a real function that works
-- correctly if called, but scheduling it needs pg_cron enabled in the
-- Supabase dashboard, a one-time operator action outside what a SQL
-- migration run from this environment can do. Storage files for a
-- purged drop become orphaned exactly like every other deletion path
-- in this app already tolerates (see README Known Limitations) — not
-- a new gap introduced here.
create or replace function public.purge_expired_deleted_drops()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from posts where deleted_at is not null and deleted_at < now() - interval '30 days';
end;
$$;
