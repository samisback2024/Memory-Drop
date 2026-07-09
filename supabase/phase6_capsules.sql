-- Memory Drop — Phase 6: Time Capsules, the app's signature feature.
-- Run once, after supabase/phase5_moments.sql, in the Supabase SQL editor.
-- Safe to re-run — every statement is idempotent.
--
-- A capsule is not a post with a date on it: it's a sealed vault. Title,
-- memory text, and every attached photo/video/audio/voice note are all
-- withheld until unlock_date passes — for EVERY viewer, including the
-- capsule's own author. That nulling happens in two places here, not
-- one: the RPCs null the content columns (same discipline as Drops), but
-- unlike Drops, the capsules table's own RLS also refuses non-owners the
-- row outright while it's still locked — not just a nulled column, no
-- row at all — closing a gap Drops' table-level RLS never closed (it
-- only ever checked visibility, not lock state; direct PostgREST access
-- to `posts` can still return a locked drop's raw content to anyone who
-- can view the author's posts in general). The owner keeps direct access
-- to their own row either way, same tradeoff Drops already accepted.

-- ---------------------------------------------------------------------------
-- 1. capsules
-- ---------------------------------------------------------------------------
create table if not exists public.capsules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  memory_text text,
  memory_types text[] not null,
  mood text check (mood is null or mood in ('joyful', 'grateful', 'nostalgic', 'hopeful', 'reflective', 'peaceful', 'bittersweet', 'excited')),
  visibility text not null default 'only_me' check (visibility in ('only_me', 'followers', 'public')),
  unlock_date timestamptz not null,
  like_count int not null default 0,
  comment_count int not null default 0,
  save_count int not null default 0,
  share_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (memory_types <@ array['text', 'photo', 'video', 'audio', 'voice']),
  check (cardinality(memory_types) > 0)
);

create index if not exists capsules_user_id_idx on public.capsules (user_id);
create index if not exists capsules_unlock_date_idx on public.capsules (unlock_date);

-- A capsule sent into the past isn't a capsule — enforced here rather
-- than a plain CHECK, since comparing against now() in a CHECK constraint
-- isn't allowed (now() isn't immutable).
create or replace function public.validate_capsule_unlock_date()
returns trigger
language plpgsql
as $$
begin
  if new.unlock_date <= new.created_at then
    raise exception 'A capsule''s unlock date must be in the future.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists capsules_validate_unlock_date on public.capsules;
create trigger capsules_validate_unlock_date
  before insert on public.capsules
  for each row
  execute function public.validate_capsule_unlock_date();

-- ---------------------------------------------------------------------------
-- 2. can_view_capsule — same shape as can_view_drop/can_view_moment.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_capsule(p_owner_id uuid, p_visibility text)
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
    -- p_visibility = 'only_me' never matches for anyone but the owner.
$$;

grant execute on function public.can_view_capsule(uuid, text) to authenticated;

alter table public.capsules enable row level security;

-- The stricter-than-Drops policy: a non-owner gets no row at all — not
-- even a nulled one — until unlock_date has passed. The owner always
-- sees their own row directly (same tradeoff Drops already made; the RPC
-- layer is what keeps the *normal app flow* from spoiling your own
-- surprise, see Known limitations in the README for the honest caveat).
drop policy if exists "Users can view visible capsules" on public.capsules;
create policy "Users can view visible capsules"
  on public.capsules for select
  using (
    user_id = auth.uid()
    or (
      unlock_date <= now()
      and not is_blocked_either_way(user_id)
      and can_view_capsule(user_id, visibility)
    )
  );

drop policy if exists "Users can create their own capsules" on public.capsules;
create policy "Users can create their own capsules"
  on public.capsules for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own capsules" on public.capsules;
create policy "Users can update their own capsules"
  on public.capsules for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own capsules" on public.capsules;
create policy "Users can delete their own capsules"
  on public.capsules for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. capsule_media — unlike Drops' single video_url/audio_url columns,
--    a capsule can genuinely hold a combination (e.g. three photos and a
--    voice note), so media is a real, populated table here, not
--    groundwork like Phase 5's moment_media.
-- ---------------------------------------------------------------------------
create table if not exists public.capsule_media (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('photo', 'video', 'audio', 'voice')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (capsule_id, position)
);

create index if not exists capsule_media_capsule_id_idx on public.capsule_media (capsule_id);

alter table public.capsule_media enable row level security;

drop policy if exists "Users can view media on visible capsules" on public.capsule_media;
create policy "Users can view media on visible capsules"
  on public.capsule_media for select
  using (
    exists (
      select 1 from capsules c where c.id = capsule_id
        and (
          c.user_id = auth.uid()
          or (c.unlock_date <= now() and not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility))
        )
    )
  );

drop policy if exists "Users can add media to their own capsule" on public.capsule_media;
create policy "Users can add media to their own capsule"
  on public.capsule_media for insert
  with check (exists (select 1 from capsules c where c.id = capsule_id and c.user_id = auth.uid()));

drop policy if exists "Users can delete media from their own capsule" on public.capsule_media;
create policy "Users can delete media from their own capsule"
  on public.capsule_media for delete
  using (exists (select 1 from capsules c where c.id = capsule_id and c.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. capsule_unlocks — the ritual "I opened this vault" event, one row
--    per (capsule, user). Purely a UX/stats concern, not a security
--    gate — unlock_date already controls whether content is readable at
--    all; this just remembers whether a given user has already played
--    the reveal animation, so revisiting doesn't replay it, and gives
--    the owner an "opened by" stat parallel to Moments' seen list.
-- ---------------------------------------------------------------------------
create table if not exists public.capsule_unlocks (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (capsule_id, user_id)
);

create index if not exists capsule_unlocks_capsule_id_idx on public.capsule_unlocks (capsule_id);

alter table public.capsule_unlocks enable row level security;

drop policy if exists "Users can view their own unlock record" on public.capsule_unlocks;
create policy "Users can view their own unlock record"
  on public.capsule_unlocks for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can view who opened their capsule" on public.capsule_unlocks;
create policy "Owners can view who opened their capsule"
  on public.capsule_unlocks for select
  using (exists (select 1 from capsules c where c.id = capsule_id and c.user_id = auth.uid()));

drop policy if exists "Users can record opening a capsule" on public.capsule_unlocks;
create policy "Users can record opening a capsule"
  on public.capsule_unlocks for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from capsules c where c.id = capsule_id
        and c.unlock_date <= now()
        and (c.user_id = auth.uid() or (not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)))
    )
  );

-- ---------------------------------------------------------------------------
-- 5. capsule_views — notification groundwork, mirrors drop_unlock_views /
--    moment_views exactly: non-owner-only, owner-readable-only, nothing
--    reads it yet.
-- ---------------------------------------------------------------------------
create table if not exists public.capsule_views (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (capsule_id, viewer_id)
);

create index if not exists capsule_views_capsule_id_idx on public.capsule_views (capsule_id);

alter table public.capsule_views enable row level security;

drop policy if exists "Owners can view who saw their capsule" on public.capsule_views;
create policy "Owners can view who saw their capsule"
  on public.capsule_views for select
  using (exists (select 1 from capsules c where c.id = capsule_id and c.user_id = auth.uid()));

drop policy if exists "Users can record viewing an unlocked capsule" on public.capsule_views;
create policy "Users can record viewing an unlocked capsule"
  on public.capsule_views for insert
  with check (
    auth.uid() = viewer_id
    and exists (
      select 1 from capsules c where c.id = capsule_id
        and c.user_id <> auth.uid()
        and c.unlock_date <= now()
        and not is_blocked_either_way(c.user_id)
        and can_view_capsule(c.user_id, c.visibility)
    )
  );

-- ---------------------------------------------------------------------------
-- 6. capsule_reflections — a private note-to-self, same shape and rules
--    as Drops' is_reflection comments, but its own dedicated table here
--    rather than a flag, matching this phase's explicit table list.
--    Available at any lock state — reflecting doesn't require the vault
--    to be open yet.
-- ---------------------------------------------------------------------------
create table if not exists public.capsule_reflections (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists capsule_reflections_capsule_id_idx on public.capsule_reflections (capsule_id);

alter table public.capsule_reflections enable row level security;

drop policy if exists "Users can view their own reflections" on public.capsule_reflections;
create policy "Users can view their own reflections"
  on public.capsule_reflections for select
  using (auth.uid() = user_id);

drop policy if exists "Users can reflect on a visible capsule" on public.capsule_reflections;
create policy "Users can reflect on a visible capsule"
  on public.capsule_reflections for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from capsules c where c.id = capsule_id
        and (c.user_id = auth.uid() or (not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)))
    )
  );

drop policy if exists "Users can delete their own reflection" on public.capsule_reflections;
create policy "Users can delete their own reflection"
  on public.capsule_reflections for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. capsule_likes / capsule_comments / capsule_saves — not in the
--    phase's named table list, added because "Like / Comment / Save"
--    are explicitly required post-unlock actions with nowhere else to
--    live; same dedicated-table discipline as everything else here
--    rather than reusing Drops' likes/comments/saved_posts. All three
--    are post-unlock only, same as Drops.
-- ---------------------------------------------------------------------------
create table if not exists public.capsule_likes (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (capsule_id, user_id)
);

create index if not exists capsule_likes_capsule_id_idx on public.capsule_likes (capsule_id);

alter table public.capsule_likes enable row level security;

drop policy if exists "Users can view their own capsule likes" on public.capsule_likes;
create policy "Users can view their own capsule likes"
  on public.capsule_likes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can like an unlocked visible capsule" on public.capsule_likes;
create policy "Users can like an unlocked visible capsule"
  on public.capsule_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from capsules c where c.id = capsule_id
        and c.unlock_date <= now()
        and (c.user_id = auth.uid() or (not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)))
    )
  );

drop policy if exists "Users can unlike their own capsule like" on public.capsule_likes;
create policy "Users can unlike their own capsule like"
  on public.capsule_likes for delete
  using (auth.uid() = user_id);

create table if not exists public.capsule_comments (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists capsule_comments_capsule_id_idx on public.capsule_comments (capsule_id);

alter table public.capsule_comments enable row level security;

drop policy if exists "Users can view comments on visible capsules" on public.capsule_comments;
create policy "Users can view comments on visible capsules"
  on public.capsule_comments for select
  using (
    exists (
      select 1 from capsules c where c.id = capsule_id
        and (c.user_id = auth.uid() or (not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)))
    )
  );

drop policy if exists "Users can comment on an unlocked visible capsule" on public.capsule_comments;
create policy "Users can comment on an unlocked visible capsule"
  on public.capsule_comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from capsules c where c.id = capsule_id
        and c.unlock_date <= now()
        and (c.user_id = auth.uid() or (not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)))
    )
  );

drop policy if exists "Users can delete their own capsule comment" on public.capsule_comments;
create policy "Users can delete their own capsule comment"
  on public.capsule_comments for delete
  using (auth.uid() = user_id);

create table if not exists public.capsule_saves (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (capsule_id, user_id)
);

create index if not exists capsule_saves_capsule_id_idx on public.capsule_saves (capsule_id);

alter table public.capsule_saves enable row level security;

drop policy if exists "Users can view their own capsule saves" on public.capsule_saves;
create policy "Users can view their own capsule saves"
  on public.capsule_saves for select
  using (auth.uid() = user_id);

drop policy if exists "Users can save an unlocked visible capsule" on public.capsule_saves;
create policy "Users can save an unlocked visible capsule"
  on public.capsule_saves for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from capsules c where c.id = capsule_id
        and c.unlock_date <= now()
        and (c.user_id = auth.uid() or (not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)))
    )
  );

drop policy if exists "Users can unsave their own capsule save" on public.capsule_saves;
create policy "Users can unsave their own capsule save"
  on public.capsule_saves for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 8. Counter triggers — same SECURITY DEFINER reasoning as posts: the
--    person liking/commenting/saving is essentially never the capsule's
--    owner, so without bypassing RLS the update would be blocked by
--    capsules' own "owners only" UPDATE policy.
-- ---------------------------------------------------------------------------
create or replace function public.adjust_capsule_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update capsules set like_count = like_count + 1 where id = new.capsule_id;
    return new;
  else
    update capsules set like_count = greatest(like_count - 1, 0) where id = old.capsule_id;
    return old;
  end if;
end;
$$;

drop trigger if exists capsule_likes_count_trigger on public.capsule_likes;
create trigger capsule_likes_count_trigger
  after insert or delete on public.capsule_likes
  for each row
  execute function public.adjust_capsule_like_count();

create or replace function public.adjust_capsule_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update capsules set comment_count = comment_count + 1 where id = new.capsule_id;
    return new;
  else
    update capsules set comment_count = greatest(comment_count - 1, 0) where id = old.capsule_id;
    return old;
  end if;
end;
$$;

drop trigger if exists capsule_comments_count_trigger on public.capsule_comments;
create trigger capsule_comments_count_trigger
  after insert or delete on public.capsule_comments
  for each row
  execute function public.adjust_capsule_comment_count();

create or replace function public.adjust_capsule_save_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update capsules set save_count = save_count + 1 where id = new.capsule_id;
    return new;
  else
    update capsules set save_count = greatest(save_count - 1, 0) where id = old.capsule_id;
    return old;
  end if;
end;
$$;

drop trigger if exists capsule_saves_count_trigger on public.capsule_saves;
create trigger capsule_saves_count_trigger
  after insert or delete on public.capsule_saves
  for each row
  execute function public.adjust_capsule_save_count();

create or replace function public.increment_capsule_share_count(p_capsule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update capsules set share_count = share_count + 1
  where id = p_capsule_id
    and (user_id = auth.uid() or (not is_blocked_either_way(user_id) and can_view_capsule(user_id, visibility)));
end;
$$;

grant execute on function public.increment_capsule_share_count(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Storage: capsules bucket (photos, videos, audio, voice notes).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'capsules', 'capsules', true, 52428800,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime',
        'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Capsule media is publicly accessible" on storage.objects;
create policy "Capsule media is publicly accessible"
  on storage.objects for select
  using (bucket_id = 'capsules');

drop policy if exists "Users can upload their own capsule media" on storage.objects;
create policy "Users can upload their own capsule media"
  on storage.objects for insert
  with check (bucket_id = 'capsules' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own capsule media" on storage.objects;
create policy "Users can delete their own capsule media"
  on storage.objects for delete
  using (bucket_id = 'capsules' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 10. get_capsule — a single capsule by id, for /capsules/:capsuleId and
--     for the archive/timeline's per-item reads. Content is nulled while
--     locked for everyone, including the owner — the RPC-layer half of
--     the "no peeking early" rule (see the RLS notes at the top of this
--     file for the table-layer half).
-- ---------------------------------------------------------------------------
create or replace function public.get_capsule(p_capsule_id uuid)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  is_private boolean,
  title text,
  memory_text text,
  memory_types text[],
  media jsonb,
  mood text,
  visibility text,
  unlock_date timestamptz,
  is_unlocked boolean,
  has_opened boolean,
  is_owner boolean,
  like_count int,
  is_liked boolean,
  comment_count int,
  save_count int,
  is_saved boolean,
  share_count int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.user_id, pr.username, pr.display_name, pr.profile_photo_url, pr.is_private,
    case when c.unlock_date <= now() then c.title else null end,
    case when c.unlock_date <= now() then c.memory_text else null end,
    c.memory_types,
    case when c.unlock_date <= now() then coalesce(
      (select jsonb_agg(jsonb_build_object('url', cm.media_url, 'type', cm.media_type, 'position', cm.position) order by cm.position)
       from capsule_media cm where cm.capsule_id = c.id),
      '[]'::jsonb
    ) else '[]'::jsonb end as media,
    c.mood,
    c.visibility,
    c.unlock_date,
    (c.unlock_date <= now()) as is_unlocked,
    exists(select 1 from capsule_unlocks cu where cu.capsule_id = c.id and cu.user_id = auth.uid()) as has_opened,
    (c.user_id = auth.uid()) as is_owner,
    c.like_count,
    exists(select 1 from capsule_likes cl where cl.capsule_id = c.id and cl.user_id = auth.uid()) as is_liked,
    c.comment_count, c.save_count,
    exists(select 1 from capsule_saves cs where cs.capsule_id = c.id and cs.user_id = auth.uid()) as is_saved,
    c.share_count,
    c.created_at
  from capsules c
  join profiles pr on pr.id = c.user_id
  where c.id = p_capsule_id
    and not is_blocked_either_way(c.user_id)
    and (c.user_id = auth.uid() or (c.unlock_date <= now() and can_view_capsule(c.user_id, c.visibility)));
$$;

grant execute on function public.get_capsule(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. get_user_capsules — someone's visible capsules (own profile or
--     someone else's), with the archive's full filter set. When
--     p_owner_only_view is true (only ever meaningful when p_user_id is
--     the caller), search and unlock-status filtering are available and
--     content nulling still applies exactly the same as everywhere else
--     — your own archive doesn't get to peek early either.
-- ---------------------------------------------------------------------------
create or replace function public.get_user_capsules(
  p_user_id uuid,
  p_search text default null,
  p_lock_status text default null,
  p_year int default null,
  p_mood text default null,
  p_media_type text default null,
  p_visibility text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  is_private boolean,
  title text,
  memory_text text,
  memory_types text[],
  media jsonb,
  mood text,
  visibility text,
  unlock_date timestamptz,
  is_unlocked boolean,
  has_opened boolean,
  is_owner boolean,
  like_count int,
  is_liked boolean,
  comment_count int,
  save_count int,
  is_saved boolean,
  share_count int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.user_id, pr.username, pr.display_name, pr.profile_photo_url, pr.is_private,
    case when c.unlock_date <= now() then c.title else null end,
    case when c.unlock_date <= now() then c.memory_text else null end,
    c.memory_types,
    case when c.unlock_date <= now() then coalesce(
      (select jsonb_agg(jsonb_build_object('url', cm.media_url, 'type', cm.media_type, 'position', cm.position) order by cm.position)
       from capsule_media cm where cm.capsule_id = c.id),
      '[]'::jsonb
    ) else '[]'::jsonb end as media,
    c.mood,
    c.visibility,
    c.unlock_date,
    (c.unlock_date <= now()) as is_unlocked,
    exists(select 1 from capsule_unlocks cu where cu.capsule_id = c.id and cu.user_id = auth.uid()) as has_opened,
    (c.user_id = auth.uid()) as is_owner,
    c.like_count,
    exists(select 1 from capsule_likes cl where cl.capsule_id = c.id and cl.user_id = auth.uid()) as is_liked,
    c.comment_count, c.save_count,
    exists(select 1 from capsule_saves cs where cs.capsule_id = c.id and cs.user_id = auth.uid()) as is_saved,
    c.share_count,
    c.created_at
  from capsules c
  join profiles pr on pr.id = c.user_id
  where c.user_id = p_user_id
    and not is_blocked_either_way(c.user_id)
    and (c.user_id = auth.uid() or (c.unlock_date <= now() and can_view_capsule(c.user_id, c.visibility)))
    and (
      p_search is null or p_search = ''
      or (c.user_id = auth.uid() and (c.title ilike '%' || p_search || '%' or c.memory_text ilike '%' || p_search || '%'))
    )
    and (
      p_lock_status is null
      or (p_lock_status = 'locked' and c.unlock_date > now())
      or (p_lock_status = 'unlocked' and c.unlock_date <= now())
    )
    and (p_year is null or extract(year from c.unlock_date) = p_year)
    and (p_mood is null or c.mood = p_mood)
    and (p_media_type is null or p_media_type = any(c.memory_types))
    and (p_visibility is null or c.visibility = p_visibility)
  order by c.unlock_date asc, c.id desc
  limit p_limit offset p_offset;
$$;

grant execute on function public.get_user_capsules(uuid, text, text, int, text, text, text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. unlock_capsule — the ritual "open" action. Idempotent: calling it
--     again after the first time is a harmless no-op. Only ever records
--     the event; the client re-fetches via get_capsule for fresh content
--     immediately after, same two-step pattern Drops uses.
-- ---------------------------------------------------------------------------
create or replace function public.unlock_capsule(p_capsule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_visibility text;
  v_unlock_date timestamptz;
begin
  select user_id, visibility, unlock_date into v_owner_id, v_visibility, v_unlock_date
  from capsules where id = p_capsule_id;

  if v_owner_id is null then
    return;
  end if;

  if v_unlock_date > now() then
    raise exception 'This capsule has not unlocked yet.';
  end if;

  if v_owner_id <> auth.uid() and (is_blocked_either_way(v_owner_id) or not can_view_capsule(v_owner_id, v_visibility)) then
    raise exception 'You cannot open this capsule.';
  end if;

  insert into capsule_unlocks (capsule_id, user_id)
  values (p_capsule_id, auth.uid())
  on conflict (capsule_id, user_id) do nothing;

  if v_owner_id <> auth.uid() then
    insert into capsule_views (capsule_id, viewer_id)
    values (p_capsule_id, auth.uid())
    on conflict (capsule_id, viewer_id) do nothing;
  end if;
end;
$$;

grant execute on function public.unlock_capsule(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. get_capsule_reflections / get_capsule_comments — reflections are
--     always caller-only (never anyone else's, including your own
--     capsule's reflections from other people); comments follow the
--     same visibility rule as the capsule itself.
-- ---------------------------------------------------------------------------
create or replace function public.get_capsule_reflections(p_capsule_id uuid)
returns table (id uuid, content text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select cr.id, cr.content, cr.created_at
  from capsule_reflections cr
  where cr.capsule_id = p_capsule_id
    and cr.user_id = auth.uid()
  order by cr.created_at desc;
$$;

grant execute on function public.get_capsule_reflections(uuid) to authenticated;

create or replace function public.get_capsule_comments(p_capsule_id uuid, p_limit int default 50, p_offset int default 0)
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
  select cc.id, cc.user_id, pr.username, pr.display_name, pr.profile_photo_url, cc.content, cc.created_at
  from capsule_comments cc
  join profiles pr on pr.id = cc.user_id
  where cc.capsule_id = p_capsule_id
    and exists (
      select 1 from capsules c where c.id = p_capsule_id
        and (c.user_id = auth.uid() or (not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)))
    )
  order by cc.created_at asc
  limit p_limit offset p_offset;
$$;

grant execute on function public.get_capsule_comments(uuid, int, int) to authenticated;
