-- Memory Drop — Phase 19: per-type interest-reaction counts on the
-- dashboard (Interested / Can't Wait / Good Vibes received), matching
-- the existing `saved_to_unlock` stat, which already computes a received
-- count on your own drops (drop_interests joined to posts you own) but
-- was mislabeled/misdescribed as "drops you've saved" — fixed here too.
-- Run once, after supabase/phase18_sparkle_drop.sql, in the Supabase SQL
-- editor.
--
-- Why this is safe even though a drop rolls off the feed 2 days after
-- unlocking (Phase 16): interested_count/cant_wait_count/good_vibes_count/
-- save_to_unlock_count live on the `posts` row itself, trigger-maintained
-- since phase4d_engagement.sql, completely independent of whether the
-- drop currently shows in any feed tab. Summing them here doesn't need
-- to "capture before it disappears" — the numbers were never at risk of
-- being lost, they're just not currently surfaced in aggregate anywhere
-- once the drop is gone from Public Drops / In Orbit.

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
  total_comments bigint,
  total_moments bigint,
  interested_received bigint,
  cant_wait_received bigint,
  good_vibes_received bigint
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
    ),
    (select count(*) from moments where user_id = auth.uid()),
    coalesce((select sum(interested_count) from posts where user_id = auth.uid() and deleted_at is null), 0),
    coalesce((select sum(cant_wait_count) from posts where user_id = auth.uid() and deleted_at is null), 0),
    coalesce((select sum(good_vibes_count) from posts where user_id = auth.uid() and deleted_at is null), 0);
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
  total_comments bigint,
  total_moments bigint,
  interested_received bigint,
  cant_wait_received bigint,
  good_vibes_received bigint
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
    end,
    case when 'total_moments' = any(vs.visible_stats) then
      (select count(*) from moments where user_id = p_user_id)
    end,
    case when 'interested_received' = any(vs.visible_stats) then
      coalesce((select sum(interested_count) from posts where user_id = p_user_id and deleted_at is null), 0)
    end,
    case when 'cant_wait_received' = any(vs.visible_stats) then
      coalesce((select sum(cant_wait_count) from posts where user_id = p_user_id and deleted_at is null), 0)
    end,
    case when 'good_vibes_received' = any(vs.visible_stats) then
      coalesce((select sum(good_vibes_count) from posts where user_id = p_user_id and deleted_at is null), 0)
    end
  from (select coalesce((select us.visible_stats from user_settings us where us.user_id = p_user_id), '{}'::text[]) as visible_stats) vs;
$$;

grant execute on function public.get_public_stats(uuid) to anon, authenticated;

-- Widen the opt-in list so these three new stats can be shown on the
-- public profile too, same as every other extra stat (default: hidden
-- until the owner opts in under Settings → Privacy).
alter table public.user_settings drop constraint if exists user_settings_visible_stats_check;
alter table public.user_settings add constraint user_settings_visible_stats_check check (
  visible_stats <@ array[
    'total_drops', 'locked_items', 'unlocked_items', 'expired_moments', 'saved_to_unlock',
    'public_drops', 'total_views', 'total_unlocks', 'total_reactions', 'total_comments', 'total_moments',
    'interested_received', 'cant_wait_received', 'good_vibes_received'
  ]
);
