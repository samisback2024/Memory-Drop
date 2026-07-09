-- Memory Drop — Phase 4d: pre-unlock anticipation + post-unlock engagement.
-- Run once, after supabase/phase4c_drop_visibility.sql, in the Supabase SQL
-- editor. Safe to re-run — every statement is idempotent.
--
-- What this adds:
--   - drop_interests: four positive, non-social-media reactions available
--     ONLY while a drop is still locked (interested / cant_wait /
--     good_vibes / save_to_unlock) — enforced server-side, not just hidden
--     in the UI, same discipline as everything else in this app.
--   - drop_unlock_views: a bare event log ("Sam viewed your unlocked
--     drop") — no UI reads this yet, it exists purely so Phase 9
--     notifications has something to query later.
--   - Likes are wired back up for POST-unlock engagement only (the
--     `likes` table/RLS/triggers have existed since phase4_feed.sql but
--     were dormant — no UI called them since the time-capsule redesign
--     removed the like button). Its RLS now also uses can_view_drop and
--     requires the drop to already be unlocked.
--   - Two new feed tabs: Following Drops and Saved to Unlock, alongside
--     the existing four. get_drops_feed/get_drop/get_saved_drops all grow
--     new columns (like/interest counts + "did I already do this"
--     flags), so they're dropped and recreated rather than replaced in
--     place (Postgres can't CREATE OR REPLACE a changed RETURNS TABLE
--     shape).

-- ---------------------------------------------------------------------------
-- 1. drop_interests — pre-unlock-only reactions.
-- ---------------------------------------------------------------------------
create table if not exists public.drop_interests (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  interest_type text not null check (interest_type in ('interested', 'cant_wait', 'good_vibes', 'save_to_unlock')),
  created_at timestamptz not null default now(),
  unique (drop_id, user_id, interest_type)
);

create index if not exists drop_interests_drop_id_idx on public.drop_interests (drop_id);
create index if not exists drop_interests_user_id_idx on public.drop_interests (user_id);

alter table public.drop_interests enable row level security;

drop policy if exists "Users can view their own interests" on public.drop_interests;
create policy "Users can view their own interests"
  on public.drop_interests for select
  using (auth.uid() = user_id);

-- Pre-unlock only: once a drop opens, Like/Comment/Save take over — these
-- four are deliberately for the waiting period, and that's enforced here,
-- not just by which buttons the UI happens to render.
drop policy if exists "Users can express interest in locked visible drops" on public.drop_interests;
create policy "Users can express interest in locked visible drops"
  on public.drop_interests for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from posts p where p.id = drop_id
        and p.unlock_date > now()
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
    )
  );

drop policy if exists "Users can remove their own interest" on public.drop_interests;
create policy "Users can remove their own interest"
  on public.drop_interests for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Denormalized interest counters on posts, trigger-maintained for the
--    same reason like_count/comment_count already are: the person
--    reacting is essentially never the drop's owner, so without
--    SECURITY DEFINER the update would be blocked by posts' own
--    "owners only" update policy.
-- ---------------------------------------------------------------------------
alter table public.posts
  add column if not exists interested_count int not null default 0,
  add column if not exists cant_wait_count int not null default 0,
  add column if not exists good_vibes_count int not null default 0,
  add column if not exists save_to_unlock_count int not null default 0;

create or replace function public.adjust_post_interest_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.interest_type = 'interested' then
      update posts set interested_count = interested_count + 1 where id = new.drop_id;
    elsif new.interest_type = 'cant_wait' then
      update posts set cant_wait_count = cant_wait_count + 1 where id = new.drop_id;
    elsif new.interest_type = 'good_vibes' then
      update posts set good_vibes_count = good_vibes_count + 1 where id = new.drop_id;
    elsif new.interest_type = 'save_to_unlock' then
      update posts set save_to_unlock_count = save_to_unlock_count + 1 where id = new.drop_id;
    end if;
    return new;
  else
    if old.interest_type = 'interested' then
      update posts set interested_count = greatest(interested_count - 1, 0) where id = old.drop_id;
    elsif old.interest_type = 'cant_wait' then
      update posts set cant_wait_count = greatest(cant_wait_count - 1, 0) where id = old.drop_id;
    elsif old.interest_type = 'good_vibes' then
      update posts set good_vibes_count = greatest(good_vibes_count - 1, 0) where id = old.drop_id;
    elsif old.interest_type = 'save_to_unlock' then
      update posts set save_to_unlock_count = greatest(save_to_unlock_count - 1, 0) where id = old.drop_id;
    end if;
    return old;
  end if;
end;
$$;

drop trigger if exists drop_interests_count_trigger on public.drop_interests;
create trigger drop_interests_count_trigger
  after insert or delete on public.drop_interests
  for each row
  execute function public.adjust_post_interest_count();

-- ---------------------------------------------------------------------------
-- 3. drop_unlock_views — bare event log, no UI reads it yet. Recorded
--    (best-effort, client-side) the first time someone other than the
--    owner sees an already-unlocked drop's real content. Only the
--    drop's owner can ever query it back.
-- ---------------------------------------------------------------------------
create table if not exists public.drop_unlock_views (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (drop_id, user_id)
);

create index if not exists drop_unlock_views_drop_id_idx on public.drop_unlock_views (drop_id);

alter table public.drop_unlock_views enable row level security;

drop policy if exists "Owners can view their drop's unlock views" on public.drop_unlock_views;
create policy "Owners can view their drop's unlock views"
  on public.drop_unlock_views for select
  using (exists (select 1 from posts p where p.id = drop_id and p.user_id = auth.uid()));

drop policy if exists "Users can record viewing an unlocked drop" on public.drop_unlock_views;
create policy "Users can record viewing an unlocked drop"
  on public.drop_unlock_views for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from posts p where p.id = drop_id
        and p.user_id <> auth.uid()
        and p.unlock_date <= now()
        and not is_blocked_either_way(p.user_id)
        and can_view_drop(p.user_id, p.visibility)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Likes, wired back up for POST-unlock engagement only. The table,
--    RLS shape, and counter trigger already existed (phase4_feed.sql) —
--    only the INSERT policy changes: can_view_author_posts() → the
--    visibility-tier-aware can_view_drop(), plus a new "must already be
--    unlocked" requirement, since Like is explicitly a post-unlock-only
--    action in this design (pre-unlock has its own four reactions above).
-- ---------------------------------------------------------------------------
drop policy if exists "Users can like visible posts" on public.likes;
create policy "Users can like visible posts"
  on public.likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from posts p where p.id = post_id
        and p.unlock_date <= now()
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
    )
  );

-- ---------------------------------------------------------------------------
-- 5. get_drops_feed — six tabs now. Return shape grows like/interest
--    counts and "did I already do this" flags, so this is a drop+create,
--    not a replace.
--
--      my_drops        — everything you've dropped, locked or not
--      following       — drops (locked or unlocked) from people you
--                        follow, respecting each drop's own visibility
--      public_drops     — all public-visibility drops from public
--                        accounts, locked or unlocked — the open
--                        discovery wall; a locked one here is exactly the
--                        "anticipation" case (a creator's upcoming drop)
--      unlocking_soon   — anything visible to you still sealed, soonest
--                        unlock first (you, follows, and public alike)
--      today_unlocks    — anything visible to you unlocking today
--      saved_to_unlock  — drops you marked "Save to Unlock", soonest
--                        unlock first
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
  like_count int,
  is_liked boolean,
  comment_count int,
  share_count int,
  save_count int,
  is_saved boolean,
  interested_count int,
  cant_wait_count int,
  good_vibes_count int,
  save_to_unlock_count int,
  is_interested boolean,
  is_cant_wait boolean,
  is_good_vibes boolean,
  is_saved_to_unlock boolean,
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
      p.like_count,
      exists(select 1 from likes lk where lk.post_id = p.id and lk.user_id = auth.uid()) as is_liked,
      p.comment_count, p.share_count, p.save_count,
      exists(select 1 from saved_posts sp where sp.post_id = p.id and sp.user_id = auth.uid()) as is_saved,
      p.interested_count, p.cant_wait_count, p.good_vibes_count, p.save_to_unlock_count,
      exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'interested') as is_interested,
      exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'cant_wait') as is_cant_wait,
      exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'good_vibes') as is_good_vibes,
      exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'save_to_unlock') as is_saved_to_unlock,
      p.created_at
    from posts p
    join profiles pr on pr.id = p.user_id
    where
      not exists (select 1 from hidden_posts h where h.post_id = p.id and h.user_id = auth.uid())
      and not is_blocked_either_way(p.user_id)
      and (
        case p_tab
          when 'my_drops' then p.user_id = auth.uid()
          when 'following' then
            p.user_id <> auth.uid()
            and exists(select 1 from follows f where f.follower_id = auth.uid() and f.following_id = p.user_id and f.status = 'accepted')
            and can_view_drop(p.user_id, p.visibility)
          when 'public_drops' then
            p.user_id <> auth.uid()
            and p.visibility = 'public'
            and not coalesce(pr.is_private, false)
          when 'unlocking_soon' then p.unlock_date > now() and can_view_drop(p.user_id, p.visibility)
          when 'today_unlocks' then p.unlock_date::date = current_date and can_view_drop(p.user_id, p.visibility)
          when 'saved_to_unlock' then
            exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'save_to_unlock')
            and (p.user_id = auth.uid() or can_view_drop(p.user_id, p.visibility))
          else false
        end
      )
    order by
      case when p_tab in ('unlocking_soon', 'today_unlocks', 'saved_to_unlock') then p.unlock_date end asc,
      case when p_tab in ('public_drops', 'following') then p.created_at end desc,
      p.created_at desc,
      p.id desc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.get_drops_feed(text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. get_drop — same new columns, same drop+create requirement.
-- ---------------------------------------------------------------------------
drop function if exists public.get_drop(uuid);
create function public.get_drop(p_post_id uuid)
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
  like_count int,
  is_liked boolean,
  comment_count int,
  share_count int,
  save_count int,
  is_saved boolean,
  interested_count int,
  cant_wait_count int,
  good_vibes_count int,
  save_to_unlock_count int,
  is_interested boolean,
  is_cant_wait boolean,
  is_good_vibes boolean,
  is_saved_to_unlock boolean,
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
    p.like_count,
    exists(select 1 from likes lk where lk.post_id = p.id and lk.user_id = auth.uid()) as is_liked,
    p.comment_count, p.share_count, p.save_count,
    exists(select 1 from saved_posts sp where sp.post_id = p.id and sp.user_id = auth.uid()) as is_saved,
    p.interested_count, p.cant_wait_count, p.good_vibes_count, p.save_to_unlock_count,
    exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'interested') as is_interested,
    exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'cant_wait') as is_cant_wait,
    exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'good_vibes') as is_good_vibes,
    exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'save_to_unlock') as is_saved_to_unlock,
    p.created_at
  from posts p
  join profiles pr on pr.id = p.user_id
  where p.id = p_post_id
    and not is_blocked_either_way(p.user_id)
    and (p.user_id = auth.uid() or can_view_drop(p.user_id, p.visibility));
$$;

grant execute on function public.get_drop(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. get_saved_drops — same new columns, same drop+create requirement.
--    Unchanged meaning: this is the ordinary post-unlock "Save" bookmark
--    (saved_posts), NOT the new pre-unlock "Save to Unlock" — that one
--    lives in the saved_to_unlock feed tab above via drop_interests.
-- ---------------------------------------------------------------------------
drop function if exists public.get_saved_drops(int, int);
create function public.get_saved_drops(p_limit int default 10, p_offset int default 0)
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
  like_count int,
  is_liked boolean,
  comment_count int,
  share_count int,
  save_count int,
  is_saved boolean,
  interested_count int,
  cant_wait_count int,
  good_vibes_count int,
  save_to_unlock_count int,
  is_interested boolean,
  is_cant_wait boolean,
  is_good_vibes boolean,
  is_saved_to_unlock boolean,
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
    p.like_count,
    exists(select 1 from likes lk where lk.post_id = p.id and lk.user_id = auth.uid()) as is_liked,
    p.comment_count, p.share_count, p.save_count,
    true as is_saved,
    p.interested_count, p.cant_wait_count, p.good_vibes_count, p.save_to_unlock_count,
    exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'interested') as is_interested,
    exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'cant_wait') as is_cant_wait,
    exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'good_vibes') as is_good_vibes,
    exists(select 1 from drop_interests di where di.drop_id = p.id and di.user_id = auth.uid() and di.interest_type = 'save_to_unlock') as is_saved_to_unlock,
    p.created_at
  from saved_posts sp
  join posts p on p.id = sp.post_id
  join profiles pr on pr.id = p.user_id
  where sp.user_id = auth.uid()
    and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
  order by sp.created_at desc
  limit p_limit offset p_offset;
$$;

grant execute on function public.get_saved_drops(int, int) to authenticated;
