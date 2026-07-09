-- Memory Drop — Phase 10a: Search + Explore.
-- Run once, after supabase/phase9_unified_memory_wiring.sql, in the
-- Supabase SQL editor. Safe to re-run — every statement is idempotent.
--
-- This is the first of six Phase 10 sub-phases ("Social Experience &
-- Product Polish", split by agreement into 10a–10f so each lands as one
-- reviewable, testable unit rather than one enormous migration). 10a
-- covers:
--   1. search_history — recent-searches tracking per user, plus a
--      trending-searches aggregate across all users.
--   2. search_memories() — a cross-user, visibility-aware search over
--      Drops + Capsules + Moments (the existing get_memories() is
--      deliberately single-owner-scoped and only searches your own
--      content — this is the "search other people's public/visible
--      stuff too" counterpart). Returns the exact same row shape as
--      get_memories()/get_memory(), so the frontend reuses GridView/
--      ListView/MemoryCard as-is for search results and Explore.
--   3. search_collections() — search within your own collections
--      (collections are a personal organizing tool, not a shared/public
--      feature anywhere else in this app, so this stays own-only).
--   4. get_explore_feed() — tab-driven discovery feed (Trending/Newest/
--      Popular Memories/Popular Drops/Today's Unlocks + six tag-based
--      category tabs), built on top of search_memories().
--   5. get_search_suggestions() — combines matching usernames with
--      matching trending search terms for as-you-type suggestions.
--
-- search_users() (Phase 3) is reused unchanged for the Users category —
-- no need to rebuild what already works.
--
-- Known scope limits (see README "Known limitations" for the full list):
--   - Drops still have no tags/location_text columns (Phase 9's own
--     limitation, unchanged here) — Drops are findable in search by
--     caption text only, never by tag or location.
--   - Search/Explore only ever surface UNLOCKED, currently-visible
--     content — same "no peeking early" rule as everywhere else. Your
--     own still-locked Drops/Capsules are deliberately not surfaced
--     here; use Memories' own search (get_memories) for that.
--   - "Achievements" as an Explore category tab is implemented as a
--     literal tag filter (tag = 'Achievements'), not a query over the
--     badges system — nothing in this app tags content with achievement
--     names automatically, so this tab is only useful once users start
--     tagging their own capsules/moments "Achievements" by hand.

-- ---------------------------------------------------------------------------
-- 1. search_history — one row per search a user runs. Own-rows-only RLS,
--    the same posture as every other personal-activity table in this
--    app (e.g. drop_unlock_views' owner-side reads).
-- ---------------------------------------------------------------------------
create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  query text not null check (char_length(query) between 1 and 100),
  created_at timestamptz not null default now()
);

create index if not exists search_history_user_created_idx on public.search_history (user_id, created_at desc);
create index if not exists search_history_created_idx on public.search_history (created_at desc);

alter table public.search_history enable row level security;

drop policy if exists "Users can view their own search history" on public.search_history;
create policy "Users can view their own search history"
  on public.search_history for select
  using (auth.uid() = user_id);

drop policy if exists "Users can record their own searches" on public.search_history;
create policy "Users can record their own searches"
  on public.search_history for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own search history" on public.search_history;
create policy "Users can delete their own search history"
  on public.search_history for delete
  using (auth.uid() = user_id);

create or replace function public.record_search(p_query text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.search_history (user_id, query)
  select auth.uid(), trim(p_query)
  where p_query is not null and trim(p_query) <> '';
$$;

grant execute on function public.record_search(text) to authenticated;

-- distinct on() dedupes by lowercased query but doesn't guarantee overall
-- recency order once deduped, so the dedup happens in a subquery and the
-- outer query re-sorts by actual recency.
create or replace function public.get_recent_searches(p_limit int default 10)
returns table (query text, searched_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select query, searched_at from (
    select distinct on (lower(sh.query)) sh.query, sh.created_at as searched_at
    from public.search_history sh
    where sh.user_id = auth.uid()
    order by lower(sh.query), sh.created_at desc
  ) recent
  order by searched_at desc
  limit p_limit;
$$;

grant execute on function public.get_recent_searches(int) to authenticated;

create or replace function public.clear_search_history()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.search_history where user_id = auth.uid();
$$;

grant execute on function public.clear_search_history() to authenticated;

-- Site-wide trending search terms over the last 7 days. Deliberately
-- only exposes the query text + a count, never who searched for what —
-- search_history rows themselves stay owner-only via RLS above; this
-- function is security definer specifically so it can aggregate across
-- everyone's rows without granting cross-user SELECT on the table.
create or replace function public.get_trending_searches(p_limit int default 10)
returns table (query text, search_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(sh.query)) as query, count(*) as search_count
  from public.search_history sh
  where sh.created_at > now() - interval '7 days'
  group by lower(trim(sh.query))
  order by search_count desc, query asc
  limit p_limit;
$$;

grant execute on function public.get_trending_searches(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. search_memories — cross-user, visibility-aware search over Drops,
--    Capsules, and Moments. Same "no peeking early" content-nulling
--    discipline as get_memories()/get_memory() (Phase 7/9), except this
--    one is NOT scoped to a single owner — can_view_drop/can_view_capsule/
--    can_view_moment (already-established predicates from Phases 4c/5/6)
--    decide visibility per row, exactly like get_public_stats() does.
-- ---------------------------------------------------------------------------
create or replace function public.search_memories(
  p_query text default null,
  p_tag text default null,
  p_content_types text[] default null,
  p_sort text default 'newest',
  p_today_only boolean default false,
  p_limit int default 20,
  p_offset int default 0
)
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
begin
  return query
    select * from (
      select
        c.id, 'capsule'::text, c.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        c.title,
        c.memory_text,
        coalesce(
          (select jsonb_agg(jsonb_build_object('url', cm.media_url, 'type', cm.media_type, 'position', cm.position) order by cm.position)
           from capsule_media cm where cm.capsule_id = c.id), '[]'::jsonb
        ),
        c.memory_types,
        c.mood,
        c.location_text,
        c.tags,
        (case c.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end),
        true,
        (c.user_id = auth.uid()),
        exists(select 1 from favorites f where f.capsule_id = c.id and f.user_id = auth.uid()),
        (c.hidden_at is not null),
        (select count(*)::int from capsule_views cv where cv.capsule_id = c.id),
        c.like_count,
        c.comment_count,
        c.unlock_date,
        c.created_at
      from capsules c
      join profiles pr on pr.id = c.user_id
      where c.unlock_date <= now()
        and c.hidden_at is null
        and not is_blocked_either_way(c.user_id)
        and (c.user_id = auth.uid() or can_view_capsule(c.user_id, c.visibility))

      union all

      select
        m.id, 'moment'::text, m.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        null::text,
        m.text_content,
        case when m.media_url is not null then jsonb_build_array(jsonb_build_object('url', m.media_url, 'type', m.media_type, 'position', 0)) else '[]'::jsonb end,
        array[m.media_type]::text[],
        m.mood,
        m.location_text,
        m.tags,
        (case m.privacy when 'everyone' then 'public' when 'close_friends' then 'followers' when 'followers' then 'followers' else 'only_me' end),
        true,
        (m.user_id = auth.uid()),
        exists(select 1 from favorites f where f.moment_id = m.id and f.user_id = auth.uid()),
        (m.hidden_at is not null),
        m.view_count,
        0,
        0,
        m.expires_at,
        m.created_at
      from moments m
      join profiles pr on pr.id = m.user_id
      where m.expires_at <= now()
        and m.hidden_at is null
        and not is_blocked_either_way(m.user_id)
        and (m.user_id = auth.uid() or can_view_moment(m.user_id, m.privacy))

      union all

      select
        p.id, 'drop'::text, p.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        null::text,
        p.caption,
        coalesce(
          (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'type', 'photo', 'position', pi.position) order by pi.position)
           from post_images pi where pi.post_id = p.id),
          (case when p.video_url is not null then jsonb_build_array(jsonb_build_object('url', p.video_url, 'type', 'video', 'position', 0))
                when p.audio_url is not null then jsonb_build_array(jsonb_build_object('url', p.audio_url, 'type', 'audio', 'position', 0))
                else '[]'::jsonb end)
        ),
        array[p.post_type]::text[],
        p.mood,
        null::text,
        '{}'::text[],
        (case p.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end),
        true,
        (p.user_id = auth.uid()),
        exists(select 1 from favorites f where f.drop_id = p.id and f.user_id = auth.uid()),
        false,
        (select count(*)::int from drop_unlock_views dv where dv.drop_id = p.id),
        p.like_count,
        p.comment_count,
        p.unlock_date,
        p.created_at
      from posts p
      join profiles pr on pr.id = p.user_id
      where p.unlock_date <= now()
        and not is_blocked_either_way(p.user_id)
        and (p.user_id = auth.uid() or can_view_drop(p.user_id, p.visibility))
    ) as results(
      id, memory_type, user_id, username, display_name, profile_photo_url, title, caption, media,
      memory_types, mood, location_text, tags, visibility, is_unlocked, is_own, is_favorited, is_hidden,
      view_count, like_count, comment_count, matured_at, created_at
    )
    where
      (p_content_types is null or results.memory_type = any(p_content_types))
      and (p_query is null or p_query = '' or (
        results.title ilike '%' || p_query || '%'
        or results.caption ilike '%' || p_query || '%'
        or results.location_text ilike '%' || p_query || '%'
        or exists (select 1 from unnest(results.tags) t where t ilike '%' || p_query || '%')
      ))
      and (p_tag is null or exists (select 1 from unnest(results.tags) t where lower(t) = lower(p_tag)))
      and (not p_today_only or results.matured_at::date = current_date)
    order by
      (case when p_sort in ('trending', 'popular') then (results.like_count + results.comment_count + results.view_count) else 0 end) desc,
      (case when p_sort = 'oldest' then results.created_at end) asc,
      (case when p_sort <> 'oldest' then results.created_at end) desc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.search_memories(text, text, text[], text, boolean, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. search_collections — your own collections only, by name.
-- ---------------------------------------------------------------------------
create or replace function public.search_collections(p_query text default null, p_limit int default 20)
returns table (id uuid, name text, icon text, is_default boolean, item_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    mc.id, mc.name, mc.icon, mc.is_default,
    (select count(*) from collection_items ci where ci.collection_id = mc.id)
  from public.memory_collections mc
  where mc.user_id = auth.uid()
    and (p_query is null or p_query = '' or mc.name ilike '%' || p_query || '%')
  order by mc.name
  limit p_limit;
$$;

grant execute on function public.search_collections(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. get_explore_feed — tab-driven discovery, built on search_memories().
--    "Only show content users are allowed to view" is inherited directly
--    from search_memories()'s own can_view_*-based predicates — Explore
--    applies no separate, looser visibility rule of its own.
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
  v_tag text := case p_tab
    when 'travel' then 'Travel'
    when 'nature' then 'Nature'
    when 'family' then 'Family'
    when 'graduation' then 'Graduation'
    when 'birthday' then 'Birthday'
    when 'achievements' then 'Achievements'
    else null
  end;
  v_sort text := case p_tab
    when 'trending' then 'trending'
    when 'popular_memories' then 'popular'
    when 'popular_drops' then 'popular'
    else 'newest'
  end;
  v_types text[] := case p_tab
    when 'popular_drops' then array['drop']
    when 'popular_memories' then array['capsule', 'moment']
    else null
  end;
  v_today_only boolean := (p_tab = 'todays_unlocks');
begin
  return query
    select * from search_memories(null, v_tag, v_types, v_sort, v_today_only, p_limit, p_offset);
end;
$$;

grant execute on function public.get_explore_feed(text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. get_search_suggestions — matching usernames + matching trending
--    terms, combined into one as-you-type list.
-- ---------------------------------------------------------------------------
create or replace function public.get_search_suggestions(p_prefix text, p_limit int default 8)
returns table (suggestion text, suggestion_type text)
language sql
stable
security definer
set search_path = public
as $$
  (
    select pr.username, 'user'::text
    from public.profiles pr
    where p_prefix is not null and trim(p_prefix) <> ''
      and pr.username ilike trim(p_prefix) || '%'
      and pr.id <> auth.uid()
      and not is_blocked_either_way(pr.id)
    order by pr.username
    limit greatest(p_limit / 2, 1)
  )
  union all
  (
    select t.query, 'trending'::text
    from (
      select lower(trim(sh.query)) as query, count(*) as c
      from public.search_history sh
      where sh.created_at > now() - interval '7 days'
        and (p_prefix is null or trim(p_prefix) = '' or sh.query ilike trim(p_prefix) || '%')
      group by 1
      order by c desc
      limit greatest(p_limit / 2, 1)
    ) t
  )
  limit p_limit;
$$;

grant execute on function public.get_search_suggestions(text, int) to authenticated;
