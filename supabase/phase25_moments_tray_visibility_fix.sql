-- Phase 25 — fixes a friend's moment never showing up in the Moments
-- pile even when their account is public and their moment's own
-- privacy is "everyone."
--
-- get_moments_tray() double-gated visibility: on top of
-- can_view_moment() (which already correctly handles every privacy
-- tier — 'everyone' + can_view_author_posts, 'followers' via an
-- accepted Orbit, 'close_friends' via the close_friends table), the
-- query's own WHERE clause additionally required you to *already* have
-- an accepted Orbit relationship with the author for ANY of their
-- moments to appear, regardless of what can_view_moment says. Since
-- can_view_author_posts() already returns true for any public account
-- with no Orbit requirement at all, that outer condition was strictly
-- more restrictive than the privacy tier the moment was actually
-- posted with — a public "everyone" moment from someone you haven't
-- (yet) added to your Orbit silently never appeared, full stop. Every
-- other visibility surface in this app (Feed, Capsules, Explore,
-- Search) already treats its can_view_* function as the single source
-- of truth rather than layering a second, stricter check in front of
-- it — this brings the moments tray in line with that same pattern.

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
    and (m.user_id = auth.uid() or can_view_moment(m.user_id, m.privacy))
  order by
    (exists(select 1 from moment_views mv where mv.moment_id = m.id and mv.viewer_id = auth.uid())) asc,
    m.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_moments_tray(int) to authenticated;
