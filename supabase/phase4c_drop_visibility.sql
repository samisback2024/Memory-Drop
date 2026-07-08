-- Memory Drop — Phase 4c: real three-tier drop visibility.
-- Run once, after supabase/phase4b_time_capsule_redesign.sql, in the
-- Supabase SQL editor. Safe to re-run — every statement is idempotent.
--
-- Why this exists: the composer's "Public / Private" toggle promised
-- "Only you will ever see this one" for a private drop, but nothing
-- actually enforced that beyond excluding it from feed tabs — get_drop
-- (the permalink), get_saved_drops, and the comments policies all fell
-- back to can_view_author_posts(), which only knows about ACCOUNT-level
-- privacy, not the individual drop's visibility. A "private" drop on a
-- public account was reachable by anyone with (or guessing) its link.
-- This migration adds a real third tier and fixes that leak everywhere
-- a single drop's visibility should have been the deciding factor.
--
-- Three tiers, plain language:
--   'public'    Everyone — appears in Public Drops / discovery once
--               unlocked, same as before. Still respects account-level
--               privacy: a private account's "Everyone" drop is still
--               followers-only, same layering as always.
--   'followers' Followers — visible only to your accepted followers
--               (and you), regardless of whether your account itself is
--               public or private. New tier.
--   'private'   Only me — visible to nobody but you, full stop. Now
--               actually enforced at every read path, not just the tabs.

-- ---------------------------------------------------------------------------
-- 1. Widen the visibility check constraint.
-- ---------------------------------------------------------------------------
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check check (visibility in ('public', 'followers', 'private'));

-- ---------------------------------------------------------------------------
-- 2. can_view_drop — the one place that decides whether the caller can see
--    a specific drop, given its owner and its own visibility tier. Every
--    policy/RPC below that used to lean on can_view_author_posts() alone
--    for a *post row* now goes through this instead. can_view_author_posts
--    itself is untouched and still correct for non-drop contexts (profiles,
--    followers/following lists, etc).
-- ---------------------------------------------------------------------------
create or replace function public.can_view_drop(p_owner_id uuid, p_visibility text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner_id = auth.uid()
    or (
      p_visibility = 'public' and can_view_author_posts(p_owner_id)
    )
    or (
      p_visibility = 'followers' and exists (
        select 1 from follows
        where follower_id = auth.uid() and following_id = p_owner_id and status = 'accepted'
      )
    );
    -- p_visibility = 'private' never matches for anyone but the owner.
$$;

grant execute on function public.can_view_drop(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. posts SELECT RLS (defense in depth for direct-table access) and
--    saved_posts INSERT RLS now check the drop's own visibility, not just
--    the author's account-level privacy.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view visible posts" on public.posts;
create policy "Users can view visible posts"
  on public.posts for select
  using (
    user_id = auth.uid()
    or (not is_blocked_either_way(user_id) and can_view_drop(user_id, visibility))
  );

drop policy if exists "Users can save visible posts" on public.saved_posts;
create policy "Users can save visible posts"
  on public.saved_posts for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from posts p where p.id = post_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
    )
  );

-- ---------------------------------------------------------------------------
-- 4. comments SELECT/INSERT RLS — same fix. A private or followers-only
--    drop's comments (and the ability to add one) now follow the drop's
--    own visibility, not just whether you can see the author's posts in
--    general.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view comments on visible posts" on public.comments;
create policy "Users can view comments on visible posts"
  on public.comments for select
  using (
    (not is_reflection or user_id = auth.uid())
    and exists (
      select 1 from posts p where p.id = post_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
    )
  );

drop policy if exists "Users can comment on visible posts" on public.comments;
create policy "Users can comment on visible posts"
  on public.comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from posts p where p.id = post_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
        and (is_reflection or p.unlock_date <= now())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. get_drop_comments, get_drop, get_saved_drops — same predicate swap.
--    Signatures/return shapes are unchanged, so create or replace is safe.
-- ---------------------------------------------------------------------------
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
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
    )
  order by c.created_at asc
  limit p_limit offset p_offset;
$$;

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
    and (p.user_id = auth.uid() or can_view_drop(p.user_id, p.visibility));
$$;

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
    and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
  order by sp.created_at desc
  limit p_limit offset p_offset;
$$;

-- ---------------------------------------------------------------------------
-- 6. get_drops_feed — same four tabs, updated for three tiers.
--
--    unlocking_soon / today_unlocks stay scoped to "you or people you
--    follow" (not can_view_drop's broader "anyone, if the tier is public
--    and the account is public") — a stranger's public countdown showing
--    up in your personal Unlocking Soon tab would be a bug, not a feature.
--    A 'private' drop never appears in either, for anyone but its owner.
--
--    public_drops (discovery) is unchanged: only 'public'-tier drops from
--    public accounts, once unlocked.
-- ---------------------------------------------------------------------------
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
            or (p.visibility in ('public', 'followers') and exists(
              select 1 from follows f where f.follower_id = auth.uid() and f.following_id = p.user_id and f.status = 'accepted'
            ))
          )
          when 'today_unlocks' then p.unlock_date::date = current_date and (
            p.user_id = auth.uid()
            or can_view_drop(p.user_id, p.visibility)
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
