-- ---------------------------------------------------------------------------
-- Phase 27 — two Supabase-side performance fixes found during an audit.
-- ---------------------------------------------------------------------------

-- 1. saved_posts had no index leading with post_id — get_drops_feed's
--    per-row `is_saved` check (exists(select 1 from saved_posts sp where
--    sp.post_id = p.id and sp.user_id = auth.uid())) could only use the
--    existing (user_id, created_at) index, i.e. scan the viewer's own
--    saves rather than doing a direct post_id lookup. Composite index
--    covers the exact predicate shape used everywhere this table is
--    queried (both here and in unsave/toggle-save lookups).
create index if not exists saved_posts_post_user_idx on public.saved_posts (post_id, user_id);

-- 2. get_moments_tray's ORDER BY sorted on a correlated EXISTS subquery
--    (unviewed-first), which Postgres can't satisfy with an index — every
--    visible, non-expired moment across the whole network had to be
--    evaluated and sorted in memory before the LIMIT was applied, and the
--    same exists() was redundantly computed twice per row (once in SELECT,
--    once again in ORDER BY). Rewritten as a single LEFT JOIN against
--    moment_views (computed once, reused for both the returned column and
--    the sort key), backed by a composite index so the join itself is an
--    index lookup rather than a per-row subquery scan. The sort still
--    can't skip straight to LIMIT — sorting on "viewed" status is
--    inherently a filter-then-sort operation — but this removes the
--    redundant computation and gives the planner an actual index to join
--    against instead of N correlated subquery executions.
create index if not exists moment_views_moment_viewer_idx on public.moment_views (moment_id, viewer_id);

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
    (mv.viewer_id is not null) as is_viewed
  from moments m
  join profiles pr on pr.id = m.user_id
  left join moment_views mv on mv.moment_id = m.id and mv.viewer_id = auth.uid()
  where
    m.expires_at > now()
    and not is_blocked_either_way(m.user_id)
    and (m.user_id = auth.uid() or can_view_moment(m.user_id, m.privacy))
  order by
    (mv.viewer_id is not null) asc,
    m.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_moments_tray(int) to authenticated;
