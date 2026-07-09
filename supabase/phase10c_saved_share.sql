-- Memory Drop — Phase 10c: Bookmark Experience + Share Experience.
-- Run once, after supabase/phase10b_profile_polish.sql, in the Supabase
-- SQL editor. Safe to re-run — every statement is idempotent.
--
-- Third of six Phase 10 sub-phases.
--
-- Bookmark Experience: the existing `/saved` page only ever showed saved
-- Drops (`saved_posts`) via the Drop-specific `get_saved_drops()`. An
-- audit for this phase found a real, pre-existing gap: Capsules have had
-- their own `capsule_saves` table since Phase 6 (the Like/Comment/Save
-- trio), but nothing ever built a page to browse them — `capsule_saves`
-- was write-only from the app's perspective, toggled on a capsule card
-- but never listed anywhere. This phase fixes that by unifying both into
-- one Saved/Bookmarks page, and adds the three genuinely new
-- capabilities the brief asked for: Notes (a free-text column on both
-- save tables), Sort, and Search. "Folders" is deliberately NOT a new
-- parallel table — Phase 7's `memory_collections`/`collection_items`
-- already is a folder system, and Drops/Capsules are already
-- collection-eligible (Phase 9), so Saved reuses that rather than
-- inventing a second, competing folder concept.
--
-- Share Experience: mostly a client-side pass (preview cards, copy link,
-- QR, native share, deep links — see README) with no database changes
-- needed, since every shareable URL this app has already exists
-- (`/drop/:id`, `/memories/:type/:id`, `/u/:username`). Nothing in this
-- file is about sharing; it's folded into this sub-phase's number
-- because both were scoped together, not because they're related in
-- the schema.

-- ---------------------------------------------------------------------------
-- 1. Notes — one free-text note per save, editable by its owner only.
--    Neither table had an UPDATE policy before this (insert/select/
--    delete only), since nothing on a "save" row was ever meant to be
--    editable until now.
-- ---------------------------------------------------------------------------
alter table public.saved_posts add column if not exists note text check (char_length(note) <= 280);
alter table public.capsule_saves add column if not exists note text check (char_length(note) <= 280);

drop policy if exists "Users can update the note on their own saved drop" on public.saved_posts;
create policy "Users can update the note on their own saved drop"
  on public.saved_posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can update the note on their own capsule save" on public.capsule_saves;
create policy "Users can update the note on their own capsule save"
  on public.capsule_saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. get_saved_memories — unifies saved_posts (Drops) + capsule_saves
--    (Capsules) into the same Memory row shape as everywhere else, plus
--    saved_at/note. Moments have no save concept anywhere in this app
--    (they're ephemeral — see README), so there's no third branch here.
--    Every save can only ever have been created post-unlock (both
--    tables' own INSERT policies already require it), so the unlock
--    check below is defense in depth, not the primary gate.
-- ---------------------------------------------------------------------------
create or replace function public.get_saved_memories(
  p_query text default null,
  p_content_types text[] default null,
  p_collection_id uuid default null,
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
  created_at timestamptz,
  saved_at timestamptz,
  note text
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
        cs.created_at, cs.note
      from capsule_saves cs
      join capsules c on c.id = cs.capsule_id
      join profiles pr on pr.id = c.user_id
      where cs.user_id = auth.uid()
        and c.unlock_date <= now()
        and c.hidden_at is null
        and (c.user_id = auth.uid() or (not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)))

      union all

      select
        p.id, 'drop'::text, p.user_id, pr.username, pr.display_name, pr.profile_photo_url,
        null::text, p.caption,
        coalesce(
          (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'type', 'photo', 'position', pi.position) order by pi.position)
           from post_images pi where pi.post_id = p.id),
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
        sp.created_at, sp.note
      from saved_posts sp
      join posts p on p.id = sp.post_id
      join profiles pr on pr.id = p.user_id
      where sp.user_id = auth.uid()
        and p.unlock_date <= now()
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
    ) as saved(
      id, memory_type, user_id, username, display_name, profile_photo_url, title, caption, media,
      memory_types, mood, location_text, tags, visibility, is_unlocked, is_own, is_favorited, is_hidden,
      view_count, like_count, comment_count, matured_at, created_at, saved_at, note
    )
    where
      (p_content_types is null or saved.memory_type = any(p_content_types))
      and (p_query is null or p_query = '' or (
        saved.title ilike '%' || p_query || '%'
        or saved.caption ilike '%' || p_query || '%'
        or saved.note ilike '%' || p_query || '%'
      ))
      and (p_collection_id is null or exists (
        select 1 from collection_items ci
        where ci.collection_id = p_collection_id
          and (
            (ci.capsule_id = saved.id and saved.memory_type = 'capsule')
            or (ci.drop_id = saved.id and saved.memory_type = 'drop')
          )
      ))
    order by
      (case when p_sort = 'oldest' then saved.saved_at end) asc,
      (case when p_sort <> 'oldest' then saved.saved_at end) desc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.get_saved_memories(text, text[], uuid, text, int, int) to authenticated;

-- update_saved_note — a single narrow RPC rather than a direct table
-- update from the client, since "which save row" differs by content
-- type (post_id vs capsule_id) and this keeps that branching server-side.
create or replace function public.update_saved_note(p_memory_type text, p_memory_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_memory_type = 'capsule' then
    update public.capsule_saves set note = nullif(trim(p_note), '') where capsule_id = p_memory_id and user_id = auth.uid();
  elsif p_memory_type = 'drop' then
    update public.saved_posts set note = nullif(trim(p_note), '') where post_id = p_memory_id and user_id = auth.uid();
  end if;
end;
$$;

grant execute on function public.update_saved_note(text, uuid, text) to authenticated;
