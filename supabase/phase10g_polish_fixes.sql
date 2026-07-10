-- Memory Drop — Phase 10g: Polish Fixes (revised Phase 10 spec).
-- Run once, after supabase/phase10f_admin_prep.sql, in the Supabase SQL
-- editor. Safe to re-run — every statement is idempotent.
--
-- This reconciles the already-shipped Phase 10 work (search_explore,
-- profile_polish, saved_share, comments_reactions, admin_prep) against
-- a stricter, more detailed revision of the same Phase 10 brief. Three
-- unrelated fixes, bundled into one migration because they're all small
-- and all came from the same reconciliation pass:
--   1. Pinned Memories cap: 6 → 3, per the revised spec ("up to three").
--   2. get_explore_feed() tabs replaced with the revised spec's exact
--      section list (Unlocking Soon / Today's Unlocks / Recently
--      Unlocked / Popular Public Drops / Public Capsules), dropping the
--      6 tag-category tabs the original Phase 10a shipped (not in the
--      revised spec; tag search still works fine from /search).
--   3. get_new_creators() — a new small RPC for Explore's "New
--      Creators" person-tab. "Suggested People" reuses Phase 3's
--      existing get_suggested_friends() unchanged.
--   4. posts' SELECT RLS hardened to table-level lock parity with
--      capsules (see Security notes) — the exact gap this app's own
--      README has documented since Phase 6.

-- ---------------------------------------------------------------------------
-- 1. Pin cap 6 → 3.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_pin_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.pinned_items where user_id = new.user_id) >= 3 then
    raise exception 'You can only pin up to 3 memories at a time — unpin one first.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. get_explore_feed() — revised tab list. Still built on
--    search_memories() (Phase 10a), just different tab→parameter
--    mappings. 'unlocking_soon' and 'recently_unlocked' mirror the same
--    logic MemoriesPage's "Locked Until Later"/"Recently Unlocked"
--    preview strips already use (soonest-unlock-first / most-recently-
--    matured-first), just applied across all users instead of one.
-- ---------------------------------------------------------------------------
create or replace function public.get_explore_feed(p_tab text, p_limit int default 20, p_offset int default 0)
returns table (
  id uuid,
  memory_type text,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  title text,
  caption text,
  media jsonb,
  memory_types text[],
  mood text,
  location_text text,
  tags text[],
  visibility text,
  is_unlocked boolean,
  is_own boolean,
  is_favorited boolean,
  is_hidden boolean,
  view_count int,
  like_count int,
  comment_count int,
  matured_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sort text := case p_tab
    when 'popular_public_drops' then 'popular'
    when 'public_capsules' then 'newest'
    when 'recently_unlocked' then 'newest'
    else 'newest'
  end;
  v_types text[] := case p_tab
    when 'popular_public_drops' then array['drop']
    when 'public_capsules' then array['capsule']
    else null
  end;
  v_today_only boolean := (p_tab = 'todays_unlocks');
begin
  if p_tab = 'unlocking_soon' then
    -- No "locked" concept exists in search_memories() (it only ever
    -- returns unlocked/matured content, by design — see Phase 10a). For
    -- "what's about to open, across everyone," this reads directly from
    -- capsules/posts instead, mirroring get_memories()'s own
    -- visibility predicates rather than reusing search_memories().
    return query
      select
        c.id, 'capsule'::text, c.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        null::text, null::text, '[]'::jsonb, c.memory_types, c.mood, null::text, c.tags,
        (case c.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end),
        false, (c.user_id = auth.uid()), false, false, 0, c.like_count, c.comment_count, c.unlock_date, c.created_at
      from capsules c
      join profiles pr on pr.id = c.user_id
      where c.unlock_date > now()
        and c.unlock_date <= now() + interval '7 days'
        and c.hidden_at is null
        and c.moderation_status = 'active'
        and not is_blocked_either_way(c.user_id)
        and can_view_capsule(c.user_id, c.visibility)

      union all

      select
        p.id, 'drop'::text, p.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        null::text, null::text, '[]'::jsonb, array[p.post_type]::text[], p.mood, null::text, '{}'::text[],
        (case p.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end),
        false, (p.user_id = auth.uid()), false, false, 0, p.like_count, p.comment_count, p.unlock_date, p.created_at
      from posts p
      join profiles pr on pr.id = p.user_id
      where p.unlock_date > now()
        and p.unlock_date <= now() + interval '7 days'
        and p.moderation_status = 'active'
        and not is_blocked_either_way(p.user_id)
        and can_view_drop(p.user_id, p.visibility)
      order by unlock_date asc
      limit p_limit offset p_offset;
  else
    return query
      select * from search_memories(null, null, v_types, v_sort, v_today_only, p_limit, p_offset);
  end if;
end;
$$;

grant execute on function public.get_explore_feed(text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_new_creators() — Explore's "New Creators" person-tab. Same
--    return shape as get_suggested_friends() (Phase 3) so the frontend
--    can render both through the same UserList component.
-- ---------------------------------------------------------------------------
create or replace function public.get_new_creators(p_limit int default 20)
returns table (id uuid, username text, display_name text, profile_photo_url text, is_private boolean, mutual_count int)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.username, pr.display_name, pr.profile_photo_url, pr.is_private, 0
  from public.profiles pr
  where pr.id <> auth.uid()
    and pr.username is not null
    and not is_blocked_either_way(pr.id)
  order by pr.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_new_creators(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. posts' SELECT RLS — table-level lock parity with capsules. Before
--    this, a non-owner who could view the author's posts in general
--    (visibility check passed) could read a still-locked drop's RAW ROW
--    via a direct /rest/v1/posts request — the RPC layer (get_drops_
--    feed/get_drop) already nulled the content, but the table itself
--    didn't independently re-enforce the lock. This is the exact gap
--    the README has documented since phase6_capsules.sql shipped
--    capsules with the stricter version. Bringing posts up to the same
--    guarantee: a locked drop you don't own now returns NO ROW at all
--    to a direct table query, not a row with nulled columns.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view visible posts" on public.posts;
create policy "Users can view visible posts"
  on public.posts for select
  using (
    user_id = auth.uid()
    or (
      unlock_date <= now()
      and moderation_status = 'active'
      and not is_blocked_either_way(user_id)
      and can_view_drop(user_id, visibility)
    )
  );
