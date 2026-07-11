-- Phase 14f — Memory Calendar becomes activity-based.
--
-- Before: get_memory_calendar() only unioned capsules+moments'
-- created_at (no Drops at all, no unlock dates, no save-to-unlock),
-- and the frontend day-tap filter only matched created_at too — so a
-- Drop never showed up, an item's eventual unlock date never showed
-- up, and "I saved this to unlock later" never showed up either.
--
-- After: two new functions treat "dropped" / "unlocked" / "saved" as
-- three separate dateable events per item, across all three content
-- types where each applies:
--   dropped  — you created it (Drops, Capsules, Moments)
--   unlocked — its unlock_date, whether already past or still in the
--              future (Drops, Capsules only — Moments have no lock
--              step) — anything YOU can currently see: your own, a
--              followed account's, or a public non-private account's.
--              A future date here is deliberate: it's how "this saved
--              Drop unlocks on the 24th" becomes visible on the
--              calendar ahead of time, not just after the fact.
--   saved    — you marked it Save-to-Unlock (Drops) or saved it
--              (Capsules), dated at when you saved it, not the
--              content's own created_at.
-- Content is still never revealed early — the same
-- `case when unlock_date <= now() then real_value else null end`
-- discipline every other read path in this app uses. get_memory_activity_day()
-- returns full get_memories()-shaped rows (activity_type/activity_at
-- prepended) specifically so the frontend can reuse the existing
-- MemoryCard component instead of a parallel rendering path.

-- ---------------------------------------------------------------------------
-- 1. get_memory_activity_calendar — lightweight day/type counts for the
--    month grid's dot indicators.
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
      where user_id = auth.uid()

    union all
    select unlock_date, 'unlocked' from capsules c
      where (c.user_id = auth.uid() or (not is_blocked_either_way(c.user_id) and c.moderation_status = 'active'))
        and can_view_capsule(c.user_id, c.visibility)
    union all
    select unlock_date, 'unlocked' from posts p
      where not exists (select 1 from hidden_posts h where h.post_id = p.id and h.user_id = auth.uid())
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and p.moderation_status = 'active'))
        and can_view_drop(p.user_id, p.visibility)

    union all
    select cs.created_at, 'saved' from capsule_saves cs where cs.user_id = auth.uid()
    union all
    select di.created_at, 'saved' from drop_interests di
      where di.user_id = auth.uid() and di.interest_type = 'save_to_unlock'
  ) d
  where extract(year from d.activity_at) = p_year and extract(month from d.activity_at) = p_month
  group by 1, 2
  order by 1;
$$;

grant execute on function public.get_memory_activity_calendar(int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_memory_activity_day — full item detail for one tapped day,
--    reusing get_memories()'s exact row shape (activity_type/activity_at
--    prepended) so the frontend can render each entry with the same
--    MemoryCard used everywhere else.
-- ---------------------------------------------------------------------------
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
    -- dropped: own content only, across all three types
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

    union all

    -- unlocked: any visible capsule/drop (own, followed, or public
    -- non-private), dated at unlock_date whether past or future.
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
    where not exists (select 1 from hidden_posts h where h.post_id = p.id and h.user_id = auth.uid())
      and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and p.moderation_status = 'active'))
      and can_view_drop(p.user_id, p.visibility)

    union all

    -- saved: your own save actions, dated at when you saved (not the
    -- content's own created_at).
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
    where di.user_id = auth.uid() and di.interest_type = 'save_to_unlock'
  ) as d(
    activity_type, activity_at, id, memory_type, user_id, username, display_name, profile_photo_url,
    title, caption, media, memory_types, mood, location_text, tags, visibility, is_unlocked, is_own,
    is_favorited, is_hidden, view_count, like_count, comment_count, matured_at, created_at
  )
  where extract(year from d.activity_at) = p_year and extract(month from d.activity_at) = p_month and extract(day from d.activity_at) = p_day
  order by d.activity_at desc;
$$;

grant execute on function public.get_memory_activity_day(int, int, int) to authenticated;
