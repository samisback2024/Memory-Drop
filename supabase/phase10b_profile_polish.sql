-- Memory Drop — Phase 10b: Profile Polish.
-- Run once, after supabase/phase10_search_explore.sql, in the Supabase
-- SQL editor. Safe to re-run — every statement is idempotent.
--
-- Second of six Phase 10 sub-phases. Before writing anything here, an
-- audit of the brief's nine profile bullets against what already shipped
-- found six were already done:
--   - Memory Statistics dashboard        → ProfileStatsCard (Phase 9)
--   - Achievement section                → BadgesAndAchievements (Phase 2)
--   - Recently unlocked memories         → "Recent Memories" (Phase 9)
--   - Mutual friends display             → MutualFriends (Phase 3), on
--                                           PublicProfilePage only — a
--                                           mutual-friends count with
--                                           yourself isn't a meaningful
--                                           thing to show on your own
--                                           profile, so this was never
--                                           missing, just correctly scoped
--   - Public Capsules / Public Moments   → same client-filter pattern
--     sections                             Phase 9 already used for
--                                           "Locked Drops" (fetch once,
--                                           filter by memory_type), no
--                                           new SQL needed — done in the
--                                           frontend pass, not here
-- That leaves two genuinely new capabilities, both added here:
--   1. Pinned Memories / Pinned Drops — a new `pinned_items` table
--      (max 6 per user, own-content-only) plus `get_pinned_memories()`.
--   2. Activity timeline — a new `get_activity_timeline()` RPC. Live-
--      computed from existing tables (create/comment timestamps),
--      deliberately NOT a trigger-populated log table: a log only
--      starts recording from the moment it's added, while a live query
--      has full history from day one, and this app's established
--      pattern (memory_items_view, get_memory_stats) already prefers
--      "derive it fresh" over "track it separately and hope it doesn't
--      drift." Scope is intentionally creation + comment events only —
--      see README Known limitations for why reactions/likes aren't
--      included in this pass.

-- ---------------------------------------------------------------------------
-- 1. pinned_items — up to 6 per user, own content only. Unlike
--    favorites/collection_items (which can reference anything visible
--    to you), pins are a "showcase on my own profile" feature — you can
--    only ever pin something you own.
-- ---------------------------------------------------------------------------
create table if not exists public.pinned_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  capsule_id uuid references public.capsules(id) on delete cascade,
  moment_id uuid references public.moments(id) on delete cascade,
  drop_id uuid references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint pinned_items_check check (
    (capsule_id is not null)::int + (moment_id is not null)::int + (drop_id is not null)::int = 1
  )
);

create unique index if not exists pinned_items_user_capsule_idx on public.pinned_items (user_id, capsule_id) where capsule_id is not null;
create unique index if not exists pinned_items_user_moment_idx on public.pinned_items (user_id, moment_id) where moment_id is not null;
create unique index if not exists pinned_items_user_drop_idx on public.pinned_items (user_id, drop_id) where drop_id is not null;
create index if not exists pinned_items_user_id_idx on public.pinned_items (user_id);

alter table public.pinned_items enable row level security;

drop policy if exists "Anyone can view pins (filtered by RPC visibility)" on public.pinned_items;
create policy "Users can view their own pins"
  on public.pinned_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can pin their own content" on public.pinned_items;
create policy "Users can pin their own content"
  on public.pinned_items for insert
  with check (
    auth.uid() = user_id
    and (
      (capsule_id is not null and exists (select 1 from capsules c where c.id = capsule_id and c.user_id = auth.uid()))
      or (moment_id is not null and exists (select 1 from moments m where m.id = moment_id and m.user_id = auth.uid()))
      or (drop_id is not null and exists (select 1 from posts p where p.id = drop_id and p.user_id = auth.uid()))
    )
  );

drop policy if exists "Users can unpin their own content" on public.pinned_items;
create policy "Users can unpin their own content"
  on public.pinned_items for delete
  using (auth.uid() = user_id);

create or replace function public.enforce_pin_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.pinned_items where user_id = new.user_id) >= 6 then
    raise exception 'You can only pin up to 6 memories at a time — unpin one first.';
  end if;
  return new;
end;
$$;

drop trigger if exists pinned_items_limit on public.pinned_items;
create trigger pinned_items_limit
  before insert on public.pinned_items
  for each row execute function public.enforce_pin_limit();

-- get_pinned_memories() — same Memory row shape as get_memories(), plus
-- pinned_at. A pin can exist on still-locked own content (the INSERT
-- policy only checks ownership, not unlock state) — it simply won't
-- appear here until it unlocks, same "no peeking early" rule as
-- everywhere else. RLS on pinned_items is SELECT-own-only, so this
-- being SECURITY DEFINER is what lets someone else's profile page read
-- your pins at all — same reason as every other cross-user read in
-- this app.
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
-- 2. get_activity_timeline() — live-computed, five event types: created a
--    Drop/Capsule/Moment, commented on a Drop/Capsule. Each branch reuses
--    the exact same visibility predicate the underlying content itself
--    already uses, so an activity item is never visible to someone who
--    couldn't already see the thing it's about. Reflections and moment
--    replies are excluded on purpose — both are private-by-construction
--    everywhere else in this app (see Security notes), so they don't
--    belong in a feed anyone but the author can see.
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
