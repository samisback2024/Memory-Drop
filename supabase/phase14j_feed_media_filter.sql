-- Phase 14j — media-type filter for the Feed.
--
-- get_drops_feed() gains an optional p_post_type filter (any of posts'
-- own post_type values: 'photo', 'video', 'audio', 'text') so the Feed
-- can let someone narrow My Drops/Following/Public Drops/Saved to
-- Unlock down to just one media type, same tabs as today. Appending a
-- new parameter with a default is a compatible CREATE OR REPLACE
-- change (unlike widening the OUT columns, which needs DROP first) —
-- no existing caller passing 3 args breaks.

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
            exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'save_to_unlock')
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
