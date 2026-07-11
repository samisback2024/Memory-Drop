-- Phase 14g — opt-in public visibility for Memory Stats.
--
-- Context: ProfileStatsCard (the 12-tile "Memory Stats" grid on your own
-- Profile page) already never renders for anyone but the owner —
-- get_memory_stats() has no target-user parameter, always auth.uid().
-- Visitors only ever saw get_public_stats()'s 3 fields (public content
-- count, followers, following). This migration adds an explicit,
-- opt-in way to reveal any of the other 10 stats to visitors too —
-- nothing changes automatically; every stat stays hidden from
-- everyone but the owner until the owner checks it on in Settings.
--
-- followers_count/following_count are deliberately NOT part of this
-- opt-in set — they're already unconditionally public (a near-universal
-- expectation on any social app, and already exposed via a separate,
-- unrelated component), so this only governs the 10 more personal
-- engagement/content stats.

alter table public.user_settings add column if not exists visible_stats text[] not null default '{}';

alter table public.user_settings drop constraint if exists user_settings_visible_stats_check;
alter table public.user_settings add constraint user_settings_visible_stats_check check (
  visible_stats <@ array[
    'total_drops', 'locked_items', 'unlocked_items', 'expired_moments', 'saved_to_unlock',
    'public_drops', 'total_views', 'total_unlocks', 'total_reactions', 'total_comments'
  ]
) not valid;
alter table public.user_settings validate constraint user_settings_visible_stats_check;

-- get_public_stats' OUT columns are widening (3 -> 13), which CREATE OR
-- REPLACE can't do — Postgres requires the old signature dropped first.
drop function if exists public.get_public_stats(uuid);

create function public.get_public_stats(p_user_id uuid)
returns table (
  public_memories_count bigint,
  followers_count bigint,
  following_count bigint,
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
      coalesce((select count(*) from posts p where p.user_id = p_user_id and p.visibility = 'public' and p.unlock_date <= now() and not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)), 0)
      + coalesce((select count(*) from capsules c where c.user_id = p_user_id and c.visibility = 'public' and c.unlock_date <= now() and c.hidden_at is null and not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)), 0)
      + coalesce((select count(*) from moments m where m.user_id = p_user_id and m.privacy = 'everyone' and m.expires_at <= now() and m.hidden_at is null and not is_blocked_either_way(m.user_id) and can_view_moment(m.user_id, m.privacy)), 0)
    ),
    (select count(*) from follows where following_id = p_user_id and status = 'accepted'),
    (select count(*) from follows where follower_id = p_user_id and status = 'accepted'),

    case when 'total_drops' = any(vs.visible_stats) then
      (select count(*) from posts where user_id = p_user_id)
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
      (select count(*) from drop_interests di join posts p on p.id = di.drop_id where p.user_id = p_user_id and di.interest_type = 'save_to_unlock')
    end,
    case when 'public_drops' = any(vs.visible_stats) then
      (select count(*) from posts where user_id = p_user_id and visibility = 'public')
    end,
    case when 'total_views' = any(vs.visible_stats) then
      coalesce((select count(*) from capsule_views cv join capsules c on c.id = cv.capsule_id where c.user_id = p_user_id), 0)
      + coalesce((select count(*) from drop_unlock_views dv join posts p on p.id = dv.drop_id where p.user_id = p_user_id), 0)
      + coalesce((select count(*) from moment_views mv join moments m on m.id = mv.moment_id where m.user_id = p_user_id), 0)
    end,
    case when 'total_unlocks' = any(vs.visible_stats) then
      coalesce((select count(*) from capsule_unlocks cu join capsules c on c.id = cu.capsule_id where c.user_id = p_user_id), 0)
      + coalesce((select count(*) from drop_unlock_views dv join posts p on p.id = dv.drop_id where p.user_id = p_user_id), 0)
      + coalesce((select count(*) from moment_views mv join moments m on m.id = mv.moment_id where m.user_id = p_user_id), 0)
    end,
    case when 'total_reactions' = any(vs.visible_stats) then
      coalesce((select sum(like_count) from posts where user_id = p_user_id), 0)
      + coalesce((select sum(like_count) from capsules where user_id = p_user_id), 0)
      + coalesce((select count(*) from moment_reactions mr join moments m on m.id = mr.moment_id where m.user_id = p_user_id), 0)
      + coalesce((select count(*) from drop_interests di join posts p on p.id = di.drop_id where p.user_id = p_user_id), 0)
    end,
    case when 'total_comments' = any(vs.visible_stats) then
      coalesce((select sum(comment_count) from posts where user_id = p_user_id), 0)
      + coalesce((select sum(comment_count) from capsules where user_id = p_user_id), 0)
      + coalesce((select count(*) from moment_replies mr join moments m on m.id = mr.moment_id where m.user_id = p_user_id), 0)
    end
  from (select coalesce((select us.visible_stats from user_settings us where us.user_id = p_user_id), '{}'::text[]) as visible_stats) vs;
$$;

grant execute on function public.get_public_stats(uuid) to anon, authenticated;
