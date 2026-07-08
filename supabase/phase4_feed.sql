-- Memory Drop — Phase 4: Feed
-- Run once, after supabase/phase3_social_graph.sql, in the Supabase SQL editor.
-- Safe to re-run: every statement is idempotent, except CREATE FUNCTION
-- statements whose RETURNS TABLE shape is new (those DROP first).

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_type text not null check (post_type in ('photo', 'video', 'text')),
  caption text,
  video_url text,
  like_count int not null default 0,
  comment_count int not null default 0,
  share_count int not null default 0,
  save_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint caption_length check (caption is null or char_length(caption) <= 2200),
  constraint video_only_on_video_posts check (video_url is null or post_type = 'video')
);

-- post_type isn't mixed yet (a post is photos OR a video OR text-only, not
-- combined) — the schema keeps images and video as independent columns so a
-- later phase can lift that restriction without a migration, per "mixed
-- media preparation."
create table if not exists public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  image_url text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  constraint unique_post_image_position unique (post_id, position)
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint unique_like unique (post_id, user_id)
);

-- parent_comment_id exists now (nested replies preparation) but Phase 4's UI
-- always inserts null here — every comment renders flat until a later phase
-- builds threaded replies on top of this column.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_comment_id uuid references public.comments (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint comment_length check (char_length(content) between 1 and 1000)
);

create table if not exists public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint unique_save unique (post_id, user_id)
);

create table if not exists public.hidden_posts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint unique_hide unique (post_id, user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'violence', 'nudity', 'fake_account', 'other')),
  details text,
  created_at timestamptz not null default now(),
  constraint unique_report unique (post_id, reporter_id),
  constraint details_length check (details is null or char_length(details) <= 500)
);

create index if not exists posts_user_idx on public.posts (user_id, created_at desc);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_likes_idx on public.posts (like_count desc, created_at desc);
create index if not exists post_images_post_idx on public.post_images (post_id, position);
create index if not exists likes_post_idx on public.likes (post_id);
create index if not exists likes_user_idx on public.likes (user_id);
create index if not exists comments_post_idx on public.comments (post_id, created_at);
create index if not exists saved_posts_user_idx on public.saved_posts (user_id, created_at desc);
create index if not exists hidden_posts_user_idx on public.hidden_posts (user_id);
create index if not exists reports_post_idx on public.reports (post_id);

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at
  before update on public.posts
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Visibility helpers — same shape as get_profile_by_username's privacy
--    check (Phase 2/3), pulled out into functions here because posts, post_images,
--    likes, comments, and saved_posts all need the identical "can this
--    viewer see this author's content" and "are these two blocked" checks.
--    SECURITY DEFINER because they read profiles/follows/user_blocks, all of
--    which are locked to `auth.uid() = <owner column>` under their own RLS.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_author_posts(p_author_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_author_id = auth.uid()
    or coalesce((select not is_private from profiles where id = p_author_id), false)
    or exists (
      select 1 from follows
      where follower_id = auth.uid() and following_id = p_author_id and status = 'accepted'
    );
$$;

grant execute on function public.can_view_author_posts(uuid) to authenticated;

create or replace function public.is_blocked_either_way(p_other_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_blocks
    where (blocker_id = auth.uid() and blocked_id = p_other_id)
       or (blocker_id = p_other_id and blocked_id = auth.uid())
  );
$$;

grant execute on function public.is_blocked_either_way(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Denormalized counters — like_count/comment_count/save_count on posts
--    are maintained by triggers, not computed at read time, so sorting
--    Trending by likes or rendering counts in the feed never needs a join
--    aggregate. SECURITY DEFINER: the person liking/commenting/saving is
--    essentially never the post owner, so without bypassing RLS the UPDATE
--    below would be blocked by posts' own "owners only" update policy.
-- ---------------------------------------------------------------------------
create or replace function public.adjust_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  else
    update posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end;
$$;

drop trigger if exists likes_adjust_count on public.likes;
create trigger likes_adjust_count
  after insert or delete on public.likes
  for each row
  execute function public.adjust_post_like_count();

create or replace function public.adjust_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  else
    update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end;
$$;

drop trigger if exists comments_adjust_count on public.comments;
create trigger comments_adjust_count
  after insert or delete on public.comments
  for each row
  execute function public.adjust_post_comment_count();

create or replace function public.adjust_post_save_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update posts set save_count = save_count + 1 where id = new.post_id;
    return new;
  else
    update posts set save_count = greatest(save_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end;
$$;

drop trigger if exists saved_posts_adjust_count on public.saved_posts;
create trigger saved_posts_adjust_count
  after insert or delete on public.saved_posts
  for each row
  execute function public.adjust_post_save_count();

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.posts enable row level security;

drop policy if exists "Users can view visible posts" on public.posts;
create policy "Users can view visible posts"
  on public.posts for select
  using (
    user_id = auth.uid()
    or (not is_blocked_either_way(user_id) and can_view_author_posts(user_id))
  );

drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own posts" on public.posts;
create policy "Users can update their own posts"
  on public.posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts"
  on public.posts for delete
  using (auth.uid() = user_id);

alter table public.post_images enable row level security;

drop policy if exists "Users can view images of visible posts" on public.post_images;
create policy "Users can view images of visible posts"
  on public.post_images for select
  using (
    exists (
      select 1 from posts p where p.id = post_images.post_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_author_posts(p.user_id)))
    )
  );

drop policy if exists "Users can add images to their own posts" on public.post_images;
create policy "Users can add images to their own posts"
  on public.post_images for insert
  with check (exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid()));

drop policy if exists "Users can delete images from their own posts" on public.post_images;
create policy "Users can delete images from their own posts"
  on public.post_images for delete
  using (exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid()));

alter table public.likes enable row level security;

drop policy if exists "Users can view their own likes" on public.likes;
create policy "Users can view their own likes"
  on public.likes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can like visible posts" on public.likes;
create policy "Users can like visible posts"
  on public.likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from posts p where p.id = post_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_author_posts(p.user_id)))
    )
  );

drop policy if exists "Users can unlike their own likes" on public.likes;
create policy "Users can unlike their own likes"
  on public.likes for delete
  using (auth.uid() = user_id);

alter table public.comments enable row level security;

drop policy if exists "Users can view comments on visible posts" on public.comments;
create policy "Users can view comments on visible posts"
  on public.comments for select
  using (
    exists (
      select 1 from posts p where p.id = post_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_author_posts(p.user_id)))
    )
  );

drop policy if exists "Users can comment on visible posts" on public.comments;
create policy "Users can comment on visible posts"
  on public.comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from posts p where p.id = post_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_author_posts(p.user_id)))
    )
  );

drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can delete their own comments"
  on public.comments for delete
  using (auth.uid() = user_id);

alter table public.saved_posts enable row level security;

drop policy if exists "Users can view their own saves" on public.saved_posts;
create policy "Users can view their own saves"
  on public.saved_posts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can save visible posts" on public.saved_posts;
create policy "Users can save visible posts"
  on public.saved_posts for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from posts p where p.id = post_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_author_posts(p.user_id)))
    )
  );

drop policy if exists "Users can unsave their own saves" on public.saved_posts;
create policy "Users can unsave their own saves"
  on public.saved_posts for delete
  using (auth.uid() = user_id);

alter table public.hidden_posts enable row level security;

drop policy if exists "Users can view their own hidden posts" on public.hidden_posts;
create policy "Users can view their own hidden posts"
  on public.hidden_posts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can hide posts" on public.hidden_posts;
create policy "Users can hide posts"
  on public.hidden_posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unhide posts" on public.hidden_posts;
create policy "Users can unhide posts"
  on public.hidden_posts for delete
  using (auth.uid() = user_id);

-- reports has no SELECT policy at all — write-only from the client's
-- perspective, same as a suggestion box. Reviewing them is an admin-tool
-- concern for a much later phase.
alter table public.reports enable row level security;

drop policy if exists "Users can report posts" on public.reports;
create policy "Users can report posts"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- 5. RPCs
--
--    get_feed/get_saved_posts are SECURITY DEFINER so they can join profiles
--    for author info (locked to owner-only under normal RLS) — but that
--    means they bypass posts' RLS too, not just profiles', so each one
--    re-implements the exact same visibility predicate posts' own SELECT
--    policy uses, via the same two helper functions. The table-level RLS
--    remains as defense in depth for any future direct-table access path.
-- ---------------------------------------------------------------------------
drop function if exists public.get_feed(text, int, int);
create function public.get_feed(p_tab text, p_limit int default 10, p_offset int default 0)
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
  images jsonb,
  like_count int,
  comment_count int,
  share_count int,
  save_count int,
  is_liked boolean,
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
      p.caption, p.post_type, p.video_url,
      coalesce(
        (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'position', pi.position) order by pi.position)
         from post_images pi where pi.post_id = p.id),
        '[]'::jsonb
      ) as images,
      p.like_count, p.comment_count, p.share_count, p.save_count,
      exists(select 1 from likes l where l.post_id = p.id and l.user_id = auth.uid()) as is_liked,
      exists(select 1 from saved_posts sp where sp.post_id = p.id and sp.user_id = auth.uid()) as is_saved,
      p.created_at
    from posts p
    join profiles pr on pr.id = p.user_id
    where
      not exists (select 1 from hidden_posts h where h.post_id = p.id and h.user_id = auth.uid())
      and not is_blocked_either_way(p.user_id)
      and (
        case p_tab
          when 'following' then (
            p.user_id = auth.uid()
            or exists (select 1 from follows f where f.follower_id = auth.uid() and f.following_id = p.user_id and f.status = 'accepted')
          )
          when 'discover' then not pr.is_private
          else can_view_author_posts(p.user_id) -- trending, recent
        end
      )
    order by
      case when p_tab = 'trending' then p.like_count else null end desc nulls last,
      p.created_at desc,
      p.id desc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.get_feed(text, int, int) to authenticated;

drop function if exists public.get_saved_posts(int, int);
create function public.get_saved_posts(p_limit int default 10, p_offset int default 0)
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
  images jsonb,
  like_count int,
  comment_count int,
  share_count int,
  save_count int,
  is_liked boolean,
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
    p.caption, p.post_type, p.video_url,
    coalesce(
      (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'position', pi.position) order by pi.position)
       from post_images pi where pi.post_id = p.id),
      '[]'::jsonb
    ) as images,
    p.like_count, p.comment_count, p.share_count, p.save_count,
    exists(select 1 from likes l where l.post_id = p.id and l.user_id = auth.uid()) as is_liked,
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

grant execute on function public.get_saved_posts(int, int) to authenticated;

drop function if exists public.get_comments(uuid, int, int);
create function public.get_comments(p_post_id uuid, p_limit int default 20, p_offset int default 0)
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
    and exists (
      select 1 from posts p where p.id = p_post_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_author_posts(p.user_id)))
    )
  order by c.created_at asc
  limit p_limit offset p_offset;
$$;

grant execute on function public.get_comments(uuid, int, int) to authenticated;

-- Single-post fetch — backs the /post/:postId permalink page, which exists
-- mainly so ShareModal's "Copy Link" has somewhere real to point at.
drop function if exists public.get_post(uuid);
create function public.get_post(p_post_id uuid)
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
  images jsonb,
  like_count int,
  comment_count int,
  share_count int,
  save_count int,
  is_liked boolean,
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
    p.caption, p.post_type, p.video_url,
    coalesce(
      (select jsonb_agg(jsonb_build_object('url', pi.image_url, 'position', pi.position) order by pi.position)
       from post_images pi where pi.post_id = p.id),
      '[]'::jsonb
    ) as images,
    p.like_count, p.comment_count, p.share_count, p.save_count,
    exists(select 1 from likes l where l.post_id = p.id and l.user_id = auth.uid()) as is_liked,
    exists(select 1 from saved_posts sp where sp.post_id = p.id and sp.user_id = auth.uid()) as is_saved,
    p.created_at
  from posts p
  join profiles pr on pr.id = p.user_id
  where p.id = p_post_id
    and not is_blocked_either_way(p.user_id)
    and (p.user_id = auth.uid() or can_view_author_posts(p.user_id));
$$;

grant execute on function public.get_post(uuid) to authenticated;

-- Shares aren't a table (no per-user record, no "who shared" needed for
-- Phase 4) — Copy Link and native share are client-only actions that just
-- bump this counter so the count on the card stays meaningful.
create or replace function public.increment_share_count(p_post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update posts set share_count = share_count + 1 where id = p_post_id;
$$;

grant execute on function public.increment_share_count(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Storage: post-media bucket (photos + videos)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media', 'post-media', true, 52428800,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Post media is publicly accessible" on storage.objects;
create policy "Post media is publicly accessible"
  on storage.objects for select
  using (bucket_id = 'post-media');

drop policy if exists "Users can upload their own post media" on storage.objects;
create policy "Users can upload their own post media"
  on storage.objects for insert
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own post media" on storage.objects;
create policy "Users can delete their own post media"
  on storage.objects for delete
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
