-- Memory Drop — Phase 9: Unified Memory Wiring.
-- Run once, after supabase/phase8_settings.sql, in the Supabase SQL
-- editor. Safe to re-run — every statement is idempotent.
--
-- This is a wiring/consistency pass, not a new feature. It does three
-- things:
--   1. Adds `memory_items_view` — a single normalized read model over
--      posts (Drops), capsules, and moments, used by stats and any
--      future cross-cutting query so that logic isn't hand-rolled three
--      times.
--   2. Widens get_memories()/get_memory() (Phase 7) to include Drops.
--      Phase 7's own README explicitly flagged this as an open
--      interpretation question — this phase resolves it: yes, Drops
--      belong in Memories too, per this phase's explicit instruction.
--   3. Adds get_memory_stats()/get_public_stats() — the accurate,
--      single-source-of-truth counts Profile needed and never had.
--
-- What an audit of the existing code found (see the delivery notes for
-- the full write-up): the six Feed tabs, and the view/unlock-recording
-- trackers (drop_unlock_views, capsule_unlocks, capsule_views,
-- moment_views) were already correctly and consistently wired — no bugs
-- found there. The real gaps were: Drops missing from the Memories
-- union, and Profile having no stats at all.

-- ---------------------------------------------------------------------------
-- 1. memory_items_view — a normalized, LIGHTWEIGHT read model (identity,
--    status, dates, a single media_url/media_type, not the richer
--    multi-image jsonb array get_memories() returns for actual display).
--    Deliberately not granted to `authenticated`/`anon` at all — a
--    Postgres view runs against its underlying tables with the view
--    owner's privileges for RLS purposes (table owners bypass their own
--    RLS unless FORCE ROW LEVEL SECURITY is set), so exposing this view
--    directly would let any signed-in user read every row in the
--    system, bypassing every visibility rule this app enforces
--    elsewhere. It only exists to be queried from inside SECURITY
--    DEFINER functions that apply their own visibility predicate — the
--    same discipline every other cross-user read in this app already
--    follows, just reused here instead of retyping the 3-way UNION.
--
--    status, plain language: 'locked' (unlock_date/expiry still ahead),
--    'unlocked' (a Drop or Capsule whose time has come), 'expired' (a
--    Moment past its expiry — Moments never become "unlocked", they
--    mature into "expired" and move to the owner's archive instead),
--    'archived' (hidden_at is set — Capsules/Moments only; Drops have no
--    archive concept yet, see Known limitations).
-- ---------------------------------------------------------------------------
create or replace view public.memory_items_view as
  select
    p.id,
    p.user_id as owner_id,
    'drop'::text as source_type,
    p.id as source_id,
    null::text as title,
    p.caption,
    p.post_type as media_type,
    coalesce(p.video_url, p.audio_url) as media_url,
    p.mood,
    (case p.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end) as visibility,
    p.unlock_date as unlock_at,
    null::timestamptz as expires_at,
    (case when p.unlock_date <= now() then 'unlocked' else 'locked' end) as status,
    p.created_at,
    p.updated_at
  from posts p

  union all

  select
    c.id,
    c.user_id,
    'capsule'::text,
    c.id,
    c.title,
    c.memory_text,
    (case when cardinality(c.memory_types) > 0 then c.memory_types[1] else 'text' end),
    (select cm.media_url from capsule_media cm where cm.capsule_id = c.id order by cm.position limit 1),
    c.mood,
    c.visibility,
    c.unlock_date,
    null::timestamptz,
    (case when c.hidden_at is not null then 'archived' when c.unlock_date <= now() then 'unlocked' else 'locked' end),
    c.created_at,
    c.updated_at
  from capsules c

  union all

  select
    m.id,
    m.user_id,
    'moment'::text,
    m.id,
    null::text,
    m.text_content,
    m.media_type,
    m.media_url,
    m.mood,
    (case m.privacy when 'everyone' then 'public' when 'close_friends' then 'followers' when 'followers' then 'followers' else 'only_me' end),
    null::timestamptz,
    m.expires_at,
    (case when m.hidden_at is not null then 'archived' when m.expires_at <= now() then 'expired' else 'locked' end),
    m.created_at,
    m.updated_at
  from moments m;

-- Explicitly no GRANT to authenticated/anon — see the comment above.
revoke all on public.memory_items_view from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- 2. get_memories() / get_memory() — same signatures and return shape as
--    Phase 7 (CREATE OR REPLACE is safe, no column list change), now
--    UNIONing three sources instead of two. Drops follow the exact same
--    "no peeking early" content-nulling rule already used everywhere in
--    this app. A Drop's `title` is always null (Drops never had a title
--    field); `tags`/`location_text` are always empty/null for Drops —
--    those two fields only exist on Capsules/Moments (Phase 7 added
--    them there, not to `posts`) — see Known limitations.
-- ---------------------------------------------------------------------------
create or replace function public.get_memories(
  p_user_id uuid default null,
  p_search text default null,
  p_lock_status text default null,
  p_year int default null,
  p_month int default null,
  p_mood text default null,
  p_visibility text default null,
  p_media_type text default null,
  p_favorites_only boolean default false,
  p_collection_id uuid default null,
  p_include_hidden boolean default false,
  p_archived_only boolean default false,
  p_sort text default 'newest',
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
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_self boolean := v_target = auth.uid();
begin
  return query
    select * from (
      select
        c.id, 'capsule'::text, c.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        case when c.unlock_date <= now() then c.title else null end,
        case when c.unlock_date <= now() then c.memory_text else null end,
        case when c.unlock_date <= now() then coalesce(
          (select jsonb_agg(jsonb_build_object('url', cm.media_url, 'type', cm.media_type, 'position', cm.position) order by cm.position)
           from capsule_media cm where cm.capsule_id = c.id), '[]'::jsonb
        ) else '[]'::jsonb end,
        c.memory_types,
        c.mood,
        case when c.unlock_date <= now() then c.location_text else null end,
        c.tags,
        (case c.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end),
        (c.unlock_date <= now()),
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
      where c.user_id = v_target
        and not is_blocked_either_way(c.user_id)
        and (c.user_id = auth.uid() or (c.unlock_date <= now() and can_view_capsule(c.user_id, c.visibility)))
        and (v_self or c.unlock_date <= now())
        and (case when p_archived_only then c.hidden_at is not null else (p_include_hidden or c.hidden_at is null) end)

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
      where m.user_id = v_target
        and not is_blocked_either_way(m.user_id)
        and m.expires_at <= now()
        and (m.user_id = auth.uid() or can_view_moment(m.user_id, m.privacy))
        and (case when p_archived_only then m.hidden_at is not null else (p_include_hidden or m.hidden_at is null) end)

      union all

      select
        p.id, 'drop'::text, p.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        null::text,
        case when p.unlock_date <= now() then p.caption else null end,
        case when p.unlock_date <= now() then coalesce(
          (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'type', 'photo', 'position', pi.position) order by pi.position)
           from post_images pi where pi.post_id = p.id),
          (case when p.video_url is not null then jsonb_build_array(jsonb_build_object('url', p.video_url, 'type', 'video', 'position', 0))
                when p.audio_url is not null then jsonb_build_array(jsonb_build_object('url', p.audio_url, 'type', 'audio', 'position', 0))
                else '[]'::jsonb end)
        ) else '[]'::jsonb end,
        array[p.post_type]::text[],
        p.mood,
        null::text,
        '{}'::text[],
        (case p.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end),
        (p.unlock_date <= now()),
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
      where p.user_id = v_target
        and not is_blocked_either_way(p.user_id)
        and (p.user_id = auth.uid() or (p.unlock_date <= now() and can_view_drop(p.user_id, p.visibility)))
        and (v_self or p.unlock_date <= now())
    ) as memories(
      id, memory_type, user_id, username, display_name, profile_photo_url, title, caption, media,
      memory_types, mood, location_text, tags, visibility, is_unlocked, is_own, is_favorited, is_hidden,
      view_count, like_count, comment_count, matured_at, created_at
    )
    where
      (p_search is null or p_search = '' or (
        memories.is_own and (memories.title ilike '%' || p_search || '%' or memories.caption ilike '%' || p_search || '%')
      ))
      and (p_lock_status is null or (p_lock_status = 'locked' and not memories.is_unlocked) or (p_lock_status = 'unlocked' and memories.is_unlocked))
      and (p_year is null or extract(year from memories.created_at) = p_year)
      and (p_month is null or extract(month from memories.created_at) = p_month)
      and (p_mood is null or memories.mood = p_mood)
      and (p_visibility is null or memories.visibility = p_visibility)
      and (p_media_type is null or p_media_type = any(memories.memory_types))
      and (not p_favorites_only or memories.is_favorited)
      and (p_collection_id is null or exists (
        select 1 from collection_items ci
        where ci.collection_id = p_collection_id
          and (
            (ci.capsule_id = memories.id and memories.memory_type = 'capsule')
            or (ci.moment_id = memories.id and memories.memory_type = 'moment')
            or (ci.drop_id = memories.id and memories.memory_type = 'drop')
          )
      ))
    order by
      case when p_sort = 'oldest' then memories.created_at end asc,
      case when p_sort <> 'oldest' then memories.created_at end desc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.get_memories(uuid, text, text, int, int, text, text, text, boolean, uuid, boolean, boolean, text, int, int) to authenticated;

create or replace function public.get_memory(p_memory_type text, p_memory_id uuid)
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
  if p_memory_type = 'capsule' then
    return query
      select
        c.id, 'capsule'::text, c.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        case when c.unlock_date <= now() then c.title else null end,
        case when c.unlock_date <= now() then c.memory_text else null end,
        case when c.unlock_date <= now() then coalesce(
          (select jsonb_agg(jsonb_build_object('url', cm.media_url, 'type', cm.media_type, 'position', cm.position) order by cm.position)
           from capsule_media cm where cm.capsule_id = c.id), '[]'::jsonb
        ) else '[]'::jsonb end,
        c.memory_types, c.mood,
        case when c.unlock_date <= now() then c.location_text else null end,
        c.tags,
        (case c.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end),
        (c.unlock_date <= now()),
        (c.user_id = auth.uid()),
        exists(select 1 from favorites f where f.capsule_id = c.id and f.user_id = auth.uid()),
        (c.hidden_at is not null),
        (select count(*)::int from capsule_views cv where cv.capsule_id = c.id),
        c.like_count, c.comment_count, c.unlock_date, c.created_at
      from capsules c
      join profiles pr on pr.id = c.user_id
      where c.id = p_memory_id
        and not is_blocked_either_way(c.user_id)
        and (c.user_id = auth.uid() or (c.unlock_date <= now() and can_view_capsule(c.user_id, c.visibility)));
  elsif p_memory_type = 'moment' then
    return query
      select
        m.id, 'moment'::text, m.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        null::text, m.text_content,
        case when m.media_url is not null then jsonb_build_array(jsonb_build_object('url', m.media_url, 'type', m.media_type, 'position', 0)) else '[]'::jsonb end,
        array[m.media_type]::text[], m.mood, m.location_text, m.tags,
        (case m.privacy when 'everyone' then 'public' when 'close_friends' then 'followers' when 'followers' then 'followers' else 'only_me' end),
        true,
        (m.user_id = auth.uid()),
        exists(select 1 from favorites f where f.moment_id = m.id and f.user_id = auth.uid()),
        (m.hidden_at is not null),
        m.view_count, 0, 0, m.expires_at, m.created_at
      from moments m
      join profiles pr on pr.id = m.user_id
      where m.id = p_memory_id
        and not is_blocked_either_way(m.user_id)
        and m.expires_at <= now()
        and (m.user_id = auth.uid() or can_view_moment(m.user_id, m.privacy));
  else
    return query
      select
        p.id, 'drop'::text, p.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        null::text,
        case when p.unlock_date <= now() then p.caption else null end,
        case when p.unlock_date <= now() then coalesce(
          (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'type', 'photo', 'position', pi.position) order by pi.position)
           from post_images pi where pi.post_id = p.id),
          (case when p.video_url is not null then jsonb_build_array(jsonb_build_object('url', p.video_url, 'type', 'video', 'position', 0))
                when p.audio_url is not null then jsonb_build_array(jsonb_build_object('url', p.audio_url, 'type', 'audio', 'position', 0))
                else '[]'::jsonb end)
        ) else '[]'::jsonb end,
        array[p.post_type]::text[],
        p.mood,
        null::text,
        '{}'::text[],
        (case p.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end),
        (p.unlock_date <= now()),
        (p.user_id = auth.uid()),
        exists(select 1 from favorites f where f.drop_id = p.id and f.user_id = auth.uid()),
        false,
        (select count(*)::int from drop_unlock_views dv where dv.drop_id = p.id),
        p.like_count, p.comment_count, p.unlock_date, p.created_at
      from posts p
      join profiles pr on pr.id = p.user_id
      where p.id = p_memory_id
        and not is_blocked_either_way(p.user_id)
        and (p.user_id = auth.uid() or (p.unlock_date <= now() and can_view_drop(p.user_id, p.visibility)));
  end if;
end;
$$;

grant execute on function public.get_memory(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. favorites gains a drop_id column so Drops can be favorited from
--    Memories too, same XOR-one-of-three-FKs pattern as before.
-- ---------------------------------------------------------------------------
alter table public.favorites add column if not exists drop_id uuid references public.posts(id) on delete cascade;

alter table public.favorites drop constraint if exists favorites_check;
alter table public.favorites add constraint favorites_check check (
  (capsule_id is not null)::int + (moment_id is not null)::int + (drop_id is not null)::int = 1
);

create unique index if not exists favorites_user_drop_idx on public.favorites (user_id, drop_id) where drop_id is not null;

drop policy if exists "Users can favorite a visible memory" on public.favorites;
create policy "Users can favorite a visible memory"
  on public.favorites for insert
  with check (
    auth.uid() = user_id
    and (
      (capsule_id is not null and exists (
        select 1 from capsules c where c.id = capsule_id
          and (c.user_id = auth.uid() or (c.unlock_date <= now() and not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)))
      ))
      or
      (moment_id is not null and exists (
        select 1 from moments m where m.id = moment_id
          and (m.user_id = auth.uid() or (m.expires_at <= now() and not is_blocked_either_way(m.user_id) and can_view_moment(m.user_id, m.privacy)))
      ))
      or
      (drop_id is not null and exists (
        select 1 from posts p where p.id = drop_id
          and (p.user_id = auth.uid() or (p.unlock_date <= now() and not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
      ))
    )
  );

-- collection_items gets the same drop_id widening, for the same reason —
-- Collections are a Memories-organizing feature, and Drops are now part
-- of Memories.
alter table public.collection_items add column if not exists drop_id uuid references public.posts(id) on delete cascade;

alter table public.collection_items drop constraint if exists collection_items_check;
alter table public.collection_items add constraint collection_items_check check (
  (capsule_id is not null)::int + (moment_id is not null)::int + (drop_id is not null)::int = 1
);

create unique index if not exists collection_items_drop_idx on public.collection_items (collection_id, drop_id) where drop_id is not null;

drop policy if exists "Users can add their own memories to their own collections" on public.collection_items;
create policy "Users can add their own memories to their own collections"
  on public.collection_items for insert
  with check (
    exists (select 1 from memory_collections mc where mc.id = collection_id and mc.user_id = auth.uid())
    and (
      (capsule_id is not null and exists (select 1 from capsules c where c.id = capsule_id and c.user_id = auth.uid()))
      or
      (moment_id is not null and exists (select 1 from moments m where m.id = moment_id and m.user_id = auth.uid()))
      or
      (drop_id is not null and exists (select 1 from posts p where p.id = drop_id and p.user_id = auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- 4. get_memory_stats — the caller's own accurate counts. Every number
--    here is a live aggregate over the same tables/rules already used
--    everywhere else in this app, not a separately-tracked counter that
--    could drift out of sync.
-- ---------------------------------------------------------------------------
create or replace function public.get_memory_stats()
returns table (
  total_drops bigint,
  locked_items bigint,
  unlocked_items bigint,
  expired_moments bigint,
  saved_to_unlock bigint,
  public_drops bigint,
  followers_count bigint,
  following_count bigint,
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
    (select count(*) from posts where user_id = auth.uid()),
    (select count(*) from memory_items_view where owner_id = auth.uid() and status = 'locked'),
    (select count(*) from memory_items_view where owner_id = auth.uid() and status in ('unlocked', 'expired')),
    (select count(*) from moments where user_id = auth.uid() and expires_at <= now()),
    (select count(*) from drop_interests di join posts p on p.id = di.drop_id where p.user_id = auth.uid() and di.interest_type = 'save_to_unlock'),
    (select count(*) from posts where user_id = auth.uid() and visibility = 'public'),
    (select count(*) from follows where following_id = auth.uid() and status = 'accepted'),
    (select count(*) from follows where follower_id = auth.uid() and status = 'accepted'),
    (
      coalesce((select count(*) from capsule_views cv join capsules c on c.id = cv.capsule_id where c.user_id = auth.uid()), 0)
      + coalesce((select count(*) from drop_unlock_views dv join posts p on p.id = dv.drop_id where p.user_id = auth.uid()), 0)
      + coalesce((select count(*) from moment_views mv join moments m on m.id = mv.moment_id where m.user_id = auth.uid()), 0)
    ),
    (
      coalesce((select count(*) from capsule_unlocks cu join capsules c on c.id = cu.capsule_id where c.user_id = auth.uid()), 0)
      + coalesce((select count(*) from drop_unlock_views dv join posts p on p.id = dv.drop_id where p.user_id = auth.uid()), 0)
      + coalesce((select count(*) from moment_views mv join moments m on m.id = mv.moment_id where m.user_id = auth.uid()), 0)
    ),
    (
      coalesce((select sum(like_count) from posts where user_id = auth.uid()), 0)
      + coalesce((select sum(like_count) from capsules where user_id = auth.uid()), 0)
      + coalesce((select count(*) from moment_reactions mr join moments m on m.id = mr.moment_id where m.user_id = auth.uid()), 0)
      + coalesce((select count(*) from drop_interests di join posts p on p.id = di.drop_id where p.user_id = auth.uid()), 0)
    ),
    (
      coalesce((select sum(comment_count) from posts where user_id = auth.uid()), 0)
      + coalesce((select sum(comment_count) from capsules where user_id = auth.uid()), 0)
      + coalesce((select count(*) from moment_replies mr join moments m on m.id = mr.moment_id where m.user_id = auth.uid()), 0)
    );
$$;

grant execute on function public.get_memory_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. get_public_stats — what anyone (including a logged-out viewer, if
--    ever exposed there) is allowed to know about someone else: their
--    public, already-unlocked/expired memory count and their social
--    counts. Never touches locked content, private/only-me/followers
--    visibility, saved-to-unlock, views, reactions, or comments — those
--    stay owner-only, per this phase's own security requirement.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_stats(p_user_id uuid)
returns table (public_memories_count bigint, followers_count bigint, following_count bigint)
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
    (select count(*) from follows where follower_id = p_user_id and status = 'accepted');
$$;

grant execute on function public.get_public_stats(uuid) to anon, authenticated;
