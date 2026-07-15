-- Phase 21 — re-applies a fix that should already be live from
-- phase14u_soft_delete_memories_gap.sql but apparently isn't: a deleted
-- Drop still shows as a tile on the Explore tab (its permalink already
-- correctly says "This memory doesn't exist, or isn't visible to you"
-- via get_memory, but the grid feeding Explore never learned the same
-- `deleted_at is null` filter). phase14u is a large single script that
-- redefines get_memory *before* search_memories/get_explore_feed later
-- in the same file — if it was only partially run, get_memory's fix
-- would land while these two wouldn't, which matches exactly what's
-- being seen live. This migration only touches these two functions
-- (get_memory is already confirmed working and is left alone) so it's
-- a small, safe re-apply rather than re-running the whole old file.
-- Bodies copied verbatim from phase14u — no logic changes, no frontend
-- changes needed.

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
