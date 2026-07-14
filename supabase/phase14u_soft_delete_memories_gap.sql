-- Phase 14u — closes the gap phase14s's own comment flagged and deferred:
-- "A soft-deleted drop may still surface in Memories/Search/Explore for
-- up to 30 days until purged." Confirmed live — a deleted Drop kept
-- showing on the Memories tab. phase14s only taught the Feed's three
-- read paths (get_drops_feed/get_drop/get_saved_drops) and the base
-- posts RLS policy about deleted_at; every other function that reads
-- `posts` directly for display or counting never learned. This
-- migration adds the same `deleted_at is null` filter everywhere else
-- posts content is surfaced — all CREATE OR REPLACE, same signatures,
-- no frontend changes needed.
--
-- Worth noting: this was more than self-clutter. search_memories() and
-- get_explore_feed() had no owner check on the drop branch at all — a
-- deleted drop was still visible to *other* users in Search/Explore for
-- the full 30-day grace window, not just to the owner in their own
-- Memories tab.

-- ---------------------------------------------------------------------------
-- 1. memory_items_view — feeds get_memory_stats()/get_public_stats()'s
--    locked/unlocked counts. Fixing this one view fixes those counts
--    for free, no separate edit needed there.
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
  where p.deleted_at is null

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

revoke all on public.memory_items_view from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- 2. get_memories() — Memories tab list. Drop branch gains deleted_at.
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
        and p.deleted_at is null
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

-- ---------------------------------------------------------------------------
-- 3. get_memory() — a single Memories detail open. Drop branch gains
--    deleted_at (a deleted drop's permalink now 404s via EmptyState like
--    any other not-found memory, instead of still rendering).
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
        and p.deleted_at is null
        and not is_blocked_either_way(p.user_id)
        and (p.user_id = auth.uid() or (p.unlock_date <= now() and can_view_drop(p.user_id, p.visibility)));
  end if;
end;
$$;

grant execute on function public.get_memory(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. search_memories() / get_explore_feed() — this was the sharper of
--    the two bugs: neither had an owner check on the drop branch at
--    all, so a deleted drop stayed visible to *other* users searching
--    or exploring, not just to the owner.
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
        and p.deleted_at is null
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
        and p.deleted_at is null
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
-- 5. get_pinned_memories() — a pinned drop that gets deleted now drops
--    off the pinned rail instead of dangling there.
-- ---------------------------------------------------------------------------
create or replace function public.get_pinned_memories(p_user_id uuid default null)
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
  created_at timestamptz,
  pinned_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
begin
  if is_blocked_either_way(v_target) then
    return;
  end if;

  return query
    select * from (
      select
        c.id, 'capsule'::text, c.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        c.title, c.memory_text,
        coalesce(
          (select jsonb_agg(jsonb_build_object('url', cm.media_url, 'type', cm.media_type, 'position', cm.position) order by cm.position)
           from capsule_media cm where cm.capsule_id = c.id), '[]'::jsonb
        ),
        c.memory_types, c.mood, c.location_text, c.tags,
        (case c.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end),
        true, (c.user_id = auth.uid()),
        exists(select 1 from favorites f where f.capsule_id = c.id and f.user_id = auth.uid()),
        (c.hidden_at is not null),
        (select count(*)::int from capsule_views cv where cv.capsule_id = c.id),
        c.like_count, c.comment_count, c.unlock_date, c.created_at,
        pi.created_at
      from pinned_items pi
      join capsules c on c.id = pi.capsule_id
      join profiles pr on pr.id = c.user_id
      where pi.user_id = v_target
        and c.unlock_date <= now()
        and c.hidden_at is null
        and (c.user_id = auth.uid() or can_view_capsule(c.user_id, c.visibility))

      union all

      select
        m.id, 'moment'::text, m.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        null::text, m.text_content,
        case when m.media_url is not null then jsonb_build_array(jsonb_build_object('url', m.media_url, 'type', m.media_type, 'position', 0)) else '[]'::jsonb end,
        array[m.media_type]::text[], m.mood, m.location_text, m.tags,
        (case m.privacy when 'everyone' then 'public' when 'close_friends' then 'followers' when 'followers' then 'followers' else 'only_me' end),
        true, (m.user_id = auth.uid()),
        exists(select 1 from favorites f where f.moment_id = m.id and f.user_id = auth.uid()),
        (m.hidden_at is not null),
        m.view_count, 0, 0, m.expires_at, m.created_at,
        pi.created_at
      from pinned_items pi
      join moments m on m.id = pi.moment_id
      join profiles pr on pr.id = m.user_id
      where pi.user_id = v_target
        and m.expires_at <= now()
        and m.hidden_at is null
        and (m.user_id = auth.uid() or can_view_moment(m.user_id, m.privacy))

      union all

      select
        p.id, 'drop'::text, p.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        null::text, p.caption,
        coalesce(
          (select jsonb_agg(jsonb_build_object('url', pi2.image_url, 'type', 'photo', 'position', pi2.position) order by pi2.position)
           from post_images pi2 where pi2.post_id = p.id),
          (case when p.video_url is not null then jsonb_build_array(jsonb_build_object('url', p.video_url, 'type', 'video', 'position', 0))
                when p.audio_url is not null then jsonb_build_array(jsonb_build_object('url', p.audio_url, 'type', 'audio', 'position', 0))
                else '[]'::jsonb end)
        ),
        array[p.post_type]::text[], p.mood, null::text, '{}'::text[],
        (case p.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end),
        true, (p.user_id = auth.uid()),
        exists(select 1 from favorites f where f.drop_id = p.id and f.user_id = auth.uid()),
        false,
        (select count(*)::int from drop_unlock_views dv where dv.drop_id = p.id),
        p.like_count, p.comment_count, p.unlock_date, p.created_at,
        pi.created_at
      from pinned_items pi
      join posts p on p.id = pi.drop_id
      join profiles pr on pr.id = p.user_id
      where pi.user_id = v_target
        and p.deleted_at is null
        and p.unlock_date <= now()
        and (p.user_id = auth.uid() or can_view_drop(p.user_id, p.visibility))
    ) as pinned(
      id, memory_type, user_id, username, display_name, profile_photo_url, title, caption, media,
      memory_types, mood, location_text, tags, visibility, is_unlocked, is_own, is_favorited, is_hidden,
      view_count, like_count, comment_count, matured_at, created_at, pinned_at
    )
    order by pinned_at desc;
end;
$$;

grant execute on function public.get_pinned_memories(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. get_activity_timeline() — a deleted drop's "created"/"commented on"
--    entries drop off the Activity feed too.
-- ---------------------------------------------------------------------------
create or replace function public.get_activity_timeline(p_user_id uuid default null, p_limit int default 20, p_offset int default 0)
returns table (
  activity_type text,
  source_type text,
  source_id uuid,
  snippet text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
begin
  if is_blocked_either_way(v_target) then
    return;
  end if;

  return query
    select * from (
      select 'created'::text, 'drop'::text, p.id, null::text, p.created_at
      from posts p
      where p.user_id = v_target
        and p.deleted_at is null
        and (p.user_id = auth.uid() or (p.unlock_date <= now() and can_view_drop(p.user_id, p.visibility)))

      union all

      select 'created'::text, 'capsule'::text, c.id, c.title, c.created_at
      from capsules c
      where c.user_id = v_target
        and c.hidden_at is null
        and (c.user_id = auth.uid() or (c.unlock_date <= now() and can_view_capsule(c.user_id, c.visibility)))

      union all

      select 'created'::text, 'moment'::text, m.id, null::text, m.created_at
      from moments m
      where m.user_id = v_target
        and m.hidden_at is null
        and (m.user_id = auth.uid() or can_view_moment(m.user_id, m.privacy))

      union all

      select 'commented'::text, 'drop'::text, cm.post_id, left(cm.content, 80), cm.created_at
      from comments cm
      join posts p on p.id = cm.post_id
      where cm.user_id = v_target
        and cm.is_reflection = false
        and p.deleted_at is null
        and not is_blocked_either_way(p.user_id)
        and (p.user_id = auth.uid() or (p.unlock_date <= now() and can_view_drop(p.user_id, p.visibility)))

      union all

      select 'commented'::text, 'capsule'::text, cc.capsule_id, left(cc.content, 80), cc.created_at
      from capsule_comments cc
      join capsules c on c.id = cc.capsule_id
      where cc.user_id = v_target
        and not is_blocked_either_way(c.user_id)
        and c.hidden_at is null
        and (c.user_id = auth.uid() or (c.unlock_date <= now() and can_view_capsule(c.user_id, c.visibility)))
    ) as activity(activity_type, source_type, source_id, snippet, created_at)
    order by activity.created_at desc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.get_activity_timeline(uuid, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. get_memory_stats() / get_public_stats() — every raw `posts` count
--    or sum gains deleted_at is null. locked_items/unlocked_items ride
--    memory_items_view (fixed in section 1 above) for free.
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
    (select count(*) from posts where user_id = auth.uid() and deleted_at is null),
    (select count(*) from memory_items_view where owner_id = auth.uid() and status = 'locked'),
    (select count(*) from memory_items_view where owner_id = auth.uid() and status in ('unlocked', 'expired')),
    (select count(*) from moments where user_id = auth.uid() and expires_at <= now()),
    (select count(*) from drop_interests di join posts p on p.id = di.drop_id where p.user_id = auth.uid() and p.deleted_at is null and di.interest_type = 'save_to_unlock'),
    (select count(*) from posts where user_id = auth.uid() and deleted_at is null and visibility = 'public'),
    (select count(*) from follows where following_id = auth.uid() and status = 'accepted'),
    (select count(*) from follows where follower_id = auth.uid() and status = 'accepted'),
    (
      coalesce((select count(*) from capsule_views cv join capsules c on c.id = cv.capsule_id where c.user_id = auth.uid()), 0)
      + coalesce((select count(*) from drop_unlock_views dv join posts p on p.id = dv.drop_id where p.user_id = auth.uid() and p.deleted_at is null), 0)
      + coalesce((select count(*) from moment_views mv join moments m on m.id = mv.moment_id where m.user_id = auth.uid()), 0)
    ),
    (
      coalesce((select count(*) from capsule_unlocks cu join capsules c on c.id = cu.capsule_id where c.user_id = auth.uid()), 0)
      + coalesce((select count(*) from drop_unlock_views dv join posts p on p.id = dv.drop_id where p.user_id = auth.uid() and p.deleted_at is null), 0)
      + coalesce((select count(*) from moment_views mv join moments m on m.id = mv.moment_id where m.user_id = auth.uid()), 0)
    ),
    (
      coalesce((select sum(like_count) from posts where user_id = auth.uid() and deleted_at is null), 0)
      + coalesce((select sum(like_count) from capsules where user_id = auth.uid()), 0)
      + coalesce((select count(*) from moment_reactions mr join moments m on m.id = mr.moment_id where m.user_id = auth.uid()), 0)
      + coalesce((select count(*) from drop_interests di join posts p on p.id = di.drop_id where p.user_id = auth.uid() and p.deleted_at is null), 0)
    ),
    (
      coalesce((select sum(comment_count) from posts where user_id = auth.uid() and deleted_at is null), 0)
      + coalesce((select sum(comment_count) from capsules where user_id = auth.uid()), 0)
      + coalesce((select count(*) from moment_replies mr join moments m on m.id = mr.moment_id where m.user_id = auth.uid()), 0)
    );
$$;

grant execute on function public.get_memory_stats() to authenticated;

create or replace function public.get_public_stats(p_user_id uuid)
returns table (
  public_memories_count bigint,
  followers_count bigint,
  following_count bigint,
  total_drops bigint,
  locked_items bigint,
  unlocked_items bigint,
  expired_moments bigint,
  saved_to_unlock bigint,
  public_drops bigint,
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
    (
      coalesce((select count(*) from posts p where p.user_id = p_user_id and p.deleted_at is null and p.visibility = 'public' and p.unlock_date <= now() and not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)), 0)
      + coalesce((select count(*) from capsules c where c.user_id = p_user_id and c.visibility = 'public' and c.unlock_date <= now() and c.hidden_at is null and not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)), 0)
      + coalesce((select count(*) from moments m where m.user_id = p_user_id and m.privacy = 'everyone' and m.expires_at <= now() and m.hidden_at is null and not is_blocked_either_way(m.user_id) and can_view_moment(m.user_id, m.privacy)), 0)
    ),
    (select count(*) from follows where following_id = p_user_id and status = 'accepted'),
    (select count(*) from follows where follower_id = p_user_id and status = 'accepted'),

    case when 'total_drops' = any(vs.visible_stats) then
      (select count(*) from posts where user_id = p_user_id and deleted_at is null)
    end,
    case when 'locked_items' = any(vs.visible_stats) then
      (select count(*) from memory_items_view where owner_id = p_user_id and status = 'locked')
    end,
    case when 'unlocked_items' = any(vs.visible_stats) then
      (select count(*) from memory_items_view where owner_id = p_user_id and status in ('unlocked', 'expired'))
    end,
    case when 'expired_moments' = any(vs.visible_stats) then
      (select count(*) from moments where user_id = p_user_id and expires_at <= now())
    end,
    case when 'saved_to_unlock' = any(vs.visible_stats) then
      (select count(*) from drop_interests di join posts p on p.id = di.drop_id where p.user_id = p_user_id and p.deleted_at is null and di.interest_type = 'save_to_unlock')
    end,
    case when 'public_drops' = any(vs.visible_stats) then
      (select count(*) from posts where user_id = p_user_id and deleted_at is null and visibility = 'public')
    end,
    case when 'total_views' = any(vs.visible_stats) then
      coalesce((select count(*) from capsule_views cv join capsules c on c.id = cv.capsule_id where c.user_id = p_user_id), 0)
      + coalesce((select count(*) from drop_unlock_views dv join posts p on p.id = dv.drop_id where p.user_id = p_user_id and p.deleted_at is null), 0)
      + coalesce((select count(*) from moment_views mv join moments m on m.id = mv.moment_id where m.user_id = p_user_id), 0)
    end,
    case when 'total_unlocks' = any(vs.visible_stats) then
      coalesce((select count(*) from capsule_unlocks cu join capsules c on c.id = cu.capsule_id where c.user_id = p_user_id), 0)
      + coalesce((select count(*) from drop_unlock_views dv join posts p on p.id = dv.drop_id where p.user_id = p_user_id and p.deleted_at is null), 0)
      + coalesce((select count(*) from moment_views mv join moments m on m.id = mv.moment_id where m.user_id = p_user_id), 0)
    end,
    case when 'total_reactions' = any(vs.visible_stats) then
      coalesce((select sum(like_count) from posts where user_id = p_user_id and deleted_at is null), 0)
      + coalesce((select sum(like_count) from capsules where user_id = p_user_id), 0)
      + coalesce((select count(*) from moment_reactions mr join moments m on m.id = mr.moment_id where m.user_id = p_user_id), 0)
      + coalesce((select count(*) from drop_interests di join posts p on p.id = di.drop_id where p.user_id = p_user_id and p.deleted_at is null), 0)
    end,
    case when 'total_comments' = any(vs.visible_stats) then
      coalesce((select sum(comment_count) from posts where user_id = p_user_id and deleted_at is null), 0)
      + coalesce((select sum(comment_count) from capsules where user_id = p_user_id), 0)
      + coalesce((select count(*) from moment_replies mr join moments m on m.id = mr.moment_id where m.user_id = p_user_id), 0)
    end
  from (select coalesce((select us.visible_stats from user_settings us where us.user_id = p_user_id), '{}'::text[]) as visible_stats) vs;
$$;

grant execute on function public.get_public_stats(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. get_memory_activity_calendar() / get_memory_activity_day() — a
--    deleted drop's dot disappears from the calendar grid, and tapping
--    the day it was on no longer shows it.
-- ---------------------------------------------------------------------------
create or replace function public.get_memory_activity_calendar(p_year int, p_month int)
returns table (day int, activity_type text, item_count int)
language sql
stable
security definer
set search_path = public
as $$
  select extract(day from d.activity_at)::int as day, d.activity_type, count(*)::int as item_count
  from (
    select created_at as activity_at, 'dropped'::text as activity_type from capsules
      where user_id = auth.uid()
    union all
    select created_at, 'dropped' from moments
      where user_id = auth.uid()
    union all
    select created_at, 'dropped' from posts
      where user_id = auth.uid() and deleted_at is null

    union all
    select unlock_date, 'unlocked' from capsules c
      where (c.user_id = auth.uid() or (not is_blocked_either_way(c.user_id) and c.moderation_status = 'active'))
        and can_view_capsule(c.user_id, c.visibility)
    union all
    select unlock_date, 'unlocked' from posts p
      where p.deleted_at is null
        and not exists (select 1 from hidden_posts h where h.post_id = p.id and h.user_id = auth.uid())
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and p.moderation_status = 'active'))
        and can_view_drop(p.user_id, p.visibility)

    union all
    select cs.created_at, 'saved' from capsule_saves cs where cs.user_id = auth.uid()
    union all
    select di.created_at, 'saved' from drop_interests di
      join posts p on p.id = di.drop_id
      where di.user_id = auth.uid() and di.interest_type = 'save_to_unlock' and p.deleted_at is null
  ) d
  where extract(year from d.activity_at) = p_year and extract(month from d.activity_at) = p_month
  group by 1, 2
  order by 1;
$$;

grant execute on function public.get_memory_activity_calendar(int, int) to authenticated;

create or replace function public.get_memory_activity_day(p_year int, p_month int, p_day int)
returns table (
  activity_type text,
  activity_at timestamptz,
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
language sql
stable
security definer
set search_path = public
as $$
  select d.activity_type, d.activity_at,
    d.id, d.memory_type, d.user_id, d.username, d.display_name, d.profile_photo_url,
    d.title, d.caption, d.media, d.memory_types, d.mood, d.location_text, d.tags,
    d.visibility, d.is_unlocked, d.is_own, d.is_favorited, d.is_hidden,
    d.view_count, d.like_count, d.comment_count, d.matured_at, d.created_at
  from (
    select
      'dropped'::text, c.created_at,
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
      (c.unlock_date <= now()), true,
      exists(select 1 from favorites f where f.capsule_id = c.id and f.user_id = auth.uid()),
      (c.hidden_at is not null),
      (select count(*)::int from capsule_views cv where cv.capsule_id = c.id),
      c.like_count, c.comment_count, c.unlock_date, c.created_at
    from capsules c
    join profiles pr on pr.id = c.user_id
    where c.user_id = auth.uid()

    union all

    select
      'dropped', m.created_at,
      m.id, 'moment', m.user_id, pr.username, pr.display_name, pr.profile_photo_url,
      null::text, m.text_content,
      case when m.media_url is not null then jsonb_build_array(jsonb_build_object('url', m.media_url, 'type', m.media_type, 'position', 0)) else '[]'::jsonb end,
      array[m.media_type]::text[], m.mood, m.location_text, m.tags,
      (case m.privacy when 'everyone' then 'public' when 'close_friends' then 'followers' when 'followers' then 'followers' else 'only_me' end),
      true, true,
      exists(select 1 from favorites f where f.moment_id = m.id and f.user_id = auth.uid()),
      (m.hidden_at is not null),
      m.view_count, 0, 0, m.expires_at, m.created_at
    from moments m
    join profiles pr on pr.id = m.user_id
    where m.user_id = auth.uid()

    union all

    select
      'dropped', p.created_at,
      p.id, 'drop', p.user_id, pr.username, pr.display_name, pr.profile_photo_url,
      null::text,
      case when p.unlock_date <= now() then p.caption else null end,
      case when p.unlock_date <= now() then coalesce(
        (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'type', 'photo', 'position', pi.position) order by pi.position)
         from post_images pi where pi.post_id = p.id),
        (case when p.video_url is not null then jsonb_build_array(jsonb_build_object('url', p.video_url, 'type', 'video', 'position', 0))
              when p.audio_url is not null then jsonb_build_array(jsonb_build_object('url', p.audio_url, 'type', 'audio', 'position', 0))
              else '[]'::jsonb end)
      ) else '[]'::jsonb end,
      array[p.post_type]::text[], p.mood, null::text, '{}'::text[],
      (case p.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end),
      (p.unlock_date <= now()), true,
      exists(select 1 from favorites f where f.drop_id = p.id and f.user_id = auth.uid()),
      false,
      (select count(*)::int from drop_unlock_views dv where dv.drop_id = p.id),
      p.like_count, p.comment_count, p.unlock_date, p.created_at
    from posts p
    join profiles pr on pr.id = p.user_id
    where p.user_id = auth.uid()
      and p.deleted_at is null

    union all

    select
      'unlocked', c.unlock_date,
      c.id, 'capsule', c.user_id, pr.username, pr.display_name, pr.profile_photo_url,
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
      (c.unlock_date <= now()), (c.user_id = auth.uid()),
      exists(select 1 from favorites f where f.capsule_id = c.id and f.user_id = auth.uid()),
      (c.hidden_at is not null),
      (select count(*)::int from capsule_views cv where cv.capsule_id = c.id),
      c.like_count, c.comment_count, c.unlock_date, c.created_at
    from capsules c
    join profiles pr on pr.id = c.user_id
    where (c.user_id = auth.uid() or (not is_blocked_either_way(c.user_id) and c.moderation_status = 'active'))
      and can_view_capsule(c.user_id, c.visibility)

    union all

    select
      'unlocked', p.unlock_date,
      p.id, 'drop', p.user_id, pr.username, pr.display_name, pr.profile_photo_url,
      null::text,
      case when p.unlock_date <= now() then p.caption else null end,
      case when p.unlock_date <= now() then coalesce(
        (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'type', 'photo', 'position', pi.position) order by pi.position)
         from post_images pi where pi.post_id = p.id),
        (case when p.video_url is not null then jsonb_build_array(jsonb_build_object('url', p.video_url, 'type', 'video', 'position', 0))
              when p.audio_url is not null then jsonb_build_array(jsonb_build_object('url', p.audio_url, 'type', 'audio', 'position', 0))
              else '[]'::jsonb end)
      ) else '[]'::jsonb end,
      array[p.post_type]::text[], p.mood, null::text, '{}'::text[],
      (case p.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end),
      (p.unlock_date <= now()), (p.user_id = auth.uid()),
      exists(select 1 from favorites f where f.drop_id = p.id and f.user_id = auth.uid()),
      false,
      (select count(*)::int from drop_unlock_views dv where dv.drop_id = p.id),
      p.like_count, p.comment_count, p.unlock_date, p.created_at
    from posts p
    join profiles pr on pr.id = p.user_id
    where p.deleted_at is null
      and not exists (select 1 from hidden_posts h where h.post_id = p.id and h.user_id = auth.uid())
      and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and p.moderation_status = 'active'))
      and can_view_drop(p.user_id, p.visibility)

    union all

    select
      'saved', cs.created_at,
      c.id, 'capsule', c.user_id, pr.username, pr.display_name, pr.profile_photo_url,
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
      (c.unlock_date <= now()), (c.user_id = auth.uid()),
      true,
      (c.hidden_at is not null),
      (select count(*)::int from capsule_views cv where cv.capsule_id = c.id),
      c.like_count, c.comment_count, c.unlock_date, c.created_at
    from capsule_saves cs
    join capsules c on c.id = cs.capsule_id
    join profiles pr on pr.id = c.user_id
    where cs.user_id = auth.uid()

    union all

    select
      'saved', di.created_at,
      p.id, 'drop', p.user_id, pr.username, pr.display_name, pr.profile_photo_url,
      null::text,
      case when p.unlock_date <= now() then p.caption else null end,
      case when p.unlock_date <= now() then coalesce(
        (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'type', 'photo', 'position', pi.position) order by pi.position)
         from post_images pi where pi.post_id = p.id),
        (case when p.video_url is not null then jsonb_build_array(jsonb_build_object('url', p.video_url, 'type', 'video', 'position', 0))
              when p.audio_url is not null then jsonb_build_array(jsonb_build_object('url', p.audio_url, 'type', 'audio', 'position', 0))
              else '[]'::jsonb end)
      ) else '[]'::jsonb end,
      array[p.post_type]::text[], p.mood, null::text, '{}'::text[],
      (case p.visibility when 'public' then 'public' when 'followers' then 'followers' else 'only_me' end),
      (p.unlock_date <= now()), (p.user_id = auth.uid()),
      true,
      false,
      (select count(*)::int from drop_unlock_views dv where dv.drop_id = p.id),
      p.like_count, p.comment_count, p.unlock_date, p.created_at
    from drop_interests di
    join posts p on p.id = di.drop_id
    join profiles pr on pr.id = p.user_id
    where di.user_id = auth.uid() and di.interest_type = 'save_to_unlock' and p.deleted_at is null
  ) as d(
    activity_type, activity_at, id, memory_type, user_id, username, display_name, profile_photo_url,
    title, caption, media, memory_types, mood, location_text, tags, visibility, is_unlocked, is_own,
    is_favorited, is_hidden, view_count, like_count, comment_count, matured_at, created_at
  )
  where extract(year from d.activity_at) = p_year and extract(month from d.activity_at) = p_month and extract(day from d.activity_at) = p_day
  order by d.activity_at desc;
$$;

grant execute on function public.get_memory_activity_day(int, int, int) to authenticated;
