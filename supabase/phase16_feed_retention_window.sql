-- Memory Drop — Phase 16: feed retention window for unlocked Drops.
-- Run once, after supabase/phase15b_notification_events_type_fix.sql, in
-- the Supabase SQL editor.
--
-- Product decision (confirmed with product owner before writing this):
-- an unlocked Drop stays visible in the In Orbit / Public Drops discovery
-- tabs for 2 days after it unlocks, then rolls off — the drop itself is
-- never deleted, it's still permanently reachable via Memories (unaffected
-- by this migration) and via Saved Memories if the viewer bookmarked it.
-- My Drops (a user's own tab) and Capsules are explicitly NOT in scope —
-- confirmed separately; your own posting history should never disappear
-- from your own tab, and Capsules keep their existing behavior.
--
-- Grandfathered: this does NOT apply retroactively. GRANDFATHER_CUTOFF
-- below is fixed at the date this migration was written — only Drops that
-- unlock on or after that date get the 2-day window; anything already
-- unlocked before then (the vast majority of existing production content)
-- keeps showing in the feed exactly as it does today. This avoids a
-- sudden "where did my posts go" moment for real users the moment this
-- ships — confirmed as the intended behavior, not a default guess.
--
-- Saved to Unlock gets a related but separate fix: today it hides a Drop
-- the *instant* it unlocks (`unlock_date > now()`, i.e. a 0-day window),
-- which is stricter than the 2-day grace period asked for — so unlocking
-- something you'd saved could make it seem to vanish before you even see
-- it unlocked. Widened to a 2-day window post-unlock. This one has no
-- grandfathering concern: it only ever *adds* visibility for recently-
-- unlocked items, it never hides anything that's currently showing.

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
declare
  grandfather_cutoff constant timestamptz := '2026-07-14 00:00:00+00'::timestamptz;
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
            -- 2-day feed retention window (see file header) — hide only if
            -- unlocked more than 2 days ago AND unlocked on/after the
            -- grandfather cutoff (i.e. it's "new" content, not pre-existing).
            and not (
              p.unlock_date <= now() - interval '2 days'
              and p.unlock_date >= grandfather_cutoff
            )
          when 'public_drops' then
            p.user_id <> auth.uid()
            and p.visibility = 'public'
            and not coalesce(pr.is_private, false)
            and not (
              p.unlock_date <= now() - interval '2 days'
              and p.unlock_date >= grandfather_cutoff
            )
          when 'unlocking_soon' then p.unlock_date > now() and can_view_drop(p.user_id, p.visibility)
          when 'today_unlocks' then p.unlock_date::date = current_date and can_view_drop(p.user_id, p.visibility)
          when 'saved_to_unlock' then
            -- Widened from "still locked only" to "still locked, or
            -- unlocked within the last 2 days" — see file header.
            p.unlock_date >= now() - interval '2 days'
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
