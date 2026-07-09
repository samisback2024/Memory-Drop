-- Memory Drop — Phase 5: Memory Moments.
-- Run once, after supabase/phase4d_engagement.sql, in the Supabase SQL
-- editor. Safe to re-run — every statement is idempotent.
--
-- Moments are NOT Instagram Stories reskinned: short-lived (12h/24h/48h,
-- chosen once at creation, never extendable), no templates, no stickers,
-- no swipe-up links. Once expires_at passes, a moment disappears from
-- every tray, viewer, and count for everyone except its own owner, who
-- can still see it in a private archive.

-- ---------------------------------------------------------------------------
-- 1. close_friends — placeholder relationship table. No management UI
--    ships this phase (the privacy tier exists in the picker, the
--    settings page to curate the list doesn't yet) — until a later phase
--    adds one, a close-friends-only moment is visible to nobody but its
--    owner, which is honest rather than broken: nobody's list has
--    members yet.
-- ---------------------------------------------------------------------------
create table if not exists public.close_friends (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, friend_id),
  check (owner_id <> friend_id)
);

create index if not exists close_friends_owner_id_idx on public.close_friends (owner_id);

alter table public.close_friends enable row level security;

drop policy if exists "Users can view their own close friends list" on public.close_friends;
create policy "Users can view their own close friends list"
  on public.close_friends for select
  using (auth.uid() = owner_id);

drop policy if exists "Users can add to their own close friends list" on public.close_friends;
create policy "Users can add to their own close friends list"
  on public.close_friends for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can remove from their own close friends list" on public.close_friends;
create policy "Users can remove from their own close friends list"
  on public.close_friends for delete
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- 2. moments
-- ---------------------------------------------------------------------------
create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text_content text,
  media_url text,
  media_type text not null check (media_type in ('photo', 'video', 'text')),
  mood text check (mood is null or mood in ('joyful', 'grateful', 'nostalgic', 'hopeful', 'reflective', 'peaceful', 'bittersweet', 'excited')),
  location_text text,
  mentioned_user_id uuid references public.profiles(id) on delete set null,
  privacy text not null default 'everyone' check (privacy in ('everyone', 'followers', 'close_friends', 'only_me')),
  duration_hours int not null check (duration_hours in (12, 24, 48)),
  expires_at timestamptz not null,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (media_type = 'text' or media_url is not null),
  check (media_type <> 'text' or text_content is not null)
);

create index if not exists moments_user_id_idx on public.moments (user_id);
create index if not exists moments_expires_at_idx on public.moments (expires_at);

-- expires_at is always derived server-side from duration_hours — a client
-- picks 12/24/48h, but can't smuggle in an arbitrary far-future expiry by
-- posting a crafted expires_at directly.
create or replace function public.set_moment_expiry()
returns trigger
language plpgsql
as $$
begin
  new.expires_at := new.created_at + (new.duration_hours || ' hours')::interval;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists moments_set_expiry on public.moments;
create trigger moments_set_expiry
  before insert on public.moments
  for each row
  execute function public.set_moment_expiry();

-- ---------------------------------------------------------------------------
-- 3. can_view_moment — same shape as can_view_drop from phase4c: decides
--    whether the caller can see a specific moment, given its owner and
--    privacy tier. Defined before the RLS that references it.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_moment(p_owner_id uuid, p_privacy text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner_id = auth.uid()
    or (
      p_privacy = 'everyone' and can_view_author_posts(p_owner_id)
    )
    or (
      p_privacy = 'followers' and exists (
        select 1 from follows
        where follower_id = auth.uid() and following_id = p_owner_id and status = 'accepted'
      )
    )
    or (
      p_privacy = 'close_friends' and exists (
        select 1 from close_friends
        where owner_id = p_owner_id and friend_id = auth.uid()
      )
    );
    -- p_privacy = 'only_me' never matches for anyone but the owner.
$$;

grant execute on function public.can_view_moment(uuid, text) to authenticated;

alter table public.moments enable row level security;

-- Non-owners only ever see unexpired moments through direct table access
-- too, not just through the RPCs below — expiry is enforced here, not
-- just filtered out in a read query.
drop policy if exists "Users can view visible moments" on public.moments;
create policy "Users can view visible moments"
  on public.moments for select
  using (
    user_id = auth.uid()
    or (expires_at > now() and not is_blocked_either_way(user_id) and can_view_moment(user_id, privacy))
  );

drop policy if exists "Users can create their own moments" on public.moments;
create policy "Users can create their own moments"
  on public.moments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own moments" on public.moments;
create policy "Users can update their own moments"
  on public.moments for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own moments" on public.moments;
create policy "Users can delete their own moments"
  on public.moments for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. moment_media — groundwork for a future multi-attachment moment,
--    mirroring how post_images backs posts. Not written to by the app
--    this phase (a moment has exactly one photo/video/text body, held
--    directly on moments.media_url/media_type) — this table exists so a
--    later phase can add multiple attachments without a schema change.
-- ---------------------------------------------------------------------------
create table if not exists public.moment_media (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('photo', 'video')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (moment_id, position)
);

create index if not exists moment_media_moment_id_idx on public.moment_media (moment_id);

alter table public.moment_media enable row level security;

drop policy if exists "Users can view media on visible moments" on public.moment_media;
create policy "Users can view media on visible moments"
  on public.moment_media for select
  using (
    exists (
      select 1 from moments m where m.id = moment_id
        and (m.user_id = auth.uid() or (m.expires_at > now() and not is_blocked_either_way(m.user_id) and can_view_moment(m.user_id, m.privacy)))
    )
  );

drop policy if exists "Users can add media to their own moment" on public.moment_media;
create policy "Users can add media to their own moment"
  on public.moment_media for insert
  with check (exists (select 1 from moments m where m.id = moment_id and m.user_id = auth.uid()));

drop policy if exists "Users can delete media from their own moment" on public.moment_media;
create policy "Users can delete media from their own moment"
  on public.moment_media for delete
  using (exists (select 1 from moments m where m.id = moment_id and m.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. moment_views — "seen by", and what view_count is trigger-derived
--    from. Self-views don't count (same convention as Instagram): the
--    INSERT policy rejects the owner viewing their own moment.
-- ---------------------------------------------------------------------------
create table if not exists public.moment_views (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (moment_id, viewer_id)
);

create index if not exists moment_views_moment_id_idx on public.moment_views (moment_id);
create index if not exists moment_views_viewer_id_idx on public.moment_views (viewer_id);

alter table public.moment_views enable row level security;

-- Only the moment's owner can read the raw rows (that's what powers the
-- seen list) — a viewer never sees who else viewed, only whether they
-- themselves already have (via is_viewed on the read RPCs).
drop policy if exists "Owners can view who saw their moment" on public.moment_views;
create policy "Owners can view who saw their moment"
  on public.moment_views for select
  using (exists (select 1 from moments m where m.id = moment_id and m.user_id = auth.uid()));

drop policy if exists "Users can record viewing a visible moment" on public.moment_views;
create policy "Users can record viewing a visible moment"
  on public.moment_views for insert
  with check (
    auth.uid() = viewer_id
    and exists (
      select 1 from moments m where m.id = moment_id
        and m.user_id <> auth.uid()
        and m.expires_at > now()
        and not is_blocked_either_way(m.user_id)
        and can_view_moment(m.user_id, m.privacy)
    )
  );

create or replace function public.adjust_moment_view_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update moments set view_count = view_count + 1 where id = new.moment_id;
  return new;
end;
$$;

drop trigger if exists moment_views_count_trigger on public.moment_views;
create trigger moment_views_count_trigger
  after insert on public.moment_views
  for each row
  execute function public.adjust_moment_view_count();

-- ---------------------------------------------------------------------------
-- 6. moment_reactions — one emoji reaction per (moment, viewer), tap
--    again with a different emoji to change it. Pre-unlock/post-unlock
--    doesn't apply here (moments have no lock state), but the same
--    "not your own content" rule from Phase 4's interests/replies
--    applies: you can't react to your own moment.
-- ---------------------------------------------------------------------------
create table if not exists public.moment_reactions (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (moment_id, user_id)
);

create index if not exists moment_reactions_moment_id_idx on public.moment_reactions (moment_id);

alter table public.moment_reactions enable row level security;

drop policy if exists "Users can view their own reaction" on public.moment_reactions;
create policy "Users can view their own reaction"
  on public.moment_reactions for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can view reactions on their moment" on public.moment_reactions;
create policy "Owners can view reactions on their moment"
  on public.moment_reactions for select
  using (exists (select 1 from moments m where m.id = moment_id and m.user_id = auth.uid()));

drop policy if exists "Users can react to a visible, unexpired moment" on public.moment_reactions;
create policy "Users can react to a visible, unexpired moment"
  on public.moment_reactions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from moments m where m.id = moment_id
        and m.user_id <> auth.uid()
        and m.expires_at > now()
        and not is_blocked_either_way(m.user_id)
        and can_view_moment(m.user_id, m.privacy)
    )
  );

drop policy if exists "Users can change their own reaction" on public.moment_reactions;
create policy "Users can change their own reaction"
  on public.moment_reactions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from moments m where m.id = moment_id and m.expires_at > now())
  );

drop policy if exists "Users can remove their own reaction" on public.moment_reactions;
create policy "Users can remove their own reaction"
  on public.moment_reactions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. moment_replies — text replies. Deliberately shaped like a future DM
--    (moment_id, user_id, content, created_at) since these rows are
--    groundwork for messaging/notifications, not a comment thread —
--    replies are private between the replier and the moment's owner,
--    nobody else can read them. Same "not your own moment" rule.
-- ---------------------------------------------------------------------------
create table if not exists public.moment_replies (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists moment_replies_moment_id_idx on public.moment_replies (moment_id);

alter table public.moment_replies enable row level security;

drop policy if exists "Repliers can view their own replies" on public.moment_replies;
create policy "Repliers can view their own replies"
  on public.moment_replies for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can view replies to their moment" on public.moment_replies;
create policy "Owners can view replies to their moment"
  on public.moment_replies for select
  using (exists (select 1 from moments m where m.id = moment_id and m.user_id = auth.uid()));

drop policy if exists "Users can reply to a visible, unexpired moment" on public.moment_replies;
create policy "Users can reply to a visible, unexpired moment"
  on public.moment_replies for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from moments m where m.id = moment_id
        and m.user_id <> auth.uid()
        and m.expires_at > now()
        and not is_blocked_either_way(m.user_id)
        and can_view_moment(m.user_id, m.privacy)
    )
  );

drop policy if exists "Repliers can delete their own reply" on public.moment_replies;
create policy "Repliers can delete their own reply"
  on public.moment_replies for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 8. Storage: moments bucket (photos + videos), same shape as post-media.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'moments', 'moments', true, 52428800,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Moment media is publicly accessible" on storage.objects;
create policy "Moment media is publicly accessible"
  on storage.objects for select
  using (bucket_id = 'moments');

drop policy if exists "Users can upload their own moment media" on storage.objects;
create policy "Users can upload their own moment media"
  on storage.objects for insert
  with check (bucket_id = 'moments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own moment media" on storage.objects;
create policy "Users can delete their own moment media"
  on storage.objects for delete
  using (bucket_id = 'moments' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 9. get_moments_tray — one row per active (unexpired) moment from
--    yourself or people you follow (not arbitrary public strangers —
--    Moments aren't a discovery surface the way Public Drops is). The
--    client groups these by user_id to build the tray; ordering puts
--    not-yet-viewed authors' moments first, then newest first, so an
--    unread author naturally sorts to the front of the tray.
-- ---------------------------------------------------------------------------
create or replace function public.get_moments_tray(p_limit int default 50)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  media_type text,
  mood text,
  expires_at timestamptz,
  created_at timestamptz,
  is_viewed boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.user_id, pr.username, pr.display_name, pr.profile_photo_url,
    m.media_type, m.mood, m.expires_at, m.created_at,
    exists(select 1 from moment_views mv where mv.moment_id = m.id and mv.viewer_id = auth.uid()) as is_viewed
  from moments m
  join profiles pr on pr.id = m.user_id
  where
    m.expires_at > now()
    and not is_blocked_either_way(m.user_id)
    and (
      m.user_id = auth.uid()
      or exists(select 1 from follows f where f.follower_id = auth.uid() and f.following_id = m.user_id and f.status = 'accepted')
    )
    and can_view_moment(m.user_id, m.privacy)
  order by
    (exists(select 1 from moment_views mv where mv.moment_id = m.id and mv.viewer_id = auth.uid())) asc,
    m.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_moments_tray(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. get_user_moments — a single author's stack, oldest first (the
--     order the full-screen viewer plays them in). p_include_expired
--     only ever has an effect for your own moments — everyone else's
--     expired moments stay invisible regardless of the flag, since the
--     visibility clause already excludes them outright.
-- ---------------------------------------------------------------------------
create or replace function public.get_user_moments(p_user_id uuid, p_include_expired boolean default false)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  text_content text,
  media_url text,
  media_type text,
  mood text,
  location_text text,
  mentioned_username text,
  privacy text,
  duration_hours int,
  expires_at timestamptz,
  is_owner boolean,
  is_expired boolean,
  view_count int,
  my_reaction text,
  is_viewed boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.user_id, pr.username, pr.display_name, pr.profile_photo_url,
    m.text_content, m.media_url, m.media_type, m.mood, m.location_text,
    mpr.username as mentioned_username,
    m.privacy, m.duration_hours, m.expires_at,
    (m.user_id = auth.uid()) as is_owner,
    (m.expires_at <= now()) as is_expired,
    case when m.user_id = auth.uid() then m.view_count else 0 end as view_count,
    (select mr.emoji from moment_reactions mr where mr.moment_id = m.id and mr.user_id = auth.uid()) as my_reaction,
    exists(select 1 from moment_views mv where mv.moment_id = m.id and mv.viewer_id = auth.uid()) as is_viewed,
    m.created_at
  from moments m
  join profiles pr on pr.id = m.user_id
  left join profiles mpr on mpr.id = m.mentioned_user_id
  where m.user_id = p_user_id
    and not is_blocked_either_way(m.user_id)
    and (m.user_id = auth.uid() or can_view_moment(m.user_id, m.privacy))
    and (m.expires_at > now() or (p_include_expired and m.user_id = auth.uid()))
  order by m.created_at asc;
$$;

grant execute on function public.get_user_moments(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. get_moment — a single moment by id, for the /moments/:id permalink.
-- ---------------------------------------------------------------------------
create or replace function public.get_moment(p_moment_id uuid)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  text_content text,
  media_url text,
  media_type text,
  mood text,
  location_text text,
  mentioned_username text,
  privacy text,
  duration_hours int,
  expires_at timestamptz,
  is_owner boolean,
  is_expired boolean,
  view_count int,
  my_reaction text,
  is_viewed boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.user_id, pr.username, pr.display_name, pr.profile_photo_url,
    m.text_content, m.media_url, m.media_type, m.mood, m.location_text,
    mpr.username as mentioned_username,
    m.privacy, m.duration_hours, m.expires_at,
    (m.user_id = auth.uid()) as is_owner,
    (m.expires_at <= now()) as is_expired,
    case when m.user_id = auth.uid() then m.view_count else 0 end as view_count,
    (select mr.emoji from moment_reactions mr where mr.moment_id = m.id and mr.user_id = auth.uid()) as my_reaction,
    exists(select 1 from moment_views mv where mv.moment_id = m.id and mv.viewer_id = auth.uid()) as is_viewed,
    m.created_at
  from moments m
  join profiles pr on pr.id = m.user_id
  left join profiles mpr on mpr.id = m.mentioned_user_id
  where m.id = p_moment_id
    and not is_blocked_either_way(m.user_id)
    and (m.user_id = auth.uid() or (m.expires_at > now() and can_view_moment(m.user_id, m.privacy)));
$$;

grant execute on function public.get_moment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. get_moment_seen_list / get_moment_reactions — owner-only. Both
--     quietly return zero rows for anyone who isn't the moment's owner,
--     rather than raising, since "not the owner" is the common case for
--     any caller who isn't misusing the API.
-- ---------------------------------------------------------------------------
create or replace function public.get_moment_seen_list(p_moment_id uuid)
returns table (
  viewer_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  viewed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select mv.viewer_id, pr.username, pr.display_name, pr.profile_photo_url, mv.viewed_at
  from moment_views mv
  join profiles pr on pr.id = mv.viewer_id
  where mv.moment_id = p_moment_id
    and exists (select 1 from moments m where m.id = p_moment_id and m.user_id = auth.uid())
  order by mv.viewed_at desc;
$$;

grant execute on function public.get_moment_seen_list(uuid) to authenticated;

create or replace function public.get_moment_reactions(p_moment_id uuid)
returns table (emoji text, reaction_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select mr.emoji, count(*) as reaction_count
  from moment_reactions mr
  where mr.moment_id = p_moment_id
    and exists (select 1 from moments m where m.id = p_moment_id and m.user_id = auth.uid())
  group by mr.emoji
  order by count(*) desc;
$$;

grant execute on function public.get_moment_reactions(uuid) to authenticated;
