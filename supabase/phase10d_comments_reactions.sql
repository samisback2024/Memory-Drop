-- Memory Drop — Phase 10d: Comments + Reactions.
-- Run once, after supabase/phase10c_saved_share.sql, in the Supabase SQL
-- editor. Safe to re-run — every statement is idempotent.
--
-- Fourth of six Phase 10 sub-phases.
--
-- Audit findings before writing anything: `comments` (Drops) has had a
-- dormant `parent_comment_id` column since Phase 4 ("nested replies
-- preparation") that no RPC or frontend code has ever read or written —
-- this phase finally wires it up. `capsule_comments` has no threading
-- column at all (added here). Neither table had an UPDATE policy, so
-- editing was impossible even at the database level, not just missing
-- UI. Delete already worked for Drop comments end-to-end but was never
-- wired to a button for Capsule comments despite the hook existing —
-- fixed as part of unifying the two comment UIs into one component.
-- `likes`/`capsule_likes` are binary (heart-only) with SELECT locked to
-- own-rows-only; `moment_reactions` is the only existing precedent for
-- multi-emoji, one-per-user reactions with a working undo (swap via
-- UPDATE, remove via DELETE) — comment_reactions below follows that
-- same model rather than inventing a new one.
--
-- Deliberate scope decisions (see README Known limitations for the
-- full list): replies are ONE level deep, not infinitely nested — the
-- overwhelming majority of comment threads never go deeper than that,
-- and infinite nesting is real added complexity (recursive queries,
-- recursive UI, unbounded indentation) for a benefit this app's scale
-- doesn't need yet. Drops'/Capsules' own likes stay binary (heart-only)
-- rather than being widened into multi-emoji reactions — that's a
-- bigger, riskier schema change touching already-tested counter logic
-- across many surfaces; "Top reactions" for those two content types
-- isn't attempted for the same reason (a single reaction type has no
-- "top" to show). @mentions get plain-text parsing + an autocomplete
-- UI, not a tracked `comment_mentions` table — there's no notification
-- system for a mention to feed into yet (explicitly out of scope for
-- all of Phase 10), so tracking would have no consumer.

-- ---------------------------------------------------------------------------
-- 1. comments (Drops) — activate parent_comment_id, add edited_at +
--    is_pinned, and a combined INSERT/UPDATE trigger that's the real
--    enforcement layer: RLS decides which ROWS you can attempt to
--    touch, the trigger decides which COLUMNS you're actually allowed
--    to change and only if you're the right person for that column.
-- ---------------------------------------------------------------------------
alter table public.comments add column if not exists edited_at timestamptz;
alter table public.comments add column if not exists is_pinned boolean not null default false;

create or replace function public.enforce_comment_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_parent_parent uuid;
begin
  select user_id into v_owner from posts where id = coalesce(new.post_id, old.post_id);

  if tg_op = 'INSERT' then
    if new.parent_comment_id is not null then
      select parent_comment_id into v_parent_parent from comments where id = new.parent_comment_id and post_id = new.post_id;
      if not found then
        raise exception 'Cannot reply to a comment that does not belong to this drop.';
      end if;
      if v_parent_parent is not null then
        raise exception 'Replies can only be one level deep.';
      end if;
    end if;
    return new;
  end if;

  if new.content is distinct from old.content then
    if auth.uid() <> old.user_id then
      raise exception 'Only the comment author can edit its content.';
    end if;
    new.edited_at = now();
  end if;
  if new.is_pinned is distinct from old.is_pinned then
    if auth.uid() <> v_owner then
      raise exception 'Only the drop owner can pin or unpin a comment.';
    end if;
  end if;
  new.post_id = old.post_id;
  new.user_id = old.user_id;
  new.parent_comment_id = old.parent_comment_id;
  new.created_at = old.created_at;
  new.is_reflection = old.is_reflection;
  return new;
end;
$$;

drop trigger if exists comments_rules on public.comments;
create trigger comments_rules
  before insert or update on public.comments
  for each row execute function public.enforce_comment_rules();

drop policy if exists "Comment author or drop owner can update" on public.comments;
create policy "Comment author or drop owner can update"
  on public.comments for update
  using (
    auth.uid() = user_id
    or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  )
  with check (true);

-- ---------------------------------------------------------------------------
-- 2. capsule_comments — same three additions (parent_comment_id is new
--    here, unlike comments), same trigger pattern, keyed off capsules
--    instead of posts.
-- ---------------------------------------------------------------------------
alter table public.capsule_comments add column if not exists parent_comment_id uuid references public.capsule_comments(id) on delete cascade;
alter table public.capsule_comments add column if not exists edited_at timestamptz;
alter table public.capsule_comments add column if not exists is_pinned boolean not null default false;

create or replace function public.enforce_capsule_comment_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_parent_parent uuid;
begin
  select user_id into v_owner from capsules where id = coalesce(new.capsule_id, old.capsule_id);

  if tg_op = 'INSERT' then
    if new.parent_comment_id is not null then
      select parent_comment_id into v_parent_parent from capsule_comments where id = new.parent_comment_id and capsule_id = new.capsule_id;
      if not found then
        raise exception 'Cannot reply to a comment that does not belong to this capsule.';
      end if;
      if v_parent_parent is not null then
        raise exception 'Replies can only be one level deep.';
      end if;
    end if;
    return new;
  end if;

  if new.content is distinct from old.content then
    if auth.uid() <> old.user_id then
      raise exception 'Only the comment author can edit its content.';
    end if;
    new.edited_at = now();
  end if;
  if new.is_pinned is distinct from old.is_pinned then
    if auth.uid() <> v_owner then
      raise exception 'Only the capsule owner can pin or unpin a comment.';
    end if;
  end if;
  new.capsule_id = old.capsule_id;
  new.user_id = old.user_id;
  new.parent_comment_id = old.parent_comment_id;
  new.created_at = old.created_at;
  return new;
end;
$$;

drop trigger if exists capsule_comments_rules on public.capsule_comments;
create trigger capsule_comments_rules
  before insert or update on public.capsule_comments
  for each row execute function public.enforce_capsule_comment_rules();

drop policy if exists "Comment author or capsule owner can update" on public.capsule_comments;
create policy "Comment author or capsule owner can update"
  on public.capsule_comments for update
  using (
    auth.uid() = user_id
    or exists (select 1 from capsules c where c.id = capsule_id and c.user_id = auth.uid())
  )
  with check (true);

-- ---------------------------------------------------------------------------
-- 3. comment_reactions — one active emoji reaction per user per comment
--    (swap via UPDATE, remove via DELETE), same model as moment_reactions.
--    Polymorphic across the two comment tables via the same XOR-FK
--    pattern used throughout this app (favorites, collection_items,
--    pinned_items).
-- ---------------------------------------------------------------------------
create table if not exists public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  drop_comment_id uuid references public.comments(id) on delete cascade,
  capsule_comment_id uuid references public.capsule_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  constraint comment_reactions_check check (
    (drop_comment_id is not null)::int + (capsule_comment_id is not null)::int = 1
  )
);

create unique index if not exists comment_reactions_drop_user_idx on public.comment_reactions (drop_comment_id, user_id) where drop_comment_id is not null;
create unique index if not exists comment_reactions_capsule_user_idx on public.comment_reactions (capsule_comment_id, user_id) where capsule_comment_id is not null;

alter table public.comment_reactions enable row level security;

drop policy if exists "Users can view reactions on visible comments" on public.comment_reactions;
create policy "Users can view reactions on visible comments"
  on public.comment_reactions for select
  using (
    (drop_comment_id is not null and exists (
      select 1 from comments c join posts p on p.id = c.post_id
      where c.id = drop_comment_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
    ))
    or
    (capsule_comment_id is not null and exists (
      select 1 from capsule_comments cc join capsules cap on cap.id = cc.capsule_id
      where cc.id = capsule_comment_id
        and (cap.user_id = auth.uid() or (not is_blocked_either_way(cap.user_id) and can_view_capsule(cap.user_id, cap.visibility)))
    ))
  );

drop policy if exists "Users can react to a visible comment" on public.comment_reactions;
create policy "Users can react to a visible comment"
  on public.comment_reactions for insert
  with check (
    auth.uid() = user_id
    and (
      (drop_comment_id is not null and exists (
        select 1 from comments c join posts p on p.id = c.post_id
        where c.id = drop_comment_id
          and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
      ))
      or
      (capsule_comment_id is not null and exists (
        select 1 from capsule_comments cc join capsules cap on cap.id = cc.capsule_id
        where cc.id = capsule_comment_id
          and (cap.user_id = auth.uid() or (not is_blocked_either_way(cap.user_id) and can_view_capsule(cap.user_id, cap.visibility)))
      ))
    )
  );

drop policy if exists "Users can change their own comment reaction" on public.comment_reactions;
create policy "Users can change their own comment reaction"
  on public.comment_reactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own comment reaction" on public.comment_reactions;
create policy "Users can remove their own comment reaction"
  on public.comment_reactions for delete
  using (auth.uid() = user_id);

create or replace function public.get_comment_reactions(p_comment_type text, p_comment_id uuid)
returns table (emoji text, reaction_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select cr.emoji, count(*)
  from public.comment_reactions cr
  where (p_comment_type = 'drop' and cr.drop_comment_id = p_comment_id)
     or (p_comment_type = 'capsule' and cr.capsule_comment_id = p_comment_id)
  group by cr.emoji
  order by count(*) desc;
$$;

grant execute on function public.get_comment_reactions(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. get_drop_comments / get_capsule_comments — widened return shape
--    (edited_at, parent_comment_id, is_pinned, reaction_count, my_reaction),
--    so DROP + CREATE rather than CREATE OR REPLACE (Postgres can't
--    change a function's return columns in place). Pinned comments sort
--    first; everything else stays chronological — the client groups
--    replies under their parent after fetching the flat list.
-- ---------------------------------------------------------------------------
drop function if exists public.get_drop_comments(uuid, int, int);
create function public.get_drop_comments(p_post_id uuid, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  content text,
  created_at timestamptz,
  edited_at timestamptz,
  parent_comment_id uuid,
  is_pinned boolean,
  reaction_count int,
  my_reaction text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.user_id, pr.username, pr.display_name, pr.profile_photo_url,
    c.content, c.created_at, c.edited_at, c.parent_comment_id, c.is_pinned,
    (select count(*)::int from comment_reactions cr where cr.drop_comment_id = c.id),
    (select cr.emoji from comment_reactions cr where cr.drop_comment_id = c.id and cr.user_id = auth.uid())
  from comments c
  join profiles pr on pr.id = c.user_id
  where c.post_id = p_post_id
    and (not c.is_reflection or c.user_id = auth.uid())
    and exists (
      select 1 from posts p where p.id = c.post_id
        and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
    )
  order by c.is_pinned desc, c.created_at asc
  limit p_limit offset p_offset;
$$;

grant execute on function public.get_drop_comments(uuid, int, int) to authenticated;

drop function if exists public.get_capsule_comments(uuid, int, int);
create function public.get_capsule_comments(p_capsule_id uuid, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  content text,
  created_at timestamptz,
  edited_at timestamptz,
  parent_comment_id uuid,
  is_pinned boolean,
  reaction_count int,
  my_reaction text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cc.id, cc.user_id, pr.username, pr.display_name, pr.profile_photo_url,
    cc.content, cc.created_at, cc.edited_at, cc.parent_comment_id, cc.is_pinned,
    (select count(*)::int from comment_reactions cr where cr.capsule_comment_id = cc.id),
    (select cr.emoji from comment_reactions cr where cr.capsule_comment_id = cc.id and cr.user_id = auth.uid())
  from capsule_comments cc
  join profiles pr on pr.id = cc.user_id
  where cc.capsule_id = p_capsule_id
    and exists (
      select 1 from capsules c where c.id = cc.capsule_id
        and (c.user_id = auth.uid() or (not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)))
    )
  order by cc.is_pinned desc, cc.created_at asc
  limit p_limit offset p_offset;
$$;

grant execute on function public.get_capsule_comments(uuid, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. get_recent_likers — "Recent reactions" for the broader Reactions
--    brief. likes/capsule_likes' own SELECT policies are own-rows-only
--    (same posture as favorites), so listing *other* people's likes —
--    even just to show an avatar stack — needs a SECURITY DEFINER RPC,
--    same reasoning as everywhere else cross-user data is read in this
--    app. "Top reactions" isn't a separate RPC here: Drops/Capsules
--    likes stay a single reaction type (a heart), so there's nothing to
--    break down by type the way Moments' get_moment_reactions already
--    does — that existing RPC is the "top reactions" answer for Moments.
-- ---------------------------------------------------------------------------
create or replace function public.get_recent_likers(p_content_type text, p_content_id uuid, p_limit int default 10)
returns table (user_id uuid, username text, display_name text, profile_photo_url text, liked_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_content_type = 'drop' then
    return query
      select pr.id, pr.username, pr.display_name, pr.profile_photo_url, l.created_at
      from likes l
      join profiles pr on pr.id = l.user_id
      where l.post_id = p_content_id
        and exists (
          select 1 from posts p where p.id = p_content_id
            and (p.user_id = auth.uid() or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility)))
        )
      order by l.created_at desc
      limit p_limit;
  elsif p_content_type = 'capsule' then
    return query
      select pr.id, pr.username, pr.display_name, pr.profile_photo_url, cl.created_at
      from capsule_likes cl
      join profiles pr on pr.id = cl.user_id
      where cl.capsule_id = p_content_id
        and exists (
          select 1 from capsules c where c.id = p_content_id
            and (c.user_id = auth.uid() or (not is_blocked_either_way(c.user_id) and can_view_capsule(c.user_id, c.visibility)))
        )
      order by cl.created_at desc
      limit p_limit;
  end if;
end;
$$;

grant execute on function public.get_recent_likers(text, uuid, int) to authenticated;
