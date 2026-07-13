-- Phase 14o — auto-promote a "Saved to Unlock" drop into Saved Memories
-- once it actually unlocks, and stop it lingering in "Waiting to Unlock"
-- forever.
--
-- Two gaps found together while wiring this up:
--   1. get_drops_feed's 'saved_to_unlock' case (the Saved page's "Waiting
--      to Unlock" tab) never checked unlock_date — a drop you tapped
--      Save to Unlock on stayed listed there permanently, even long after
--      it unlocked and moved on with its life in the regular feed.
--   2. Nothing ever created the corresponding saved_posts bookmark row,
--      so an unlocked-but-still-"waiting" drop wasn't reachable from
--      Saved Memories either — it just fell into a gap between the two
--      tabs. Same underlying idea as Feed's live countdown reveal
--      (DropCard re-fetches the drop once its timer hits zero); this is
--      the same moment, but persisted server-side so it also works for
--      anyone who wasn't watching the countdown live.
--
-- Same CREATE OR REPLACE safety rule as always: this only touches the
-- WHERE clause inside get_drops_feed's existing 4-parameter signature
-- (see phase14n for the overload this function's signature had to be
-- cleaned up around), so no DROP is needed here.

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
      p.interested_count, p.cant_wait_count, p.good_vibes_count, p.save_to_unlock_count,
      exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'interested') as is_interested,
      exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'cant_wait') as is_cant_wait,
      exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'good_vibes') as is_good_vibes,
      exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'save_to_unlock') as is_saved_to_unlock,
      p.created_at
    from posts p
    join profiles pr on pr.id = p.user_id
    where
      not exists (select 1 from hidden_posts h where h.post_id = p.id and h.user_id = auth.uid())
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
            -- The one deliberate change from phase14j: a drop that's since
            -- unlocked no longer counts as "waiting" — see phase14o header.
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

-- Promotes any of the caller's own save_to_unlock reactions whose drop has
-- since unlocked into a real saved_posts bookmark (idempotent — the unique
-- (post_id, user_id) constraint on saved_posts makes repeat calls a no-op
-- for anything already promoted). Returns the drop ids it just promoted
-- this call, so the client can decide whether to show a "moved to My
-- Memory" toast for the drop it's currently looking at. SECURITY DEFINER
-- so it can freely read/write saved_posts and posts regardless of the
-- caller's own RLS visibility into a since-unlocked drop it doesn't own —
-- same reasoning as can_add_drop_interest (phase14m).
create or replace function public.promote_unlocked_saves()
returns table(drop_id uuid)
language sql
security definer
set search_path = public
as $$
  insert into saved_posts (user_id, post_id)
  select auth.uid(), di.drop_id
  from drop_interests di
  join posts p on p.id = di.drop_id
  where di.user_id = auth.uid()
    and di.interest_type = 'save_to_unlock'
    and p.unlock_date <= now()
  on conflict (post_id, user_id) do nothing
  returning post_id;
$$;

grant execute on function public.promote_unlocked_saves() to authenticated;
