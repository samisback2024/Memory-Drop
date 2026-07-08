-- Memory Drop — Phase 4b: reshape the Feed around Memory Drop's actual
-- identity (capture now, unlock later) instead of a generic social feed.
-- Run once, after supabase/phase4_feed.sql, in the Supabase SQL editor.
-- Safe to re-run: every statement is idempotent, except CREATE FUNCTION
-- statements whose RETURNS TABLE shape changed (those DROP first).
--
-- `posts`/`post_images` keep their original table names for migration
-- continuity — only the UI and TypeScript layer call these "Drops" now.
-- Existing rows default to unlock_date = now() (already-unlocked), public
-- visibility, no mood — behaviorally identical to how they worked before
-- this migration.

-- ---------------------------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------------------------
alter table public.posts
  add column if not exists unlock_date timestamptz not null default now(),
  add column if not exists visibility text not null default 'public' check (visibility in ('public', 'private')),
  add column if not exists mood text,
  add column if not exists audio_url text;

alter table public.posts drop constraint if exists mood_valid;
alter table public.posts add constraint mood_valid check (
  mood is null or mood in ('joyful', 'grateful', 'nostalgic', 'hopeful', 'reflective', 'peaceful', 'bittersweet', 'excited')
);

-- post_type grows a 4th value (audio) alongside the existing photo/video/text.
alter table public.posts drop constraint if exists posts_post_type_check;
alter table public.posts add constraint posts_post_type_check check (post_type in ('photo', 'video', 'audio', 'text'));

alter table public.posts drop constraint if exists audio_only_on_audio_posts;
alter table public.posts add constraint audio_only_on_audio_posts check (audio_url is null or post_type = 'audio');

create index if not exists posts_unlock_date_idx on public.posts (unlock_date);

-- ---------------------------------------------------------------------------
-- 2. Reflections — a private note-to-self on a drop (yours or someone
--    else's), distinct from a public comment. Reuses the comments table
--    with a flag rather than a new one: same author/content/timestamp
--    shape, just never shown to anyone but its own author, and never
--    counted in comment_count.
-- ---------------------------------------------------------------------------
alter table public.comments add column if not exists is_reflection boolean not null default false;

-- Comment counting must ignore reflections — recreate the trigger function
-- from phase4_feed.sql with that added.
create or replace function public.adjust_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if not new.is_reflection then
      update posts set comment_count = comment_count + 1 where id = new.post_id;
    end if;
    return new;
  else
    if not old.is_reflection then
      update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    end if;
    return old;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RLS updates
-- ---------------------------------------------------------------------------

-- Comments SELECT: reflections are visible only to their own author,
-- everyone else's ordinary comments still follow the post's visibility.
drop policy if exists "Users can view comments on visible posts" on public.comments;
create policy "Users can view comments on visible posts"
  on public.comments for select
  using (
    (not is_reflection or user_id = auth.uid())
    and exists (
      select 1 from posts p where p.id = post_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_author_posts(p.user_id)))
    )
  );

-- Comments INSERT: a real comment requires the drop to be unlocked ("comment
-- only after unlock"); a reflection is a private note and can be written
-- any time, locked or not.
drop policy if exists "Users can comment on visible posts" on public.comments;
create policy "Users can comment on visible posts"
  on public.comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from posts p where p.id = post_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_author_posts(p.user_id)))
        and (is_reflection or p.unlock_date <= now())
    )
  );

-- ---------------------------------------------------------------------------
-- 4. get_drop_comments — same as get_comments, minus reflections, renamed
--    to match the new terminology. get_comments is dropped rather than
--    kept as an alias so there's exactly one sanctioned name going forward.
-- ---------------------------------------------------------------------------
drop function if exists public.get_comments(uuid, int, int);
create or replace function public.get_drop_comments(p_post_id uuid, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  content text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.user_id, pr.username, pr.display_name, pr.profile_photo_url, c.content, c.created_at
  from comments c
  join profiles pr on pr.id = c.user_id
  where c.post_id = p_post_id
    and c.is_reflection = false
    and exists (
      select 1 from posts p where p.id = p_post_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_author_posts(p.user_id)))
    )
  order by c.created_at asc
  limit p_limit offset p_offset;
$$;

grant execute on function public.get_drop_comments(uuid, int, int) to authenticated;

-- Only ever returns the caller's own reflections — there is no path to
-- read anyone else's, by design.
create or replace function public.get_my_reflections(p_post_id uuid)
returns table (id uuid, content text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.content, c.created_at
  from comments c
  where c.post_id = p_post_id
    and c.is_reflection = true
    and c.user_id = auth.uid()
  order by c.created_at desc;
$$;

grant execute on function public.get_my_reflections(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. get_drops_feed — replaces get_feed. Same SECURITY DEFINER reasoning
--    (joins profiles for author info, so it has to re-implement the
--    visibility predicate itself rather than relying on posts' RLS).
--
--    Content (caption/images/video/audio) is nulled out for everyone,
--    including the drop's own owner, while unlock_date is still in the
--    future — the "seal" is real, not just a UI blur, so there's no way
--    to read your own memory early by inspecting the network response.
--
--    Four tabs, each a genuinely different slice rather than a different
--    sort order on the same set:
--      my_drops        — everything you've dropped, locked or not
--      unlocking_soon  — still-locked drops from you or people you follow,
--                        soonest unlock first
--      today_unlocks   — anything visible to you unlocking today (own +
--                        public-visibility drops from anyone you can see),
--                        soonest first
--      public_drops    — already-unlocked public drops from public
--                        accounts — the general discovery feed, most
--                        recently unlocked first
-- ---------------------------------------------------------------------------
drop function if exists public.get_feed(text, int, int);
drop function if exists public.get_drops_feed(text, int, int);
create function public.get_drops_feed(p_tab text, p_limit int default 10, p_offset int default 0)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  is_private boolean,
  caption text,
  post_type text,
  video_url text,
  audio_url text,
  images jsonb,
  mood text,
  visibility text,
  unlock_date timestamptz,
  is_unlocked boolean,
  comment_count int,
  share_count int,
  save_count int,
  is_saved boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select
      p.id, p.user_id, pr.username, pr.display_name, pr.profile_photo_url, pr.is_private,
      case when p.unlock_date <= now() then p.caption else null end,
      p.post_type,
      case when p.unlock_date <= now() then p.video_url else null end,
      case when p.unlock_date <= now() then p.audio_url else null end,
      case when p.unlock_date <= now() then coalesce(
        (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'position', pi.position) order by pi.position)
         from post_images pi where pi.post_id = p.id),
        '[]'::jsonb
      ) else '[]'::jsonb end as images,
      p.mood,
      p.visibility,
      p.unlock_date,
      (p.unlock_date <= now()) as is_unlocked,
      p.comment_count, p.share_count, p.save_count,
      exists(select 1 from saved_posts sp where sp.post_id = p.id and sp.user_id = auth.uid()) as is_saved,
      p.created_at
    from posts p
    join profiles pr on pr.id = p.user_id
    where
      not exists (select 1 from hidden_posts h where h.post_id = p.id and h.user_id = auth.uid())
      and not is_blocked_either_way(p.user_id)
      and (
        case p_tab
          when 'my_drops' then p.user_id = auth.uid()
          when 'unlocking_soon' then p.unlock_date > now() and (
            p.user_id = auth.uid()
            or (p.visibility = 'public' and exists(
              select 1 from follows f where f.follower_id = auth.uid() and f.following_id = p.user_id and f.status = 'accepted'
            ))
          )
          when 'today_unlocks' then p.unlock_date::date = current_date and (
            p.user_id = auth.uid()
            or (p.visibility = 'public' and can_view_author_posts(p.user_id))
          )
          when 'public_drops' then (
            p.unlock_date <= now() and p.visibility = 'public' and not coalesce(pr.is_private, false)
          )
          else false
        end
      )
    order by
      case when p_tab in ('unlocking_soon', 'today_unlocks') then p.unlock_date end asc,
      case when p_tab = 'public_drops' then p.unlock_date end desc,
      p.created_at desc,
      p.id desc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.get_drops_feed(text, int, int) to authenticated;

drop function if exists public.get_saved_posts(int, int);
create or replace function public.get_saved_drops(p_limit int default 10, p_offset int default 0)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  is_private boolean,
  caption text,
  post_type text,
  video_url text,
  audio_url text,
  images jsonb,
  mood text,
  visibility text,
  unlock_date timestamptz,
  is_unlocked boolean,
  comment_count int,
  share_count int,
  save_count int,
  is_saved boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.user_id, pr.username, pr.display_name, pr.profile_photo_url, pr.is_private,
    case when p.unlock_date <= now() then p.caption else null end,
    p.post_type,
    case when p.unlock_date <= now() then p.video_url else null end,
    case when p.unlock_date <= now() then p.audio_url else null end,
    case when p.unlock_date <= now() then coalesce(
      (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'position', pi.position) order by pi.position)
       from post_images pi where pi.post_id = p.id),
      '[]'::jsonb
    ) else '[]'::jsonb end as images,
    p.mood,
    p.visibility,
    p.unlock_date,
    (p.unlock_date <= now()) as is_unlocked,
    p.comment_count, p.share_count, p.save_count,
    true as is_saved,
    p.created_at
  from saved_posts sp
  join posts p on p.id = sp.post_id
  join profiles pr on pr.id = p.user_id
  where sp.user_id = auth.uid()
    and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_author_posts(p.user_id)))
  order by sp.created_at desc
  limit p_limit offset p_offset;
$$;

grant execute on function public.get_saved_drops(int, int) to authenticated;

drop function if exists public.get_post(uuid);
create or replace function public.get_drop(p_post_id uuid)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  is_private boolean,
  caption text,
  post_type text,
  video_url text,
  audio_url text,
  images jsonb,
  mood text,
  visibility text,
  unlock_date timestamptz,
  is_unlocked boolean,
  comment_count int,
  share_count int,
  save_count int,
  is_saved boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.user_id, pr.username, pr.display_name, pr.profile_photo_url, pr.is_private,
    case when p.unlock_date <= now() then p.caption else null end,
    p.post_type,
    case when p.unlock_date <= now() then p.video_url else null end,
    case when p.unlock_date <= now() then p.audio_url else null end,
    case when p.unlock_date <= now() then coalesce(
      (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'position', pi.position) order by pi.position)
       from post_images pi where pi.post_id = p.id),
      '[]'::jsonb
    ) else '[]'::jsonb end as images,
    p.mood,
    p.visibility,
    p.unlock_date,
    (p.unlock_date <= now()) as is_unlocked,
    p.comment_count, p.share_count, p.save_count,
    exists(select 1 from saved_posts sp where sp.post_id = p.id and sp.user_id = auth.uid()) as is_saved,
    p.created_at
  from posts p
  join profiles pr on pr.id = p.user_id
  where p.id = p_post_id
    and not is_blocked_either_way(p.user_id)
    and (p.user_id = auth.uid() or can_view_author_posts(p.user_id));
$$;

grant execute on function public.get_drop(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Storage: post-media bucket grows audio mime types.
-- ---------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm']
where id = 'post-media';
