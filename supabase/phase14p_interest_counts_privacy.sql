-- Phase 14p — a Settings toggle for whether other people can see the
-- Interested/Can't Wait/Good Vibes/Saved to Unlock counts on your locked
-- drops.
--
-- Today those four counts are unconditionally public on every locked
-- drop, to anyone who can see the drop at all, with no privacy control —
-- unlike almost every other number in this app (see phase14g's
-- visible_stats, an explicit opt-IN model for the owner's Memory Stats
-- dashboard). This adds the same kind of control here: a single toggle,
-- default ON (today's behavior, unchanged unless the owner turns it
-- off), that hides the four counts from everyone but the drop's own
-- owner. It only masks the aggregate numbers — a viewer's own
-- is_interested/is_cant_wait/is_good_vibes/is_saved_to_unlock (did *I*
-- react this way) and the ability to react are both untouched, so the
-- buttons keep working exactly the same; InterestActions.tsx already
-- only renders a count badge when count > 0, so a masked 0 makes the
-- badge disappear with no frontend change needed.

alter table public.user_settings add column if not exists show_interest_counts boolean not null default true;

-- get_drops_feed — same 4-parameter signature as phase14o, CREATE OR
-- REPLACE is safe. Only change: the four count columns are masked to 0
-- for a non-owner viewer when the drop owner has counts hidden.
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

-- get_drop — single-drop fetch (DropCard's unlock refresh, DropPage's
-- shared-link view). Same uuid signature as phase4d, CREATE OR REPLACE
-- is safe.
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
    and not is_blocked_either_way(p.user_id)
    and (p.user_id = auth.uid() or can_view_drop(p.user_id, p.visibility));
$$;

grant execute on function public.get_drop(uuid) to authenticated;

-- get_saved_drops — the caller's own saved_posts bookmarks, which can
-- include other people's drops, so the masking still depends on each
-- individual drop's own owner setting, not the caller's. Same (int, int)
-- signature as phase4d, CREATE OR REPLACE is safe.
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
    and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
  order by sp.created_at desc
  limit p_limit offset p_offset;
$$;

grant execute on function public.get_saved_drops(int, int) to authenticated;
