-- Memory Drop — Phase 7: Memories, the unified personal library.
-- Run once, after supabase/phase6_capsules.sql, in the Supabase SQL
-- editor. Safe to re-run — every statement is idempotent.
--
-- A "memory" here is exactly two things, unioned at read time rather than
-- materialized into a new table: every Capsule you own (locked or
-- unlocked — a sealed capsule still belongs in your own timeline as
-- something in progress) and every Moment you own that has expired
-- (an active moment still belongs to the live Moments tray, not the
-- archive). There's no new `memories` table — capsules and moments keep
-- living in their own tables, and get_memories()/get_memory() UNION them
-- into one normalized shape on every read, the same "compute, don't
-- duplicate" instinct behind every RPC in this app so far.
--
-- created_at is the date a memory is grouped/sorted/flashback-matched by
-- (when it actually happened / was captured), not unlock_date/expires_at
-- (when it became — or becomes — visible). A capsule sealed today that
-- opens in 2030 is still "from today" for Timeline/Calendar/Years/
-- Flashback purposes, even though nobody can read it until 2030.

-- ---------------------------------------------------------------------------
-- 1. Schema additions — tags and location on both content types (for
--    unified search/filter/display), and hidden_at for the Archive's
--    Hide/Restore (soft) vs. Delete permanently (hard) distinction.
--    Capsules never collected a location at creation (Phase 6's wizard
--    has no location step) — this is deliberately editable only from the
--    new Memory Details page this phase adds, not retrofitted into the
--    Phase 5/6 creation flows.
-- ---------------------------------------------------------------------------
alter table public.capsules
  add column if not exists tags text[] not null default '{}',
  add column if not exists location_text text,
  add column if not exists hidden_at timestamptz;

alter table public.moments
  add column if not exists tags text[] not null default '{}',
  add column if not exists hidden_at timestamptz;

create index if not exists capsules_hidden_at_idx on public.capsules (hidden_at);
create index if not exists moments_hidden_at_idx on public.moments (hidden_at);
create index if not exists capsules_created_at_idx on public.capsules (created_at);
create index if not exists moments_created_at_idx on public.moments (created_at);
create index if not exists capsules_tags_idx on public.capsules using gin (tags);
create index if not exists moments_tags_idx on public.moments using gin (tags);

-- ---------------------------------------------------------------------------
-- 2. favorites — a personal star on any memory you can see (your own, or
--    something properly shared with you). Two nullable FK columns rather
--    than one polymorphic id, so cascading deletes and referential
--    integrity both still work with real foreign keys.
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  capsule_id uuid references public.capsules(id) on delete cascade,
  moment_id uuid references public.moments(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((capsule_id is not null and moment_id is null) or (capsule_id is null and moment_id is not null))
);

create unique index if not exists favorites_user_capsule_idx on public.favorites (user_id, capsule_id) where capsule_id is not null;
create unique index if not exists favorites_user_moment_idx on public.favorites (user_id, moment_id) where moment_id is not null;
create index if not exists favorites_user_id_idx on public.favorites (user_id);

alter table public.favorites enable row level security;

drop policy if exists "Users can view their own favorites" on public.favorites;
create policy "Users can view their own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

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
    )
  );

drop policy if exists "Users can unfavorite their own favorite" on public.favorites;
create policy "Users can unfavorite their own favorite"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. memory_collections / collection_items — personal folders. A fixed
--    starter set ("Travel", "Birthday", ...) is created for a user via
--    seed_default_collections() below (empty shells, `is_default = true`)
--    rather than any content-based auto-classification — there's no AI
--    in this phase, so "automatically generated" means the collections
--    themselves appear automatically, not that memories are auto-sorted
--    into them. Populating one is always a manual action, same as a
--    custom collection.
-- ---------------------------------------------------------------------------
create table if not exists public.memory_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  icon text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists memory_collections_user_id_idx on public.memory_collections (user_id);

alter table public.memory_collections enable row level security;

drop policy if exists "Users can view their own collections" on public.memory_collections;
create policy "Users can view their own collections"
  on public.memory_collections for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own collections" on public.memory_collections;
create policy "Users can create their own collections"
  on public.memory_collections for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can rename their own collections" on public.memory_collections;
create policy "Users can rename their own collections"
  on public.memory_collections for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own collections" on public.memory_collections;
create policy "Users can delete their own collections"
  on public.memory_collections for delete
  using (auth.uid() = user_id);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.memory_collections(id) on delete cascade,
  capsule_id uuid references public.capsules(id) on delete cascade,
  moment_id uuid references public.moments(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((capsule_id is not null and moment_id is null) or (capsule_id is null and moment_id is not null))
);

create unique index if not exists collection_items_capsule_idx on public.collection_items (collection_id, capsule_id) where capsule_id is not null;
create unique index if not exists collection_items_moment_idx on public.collection_items (collection_id, moment_id) where moment_id is not null;
create index if not exists collection_items_collection_id_idx on public.collection_items (collection_id);

alter table public.collection_items enable row level security;

-- Collections only ever hold your own memories (a personal library, not
-- a shared board) — both the collection and the memory being added must
-- belong to the caller.
drop policy if exists "Users can view items in their own collections" on public.collection_items;
create policy "Users can view items in their own collections"
  on public.collection_items for select
  using (exists (select 1 from memory_collections mc where mc.id = collection_id and mc.user_id = auth.uid()));

drop policy if exists "Users can add their own memories to their own collections" on public.collection_items;
create policy "Users can add their own memories to their own collections"
  on public.collection_items for insert
  with check (
    exists (select 1 from memory_collections mc where mc.id = collection_id and mc.user_id = auth.uid())
    and (
      (capsule_id is not null and exists (select 1 from capsules c where c.id = capsule_id and c.user_id = auth.uid()))
      or
      (moment_id is not null and exists (select 1 from moments m where m.id = moment_id and m.user_id = auth.uid()))
    )
  );

drop policy if exists "Users can remove items from their own collections" on public.collection_items;
create policy "Users can remove items from their own collections"
  on public.collection_items for delete
  using (exists (select 1 from memory_collections mc where mc.id = collection_id and mc.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. flashbacks_cache — not a performance cache (the "on this day" query
--    is cheap at personal-library scale), but a dismissal tracker: once
--    you've seen today's flashback for a given memory, it stays
--    dismissed for the rest of that day rather than replaying its
--    animation on every visit.
-- ---------------------------------------------------------------------------
create table if not exists public.flashbacks_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  capsule_id uuid references public.capsules(id) on delete cascade,
  moment_id uuid references public.moments(id) on delete cascade,
  flashback_date date not null,
  dismissed boolean not null default true,
  created_at timestamptz not null default now(),
  check ((capsule_id is not null and moment_id is null) or (capsule_id is null and moment_id is not null))
);

create unique index if not exists flashbacks_cache_capsule_idx on public.flashbacks_cache (user_id, capsule_id, flashback_date) where capsule_id is not null;
create unique index if not exists flashbacks_cache_moment_idx on public.flashbacks_cache (user_id, moment_id, flashback_date) where moment_id is not null;

alter table public.flashbacks_cache enable row level security;

drop policy if exists "Users can view their own dismissed flashbacks" on public.flashbacks_cache;
create policy "Users can view their own dismissed flashbacks"
  on public.flashbacks_cache for select
  using (auth.uid() = user_id);

drop policy if exists "Users can dismiss their own flashback" on public.flashbacks_cache;
create policy "Users can dismiss their own flashback"
  on public.flashbacks_cache for insert
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. memory_highlights — saved/pinned highlight reels. Candidate reels
--    ("Best memories this month", "Most viewed") are computed live by
--    get_highlight_candidates() below, cheap enough at this scale to
--    never need materializing; this table is only where a user's
--    explicit "keep this reel" choice is persisted.
-- ---------------------------------------------------------------------------
create table if not exists public.memory_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  highlight_type text not null check (highlight_type in ('best_month', 'most_viewed', 'most_reacted', 'custom')),
  capsule_ids uuid[] not null default '{}',
  moment_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists memory_highlights_user_id_idx on public.memory_highlights (user_id);

alter table public.memory_highlights enable row level security;

drop policy if exists "Users can view their own saved highlights" on public.memory_highlights;
create policy "Users can view their own saved highlights"
  on public.memory_highlights for select
  using (auth.uid() = user_id);

drop policy if exists "Users can save their own highlight reel" on public.memory_highlights;
create policy "Users can save their own highlight reel"
  on public.memory_highlights for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own saved highlight" on public.memory_highlights;
create policy "Users can delete their own saved highlight"
  on public.memory_highlights for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. seed_default_collections — idempotent (ON CONFLICT DO NOTHING on
--    the (user_id, name) unique constraint), safe to call every time the
--    Collections view loads.
-- ---------------------------------------------------------------------------
create or replace function public.seed_default_collections()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into memory_collections (user_id, name, icon, is_default)
  values
    (auth.uid(), 'Travel', '✈️', true),
    (auth.uid(), 'Family', '👨‍👩‍👧‍👦', true),
    (auth.uid(), 'Friends', '🤝', true),
    (auth.uid(), 'School', '🎓', true),
    (auth.uid(), 'Work', '💼', true),
    (auth.uid(), 'Birthday', '🎂', true),
    (auth.uid(), 'Graduation', '🎓', true),
    (auth.uid(), 'Vacation', '🏖️', true),
    (auth.uid(), 'Pets', '🐾', true),
    (auth.uid(), 'Love', '❤️', true),
    (auth.uid(), 'Music', '🎵', true),
    (auth.uid(), 'Sports', '🏀', true)
  on conflict (user_id, name) do nothing;
end;
$$;

grant execute on function public.seed_default_collections() to authenticated;

create or replace function public.get_collections()
returns table (id uuid, name text, icon text, is_default boolean, item_count bigint, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    mc.id, mc.name, mc.icon, mc.is_default,
    (select count(*) from collection_items ci where ci.collection_id = mc.id) as item_count,
    mc.created_at
  from memory_collections mc
  where mc.user_id = auth.uid()
  order by mc.is_default desc, mc.created_at asc;
$$;

grant execute on function public.get_collections() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. get_memories — the one workhorse RPC behind Timeline, Search,
--    Filters, Favorites, and Collections. UNIONs capsules and moments
--    into one normalized shape; content nulling for a still-locked
--    capsule follows the exact same rule as everywhere else. Moments
--    only ever appear once expired — an active moment belongs to the
--    live tray, not here.
--
--    Visibility, plain language: p_user_id defaults to the caller (your
--    own library). Viewing your own memories always includes locked
--    capsules (an "in progress" entry in your own timeline) and never
--    includes hidden ones unless p_include_hidden is set. Viewing
--    someone else's always excludes locked capsules, always excludes
--    hidden ones, and still runs through can_view_capsule/
--    can_view_moment — "explicitly shared" per the phase's own wording.
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
          and ((ci.capsule_id = memories.id and memories.memory_type = 'capsule') or (ci.moment_id = memories.id and memories.memory_type = 'moment'))
      ))
    order by
      case when p_sort = 'oldest' then memories.created_at end asc,
      case when p_sort <> 'oldest' then memories.created_at end desc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.get_memories(uuid, text, text, int, int, text, text, text, boolean, uuid, boolean, boolean, text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. get_memory — a single memory's full row, same shape as get_memories,
--    for the Memory Details page and Flashback/Highlight cards. Locked
--    content stays nulled for the same reasons as everywhere else.
-- ---------------------------------------------------------------------------
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
  else
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
  end if;
end;
$$;

grant execute on function public.get_memory(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. get_memory_calendar — day-level indicators for a given month, own
--    memories only (locked capsules count as a day marker too — "there's
--    something here," same as the main Timeline).
-- ---------------------------------------------------------------------------
create or replace function public.get_memory_calendar(p_year int, p_month int)
returns table (day int, memory_count int)
language sql
stable
security definer
set search_path = public
as $$
  select extract(day from d.created_at)::int as day, count(*)::int as memory_count
  from (
    select created_at from capsules
    where user_id = auth.uid() and hidden_at is null
      and extract(year from created_at) = p_year and extract(month from created_at) = p_month
    union all
    select created_at from moments
    where user_id = auth.uid() and hidden_at is null and expires_at <= now()
      and extract(year from created_at) = p_year and extract(month from created_at) = p_month
  ) d
  group by 1
  order by 1;
$$;

grant execute on function public.get_memory_calendar(int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. get_memory_year_counts — for the Years view, own memories only.
-- ---------------------------------------------------------------------------
create or replace function public.get_memory_year_counts()
returns table (year int, memory_count int)
language sql
stable
security definer
set search_path = public
as $$
  select extract(year from d.created_at)::int as year, count(*)::int as memory_count
  from (
    select created_at from capsules where user_id = auth.uid() and hidden_at is null
    union all
    select created_at from moments where user_id = auth.uid() and hidden_at is null and expires_at <= now()
  ) d
  group by 1
  order by 1 desc;
$$;

grant execute on function public.get_memory_year_counts() to authenticated;

-- ---------------------------------------------------------------------------
-- 11. get_flashbacks — "on this day," own memories only, any past year.
--     Excludes anything already dismissed today.
-- ---------------------------------------------------------------------------
create or replace function public.get_flashbacks()
returns table (
  id uuid, memory_type text, title text, caption text, media jsonb, mood text,
  created_at timestamptz, years_ago int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id, d.memory_type, d.title, d.caption, d.media, d.mood, d.created_at,
    (extract(year from now()) - extract(year from d.created_at))::int as years_ago
  from (
    select c.id, 'capsule'::text as memory_type, c.title, c.memory_text as caption,
      coalesce((select jsonb_agg(jsonb_build_object('url', cm.media_url, 'type', cm.media_type, 'position', cm.position) order by cm.position) from capsule_media cm where cm.capsule_id = c.id), '[]'::jsonb) as media,
      c.mood, c.created_at
    from capsules c
    where c.user_id = auth.uid() and c.hidden_at is null and c.unlock_date <= now()
      and extract(month from c.created_at) = extract(month from now())
      and extract(day from c.created_at) = extract(day from now())
      and extract(year from c.created_at) < extract(year from now())
      and not exists (
        select 1 from flashbacks_cache fc
        where fc.capsule_id = c.id and fc.user_id = auth.uid() and fc.flashback_date = current_date and fc.dismissed
      )

    union all

    select m.id, 'moment'::text, null, m.text_content, case when m.media_url is not null then jsonb_build_array(jsonb_build_object('url', m.media_url, 'type', m.media_type, 'position', 0)) else '[]'::jsonb end,
      m.mood, m.created_at
    from moments m
    where m.user_id = auth.uid() and m.hidden_at is null and m.expires_at <= now()
      and extract(month from m.created_at) = extract(month from now())
      and extract(day from m.created_at) = extract(day from now())
      and extract(year from m.created_at) < extract(year from now())
      and not exists (
        select 1 from flashbacks_cache fc
        where fc.moment_id = m.id and fc.user_id = auth.uid() and fc.flashback_date = current_date and fc.dismissed
      )
  ) d
  order by d.created_at desc;
$$;

grant execute on function public.get_flashbacks() to authenticated;

create or replace function public.dismiss_flashback(p_memory_type text, p_memory_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_memory_type = 'capsule' then
    insert into flashbacks_cache (user_id, capsule_id, flashback_date, dismissed)
    values (auth.uid(), p_memory_id, current_date, true)
    on conflict (user_id, capsule_id, flashback_date) do update set dismissed = true;
  else
    insert into flashbacks_cache (user_id, moment_id, flashback_date, dismissed)
    values (auth.uid(), p_memory_id, current_date, true)
    on conflict (user_id, moment_id, flashback_date) do update set dismissed = true;
  end if;
end;
$$;

grant execute on function public.dismiss_flashback(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. get_highlight_candidates / get_memory_streak — Highlights view.
--     "Longest streak" is a number, not a reel, so it gets its own
--     small RPC rather than being forced into the same row shape.
-- ---------------------------------------------------------------------------
create or replace function public.get_highlight_candidates(p_type text, p_limit int default 10)
returns table (
  id uuid, memory_type text, title text, caption text, media jsonb, mood text,
  created_at timestamptz, score int
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.memory_type, d.title, d.caption, d.media, d.mood, d.created_at, d.score
  from (
    select
      c.id, 'capsule'::text as memory_type, c.title, c.memory_text as caption,
      coalesce((select jsonb_agg(jsonb_build_object('url', cm.media_url, 'type', cm.media_type, 'position', cm.position) order by cm.position) from capsule_media cm where cm.capsule_id = c.id), '[]'::jsonb) as media,
      c.mood, c.created_at,
      case p_type
        when 'best_month' then c.like_count + c.comment_count
        when 'most_viewed' then (select count(*)::int from capsule_views cv where cv.capsule_id = c.id)
        when 'most_reacted' then c.like_count
        else 0
      end as score
    from capsules c
    where c.user_id = auth.uid() and c.hidden_at is null and c.unlock_date <= now()
      and (p_type <> 'best_month' or c.created_at >= date_trunc('month', now()))

    union all

    select
      m.id, 'moment'::text, null, m.text_content,
      case when m.media_url is not null then jsonb_build_array(jsonb_build_object('url', m.media_url, 'type', m.media_type, 'position', 0)) else '[]'::jsonb end,
      m.mood, m.created_at,
      case p_type
        when 'best_month' then (select count(*)::int from moment_reactions mr where mr.moment_id = m.id)
        when 'most_viewed' then m.view_count
        when 'most_reacted' then (select count(*)::int from moment_reactions mr where mr.moment_id = m.id)
        else 0
      end as score
    from moments m
    where m.user_id = auth.uid() and m.hidden_at is null and m.expires_at <= now()
      and (p_type <> 'best_month' or m.created_at >= date_trunc('month', now()))
  ) d
  where d.score > 0
  order by d.score desc, d.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_highlight_candidates(text, int) to authenticated;

create or replace function public.get_memory_streak()
returns table (current_streak int, longest_streak int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dates date[];
  v_current int := 0;
  v_longest int := 0;
  v_running int := 0;
  v_prev date := null;
  v_d date;
begin
  select array_agg(distinct d order by d desc) into v_dates
  from (
    select created_at::date as d from capsules where user_id = auth.uid() and hidden_at is null
    union
    select created_at::date as d from moments where user_id = auth.uid() and hidden_at is null and expires_at <= now()
  ) x;

  if v_dates is null then
    return query select 0, 0;
    return;
  end if;

  foreach v_d in array v_dates loop
    if v_prev is null then
      v_running := 1;
    elsif v_prev - v_d = 1 then
      v_running := v_running + 1;
    else
      v_running := 1;
    end if;
    v_longest := greatest(v_longest, v_running);
    v_prev := v_d;
  end loop;

  -- current streak only counts if it reaches up to today or yesterday
  if v_dates[1] >= current_date - 1 then
    v_prev := null;
    foreach v_d in array v_dates loop
      if v_prev is null then
        v_current := 1;
      elsif v_prev - v_d = 1 then
        v_current := v_current + 1;
      else
        exit;
      end if;
      v_prev := v_d;
    end loop;
  end if;

  return query select v_current, v_longest;
end;
$$;

grant execute on function public.get_memory_streak() to authenticated;
