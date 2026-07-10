-- Memory Drop — Phase 11: Notifications & Activity Center.
-- Run once, after supabase/phase10g_polish_fixes.sql, in the Supabase
-- SQL editor. Safe to re-run — every statement is idempotent.
--
-- Three new tables:
--   1. notification_events — an append-only, idempotent ledger of every
--      real-world thing that happened (X liked Y). A UNIQUE constraint
--      on the natural key (event_type, actor_id, recipient_id,
--      entity_type, entity_id) is what "avoid duplicates" actually
--      means here — re-triggering the same underlying action (unlike
--      then re-like, for example) is a harmless no-op, not a second
--      notification. Never granted to authenticated/anon — same
--      "internal-only" posture memory_items_view established in Phase 9,
--      just as a table instead of a view this time.
--   2. notifications — the per-recipient inbox row a real UI reads.
--      Created FROM notification_events by the same helper function,
--      only when the events insert wasn't a duplicate.
--   3. notification_preferences already existed (Phase 8, "eight
--      toggles... store-only, no delivery system reads this yet") —
--      this phase is that delivery system. Two columns are added
--      (`mentions`, `security_alerts`) since the existing eight didn't
--      quite cover every category this phase's brief asks for; every
--      trigger below checks the relevant existing or new column before
--      creating anything.
--
-- Event generation is entirely trigger-based (AFTER INSERT/UPDATE on
-- the tables that already record these actions — drop_interests,
-- likes, comments, capsule_likes, capsule_comments, moment_views,
-- moment_replies, moment_reactions, follows, drop_unlock_views,
-- user_sessions) rather than new application code calling a "create
-- notification" function after each action — this means there's no
-- risk of a code path forgetting to notify, and it works identically
-- whether the write came from the app or a direct API call.
--
-- Known, deliberate gap: "Capsule unlock reminder" and "Weekly Memory
-- Recap" are genuinely time-based events (nothing happens, time just
-- passes) — no INSERT/UPDATE exists to hook a trigger to. Two real,
-- correct, callable functions are provided
-- (generate_unlock_reminders(), generate_weekly_recap()) but nothing
-- schedules them — that needs pg_cron enabled in the Supabase
-- dashboard and a `select cron.schedule(...)` call, a one-time
-- operator action outside what a SQL migration file can do on its own.
-- See README Known limitations.

-- ---------------------------------------------------------------------------
-- 1. notification_preferences — widen with the two categories the
--    existing eight columns don't cover.
-- ---------------------------------------------------------------------------
alter table public.notification_preferences add column if not exists mentions boolean not null default true;
alter table public.notification_preferences add column if not exists security_alerts boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. notification_events — the idempotent ledger. entity_id is
--    deliberately NOT a foreign key (it can point at posts, capsules,
--    moments, or comments — four different tables, no single FK target
--    makes sense) — see README for how deleted-content links are
--    handled gracefully on the read side instead of via cascade.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_id uuid references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('drop', 'capsule', 'moment', 'comment', 'user', 'system')),
  entity_id uuid,
  created_at timestamptz not null default now(),
  constraint notification_events_natural_key unique (event_type, actor_id, recipient_id, entity_type, entity_id)
);

create index if not exists notification_events_recipient_idx on public.notification_events (recipient_id, created_at desc);

alter table public.notification_events enable row level security;
revoke all on public.notification_events from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- 3. notifications — the inbox row a real UI reads.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in (
    'new_follower', 'follow_request', 'follow_accepted', 'mention',
    'drop_save_to_unlock', 'drop_good_vibes', 'drop_cant_wait', 'drop_interested',
    'drop_unlock_viewed', 'drop_liked', 'drop_commented', 'drop_replied', 'drop_reflected',
    'moment_viewed', 'moment_replied', 'moment_reacted',
    'capsule_unlock_reminder', 'capsule_unlocked', 'capsule_viewed', 'capsule_liked',
    'capsule_commented', 'capsule_replied', 'capsule_reflected',
    'weekly_recap', 'security_alert', 'password_changed', 'new_login', 'product_announcement'
  )),
  entity_type text not null check (entity_type in ('drop', 'capsule', 'moment', 'comment', 'user', 'system')),
  entity_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  body text check (body is null or char_length(body) <= 500),
  is_read boolean not null default false,
  read_at timestamptz,
  is_archived boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_recipient_unread_idx on public.notifications (recipient_id) where not is_read and not is_archived;
create index if not exists notifications_recipient_archived_idx on public.notifications (recipient_id) where is_archived;

alter table public.notifications enable row level security;

-- Read/write posture: a recipient can see, (narrowly) update, and
-- delete their own rows; nobody — not even the recipient — can INSERT
-- one directly. Every notification is created by a SECURITY DEFINER
-- trigger function below, which bypasses RLS by running as the table
-- owner, the same discipline every other "only the system can create
-- this row" table in this app already follows.
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = recipient_id);

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
  on public.notifications for delete
  using (auth.uid() = recipient_id);

-- Two-layer design, same pattern as comments' enforce_comment_rules()
-- (Phase 10d): RLS above decides which ROWS a recipient can target at
-- all; this trigger decides which COLUMNS are actually allowed to
-- change on an UPDATE — only is_read/read_at/is_archived, ever, no
-- matter what a client sends.
create or replace function public.enforce_notification_update_rules()
returns trigger
language plpgsql
as $$
begin
  new.recipient_id = old.recipient_id;
  new.actor_id = old.actor_id;
  new.type = old.type;
  new.entity_type = old.entity_type;
  new.entity_id = old.entity_id;
  new.title = old.title;
  new.body = old.body;
  new.metadata = old.metadata;
  new.created_at = old.created_at;
  if new.is_read and not old.is_read then
    new.read_at = now();
  elsif not new.is_read then
    new.read_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_update_rules on public.notifications;
create trigger notifications_update_rules
  before update on public.notifications
  for each row execute function public.enforce_notification_update_rules();

-- ---------------------------------------------------------------------------
-- 4. create_notification() — the one place every trigger below funnels
--    through. Inserts the idempotent ledger row first; only creates the
--    actual inbox row if that insert wasn't a duplicate. Never notifies
--    someone about their own action, and never creates a row for a
--    recipient who has muted this category or blocked the actor.
-- ---------------------------------------------------------------------------
create or replace function public.create_notification(
  p_event_type text,
  p_actor_id uuid,
  p_recipient_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_preference_column text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows_inserted int;
  v_preference_enabled boolean := true;
begin
  if p_actor_id is not null and p_actor_id = p_recipient_id then
    return;
  end if;

  if p_actor_id is not null and exists (
    select 1 from user_blocks
    where (blocker_id = p_actor_id and blocked_id = p_recipient_id)
       or (blocker_id = p_recipient_id and blocked_id = p_actor_id)
  ) then
    return;
  end if;

  if p_preference_column is not null then
    execute format('select %I from notification_preferences where user_id = $1', p_preference_column)
      into v_preference_enabled
      using p_recipient_id;
    if v_preference_enabled is false then
      return;
    end if;
  end if;

  insert into notification_events (event_type, actor_id, recipient_id, entity_type, entity_id)
  values (p_event_type, p_actor_id, p_recipient_id, p_entity_type, p_entity_id)
  on conflict on constraint notification_events_natural_key do nothing;

  get diagnostics v_rows_inserted = row_count;
  if v_rows_inserted = 0 then
    return;
  end if;

  insert into notifications (recipient_id, actor_id, type, entity_type, entity_id, title, body, metadata)
  values (p_recipient_id, p_actor_id, p_type, p_entity_type, p_entity_id, p_title, p_body, p_metadata);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Follows — new follower / follow request / follow request accepted.
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
begin
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.follower_id;

  if tg_op = 'INSERT' and new.status = 'accepted' then
    perform create_notification('follow', new.follower_id, new.following_id, 'user', new.follower_id,
      'new_follower', v_actor_name || ' started following you.', null, '{}'::jsonb, 'new_followers');
  elsif tg_op = 'INSERT' and new.status = 'pending' then
    perform create_notification('follow_request', new.follower_id, new.following_id, 'user', new.follower_id,
      'follow_request', v_actor_name || ' requested to follow you.', null, '{}'::jsonb, 'follow_requests');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform create_notification('follow_accept', new.following_id, new.follower_id, 'user', new.following_id,
      'follow_accepted', v_actor_name || ' accepted your follow request.', null, '{}'::jsonb, 'new_followers');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_on_follow_trigger on public.follows;
create trigger notify_on_follow_trigger
  after insert or update on public.follows
  for each row execute function public.notify_on_follow();

-- ---------------------------------------------------------------------------
-- 6. Drop interests (Save to Unlock / Good Vibes / Can't Wait / Interested).
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_drop_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_actor_name text;
  v_type text;
  v_verb text;
begin
  select user_id into v_owner_id from posts where id = new.drop_id;
  if v_owner_id is null or v_owner_id = new.user_id then
    return new;
  end if;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.user_id;

  v_type := case new.interest_type
    when 'save_to_unlock' then 'drop_save_to_unlock'
    when 'good_vibes' then 'drop_good_vibes'
    when 'cant_wait' then 'drop_cant_wait'
    else 'drop_interested'
  end;
  v_verb := case new.interest_type
    when 'save_to_unlock' then ' saved your Drop to unlock later.'
    when 'good_vibes' then ' sent Good Vibes for your Drop.'
    when 'cant_wait' then ' can''t wait for your Drop to unlock.'
    else ' is interested in your Drop.'
  end;

  perform create_notification('drop_interest', new.user_id, v_owner_id, 'drop', new.drop_id,
    v_type, v_actor_name || v_verb, null, '{}'::jsonb, 'reactions');
  return new;
end;
$$;

drop trigger if exists notify_on_drop_interest_trigger on public.drop_interests;
create trigger notify_on_drop_interest_trigger
  after insert on public.drop_interests
  for each row execute function public.notify_on_drop_interest();

-- ---------------------------------------------------------------------------
-- 7. Drop unlocked-view, liked.
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_drop_unlock_view()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_actor_name text;
begin
  select user_id into v_owner_id from posts where id = new.drop_id;
  if v_owner_id is null or v_owner_id = new.user_id then
    return new;
  end if;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.user_id;
  perform create_notification('drop_unlock_view', new.user_id, v_owner_id, 'drop', new.drop_id,
    'drop_unlock_viewed', v_actor_name || ' unlocked your Drop.', null, '{}'::jsonb, 'reactions');
  return new;
end;
$$;

drop trigger if exists notify_on_drop_unlock_view_trigger on public.drop_unlock_views;
create trigger notify_on_drop_unlock_view_trigger
  after insert on public.drop_unlock_views
  for each row execute function public.notify_on_drop_unlock_view();

create or replace function public.notify_on_drop_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_actor_name text;
begin
  select user_id into v_owner_id from posts where id = new.post_id;
  if v_owner_id is null or v_owner_id = new.user_id then
    return new;
  end if;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.user_id;
  perform create_notification('drop_like', new.user_id, v_owner_id, 'drop', new.post_id,
    'drop_liked', v_actor_name || ' liked your unlocked Drop.', null, '{}'::jsonb, 'reactions');
  return new;
end;
$$;

drop trigger if exists notify_on_drop_like_trigger on public.likes;
create trigger notify_on_drop_like_trigger
  after insert on public.likes
  for each row execute function public.notify_on_drop_like();

-- ---------------------------------------------------------------------------
-- 8. Drop comments/replies + @mentions. Reflections (is_reflection)
--    never notify anyone but the reflection's own author already can
--    see it — this trigger simply never fires for those rows.
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_drop_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_visibility text;
  v_actor_name text;
  v_parent_author uuid;
  v_username text;
  v_mentioned_id uuid;
  v_can_view boolean;
begin
  -- Reflections never notify anyone, including the Drop's own owner —
  -- same reasoning as capsule_reflections below: reflections are
  -- private-by-construction (the SELECT policy on `comments` only ever
  -- returns is_reflection=true rows to their own author, never the
  -- Drop's owner), so a notification revealing "someone reflected"
  -- would leak the one piece of information that policy exists to
  -- hide. The brief's "Someone reflected on my unlocked Drop" line
  -- item is deliberately not implemented for this reason — see README
  -- Known limitations. 'drop_reflected' stays in the type CHECK
  -- constraint as a reserved value in case that privacy tradeoff is
  -- revisited later (e.g. an anonymized "someone reflected" with no
  -- actor_id, matching how this file already treats capsule
  -- reflections), not because anything creates one today.
  if new.is_reflection then
    return new;
  end if;

  select user_id, visibility into v_owner_id, v_visibility from posts where id = new.post_id;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.user_id;

  if new.parent_comment_id is not null then
    select user_id into v_parent_author from comments where id = new.parent_comment_id;
    if v_parent_author is not null then
      perform create_notification('drop_reply', new.user_id, v_parent_author, 'drop', new.post_id,
        'drop_replied', v_actor_name || ' replied to your comment.', left(new.content, 140), '{}'::jsonb, 'replies');
    end if;
  else
    perform create_notification('drop_comment', new.user_id, v_owner_id, 'drop', new.post_id,
      'drop_commented', v_actor_name || ' commented on your unlocked Drop.', left(new.content, 140), '{}'::jsonb, 'comments');
  end if;

  -- @mentions — same character class as the client's own linkify regex
  -- (CommentItem.tsx's MENTION_RE), only ever notifies a mention that
  -- resolves to a real account and who can actually view this Drop.
  for v_username in select (regexp_matches(new.content, '@([a-zA-Z0-9_]{3,20})\y', 'g'))[1] loop
    select id into v_mentioned_id from profiles where lower(username) = lower(v_username);
    if v_mentioned_id is null or v_mentioned_id = new.user_id then
      continue;
    end if;
    v_can_view := (
      v_owner_id = v_mentioned_id
      or (v_visibility = 'public')
      or (v_visibility = 'followers' and exists (
        select 1 from follows where follower_id = v_mentioned_id and following_id = v_owner_id and status = 'accepted'
      ))
    );
    if v_can_view then
      perform create_notification('mention', new.user_id, v_mentioned_id, 'drop', new.post_id,
        'mention', v_actor_name || ' mentioned you in a comment.', left(new.content, 140), '{}'::jsonb, 'mentions');
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists notify_on_drop_comment_trigger on public.comments;
create trigger notify_on_drop_comment_trigger
  after insert on public.comments
  for each row execute function public.notify_on_drop_comment();

-- ---------------------------------------------------------------------------
-- 9. Capsules — liked, unlocked (owner-facing, see Known limitations),
--    viewed, commented/replied + @mentions, reflections (never notify).
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_capsule_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_actor_name text;
begin
  select user_id into v_owner_id from capsules where id = new.capsule_id;
  if v_owner_id is null or v_owner_id = new.user_id then
    return new;
  end if;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.user_id;
  perform create_notification('capsule_like', new.user_id, v_owner_id, 'capsule', new.capsule_id,
    'capsule_liked', v_actor_name || ' liked your unlocked Capsule.', null, '{}'::jsonb, 'reactions');
  return new;
end;
$$;

drop trigger if exists notify_on_capsule_like_trigger on public.capsule_likes;
create trigger notify_on_capsule_like_trigger
  after insert on public.capsule_likes
  for each row execute function public.notify_on_capsule_like();

create or replace function public.notify_on_capsule_view()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_actor_name text;
begin
  select user_id into v_owner_id from capsules where id = new.capsule_id;
  if v_owner_id is null or v_owner_id = new.viewer_id then
    return new;
  end if;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.viewer_id;
  perform create_notification('capsule_view', new.viewer_id, v_owner_id, 'capsule', new.capsule_id,
    'capsule_viewed', v_actor_name || ' viewed your unlocked Capsule.', null, '{}'::jsonb, 'reactions');
  return new;
end;
$$;

drop trigger if exists notify_on_capsule_view_trigger on public.capsule_views;
create trigger notify_on_capsule_view_trigger
  after insert on public.capsule_views
  for each row execute function public.notify_on_capsule_view();

create or replace function public.notify_on_capsule_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_visibility text;
  v_actor_name text;
  v_parent_author uuid;
  v_username text;
  v_mentioned_id uuid;
  v_can_view boolean;
begin
  select user_id, visibility into v_owner_id, v_visibility from capsules where id = new.capsule_id;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.user_id;

  if new.parent_comment_id is not null then
    select user_id into v_parent_author from capsule_comments where id = new.parent_comment_id;
    if v_parent_author is not null then
      perform create_notification('capsule_reply', new.user_id, v_parent_author, 'capsule', new.capsule_id,
        'capsule_replied', v_actor_name || ' replied to your comment.', left(new.content, 140), '{}'::jsonb, 'replies');
    end if;
  else
    perform create_notification('capsule_comment', new.user_id, v_owner_id, 'capsule', new.capsule_id,
      'capsule_commented', v_actor_name || ' commented on your unlocked Capsule.', left(new.content, 140), '{}'::jsonb, 'comments');
  end if;

  for v_username in select (regexp_matches(new.content, '@([a-zA-Z0-9_]{3,20})\y', 'g'))[1] loop
    select id into v_mentioned_id from profiles where lower(username) = lower(v_username);
    if v_mentioned_id is null or v_mentioned_id = new.user_id then
      continue;
    end if;
    v_can_view := (
      v_owner_id = v_mentioned_id
      or (v_visibility = 'public')
      or (v_visibility = 'followers' and exists (
        select 1 from follows where follower_id = v_mentioned_id and following_id = v_owner_id and status = 'accepted'
      ))
    );
    if v_can_view then
      perform create_notification('mention', new.user_id, v_mentioned_id, 'capsule', new.capsule_id,
        'mention', v_actor_name || ' mentioned you in a comment.', left(new.content, 140), '{}'::jsonb, 'mentions');
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists notify_on_capsule_comment_trigger on public.capsule_comments;
create trigger notify_on_capsule_comment_trigger
  after insert on public.capsule_comments
  for each row execute function public.notify_on_capsule_comment();

-- capsule_reflections deliberately gets no trigger — private note-to-
-- self only, same as Drops' is_reflection comments; the owner never
-- even gets to read the content (see README Security notes), so they
-- categorically shouldn't be told it exists either. The brief's
-- "Someone reflected" line item for Capsules is intentionally not
-- implemented for this reason — see Known limitations.

-- "Your capsule unlocked" — capsules have no time-based trigger point
-- (see file header), so this piggybacks on unlock_capsule() itself: the
-- very first time ANYONE (owner included) calls it after the real
-- unlock_date has passed, the owner gets notified once. A new
-- owner_notified_at marker column is what makes this idempotent.
alter table public.capsules add column if not exists owner_notified_at timestamptz;

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
  v_owner_notified_at timestamptz;
  v_title text;
begin
  select user_id, visibility, unlock_date, owner_notified_at
    into v_owner_id, v_visibility, v_unlock_date, v_owner_notified_at
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

  if v_owner_notified_at is null then
    select title into v_title from capsules where id = p_capsule_id;
    update capsules set owner_notified_at = now() where id = p_capsule_id;
    perform create_notification('capsule_unlocked', null, v_owner_id, 'capsule', p_capsule_id,
      'capsule_unlocked', coalesce('Your capsule "' || v_title || '" unlocked.', 'Your capsule unlocked.'),
      null, '{}'::jsonb, 'unlock_reminders');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Moments — viewed, replied, reacted. Self-notification is already
--     impossible at the RLS layer for all three (m.user_id <>
--     auth.uid() is baked into their own INSERT policies), so no extra
--     guard is needed here the way drop_interests needed one.
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_moment_view()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_actor_name text;
begin
  select user_id into v_owner_id from moments where id = new.moment_id;
  if v_owner_id is null then
    return new;
  end if;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.viewer_id;
  perform create_notification('moment_view', new.viewer_id, v_owner_id, 'moment', new.moment_id,
    'moment_viewed', v_actor_name || ' viewed your Moment.', null, '{}'::jsonb, 'reactions');
  return new;
end;
$$;

drop trigger if exists notify_on_moment_view_trigger on public.moment_views;
create trigger notify_on_moment_view_trigger
  after insert on public.moment_views
  for each row execute function public.notify_on_moment_view();

create or replace function public.notify_on_moment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_actor_name text;
begin
  select user_id into v_owner_id from moments where id = new.moment_id;
  if v_owner_id is null then
    return new;
  end if;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.user_id;
  perform create_notification('moment_reply', new.user_id, v_owner_id, 'moment', new.moment_id,
    'moment_replied', v_actor_name || ' replied to your Moment.', left(new.content, 140), '{}'::jsonb, 'replies');
  return new;
end;
$$;

drop trigger if exists notify_on_moment_reply_trigger on public.moment_replies;
create trigger notify_on_moment_reply_trigger
  after insert on public.moment_replies
  for each row execute function public.notify_on_moment_reply();

create or replace function public.notify_on_moment_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_actor_name text;
begin
  select user_id into v_owner_id from moments where id = new.moment_id;
  if v_owner_id is null then
    return new;
  end if;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.user_id;
  perform create_notification('moment_reaction', new.user_id, v_owner_id, 'moment', new.moment_id,
    'moment_reacted', v_actor_name || ' reacted ' || new.emoji || ' to your Moment.', null, '{}'::jsonb, 'reactions');
  return new;
end;
$$;

drop trigger if exists notify_on_moment_reaction_trigger on public.moment_reactions;
create trigger notify_on_moment_reaction_trigger
  after insert or update on public.moment_reactions
  for each row execute function public.notify_on_moment_reaction();

-- ---------------------------------------------------------------------------
-- 11. New sign-in (Security). Fires once per real new browser tab/
--     login — recordSession() in useSettings.ts is already gated
--     client-side by a sessionStorage flag, so this isn't spammy.
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_new_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform create_notification('new_login', null, new.user_id, 'system', null,
    'new_login', 'New sign-in detected' || (case when new.device_label is not null then ' — ' || new.device_label else '' end) || '.',
    null, '{}'::jsonb, 'security_alerts');
  return new;
end;
$$;

drop trigger if exists notify_on_new_session_trigger on public.user_sessions;
create trigger notify_on_new_session_trigger
  after insert on public.user_sessions
  for each row execute function public.notify_on_new_session();

-- ---------------------------------------------------------------------------
-- 12. Password changed — no direct trigger point (auth.users is
--     Supabase-managed; a trigger there would touch schema this repo
--     doesn't own). Exposed as a narrow RPC the client calls right
--     after a successful password change (useSettings.ts's
--     changePassword() already re-verifies the current password before
--     calling supabase.auth.updateUser() — this just adds one more
--     call on success).
-- ---------------------------------------------------------------------------
create or replace function public.notify_password_changed()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform create_notification('password_changed', null, auth.uid(), 'system', null,
    'password_changed', 'Your password was changed.', null, '{}'::jsonb, 'security_alerts');
end;
$$;

grant execute on function public.notify_password_changed() to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Time-based generators — real, correct, callable, NOT scheduled.
--     See file header and README for the pg_cron caveat.
-- ---------------------------------------------------------------------------
create or replace function public.generate_unlock_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform create_notification('capsule_unlock_reminder', null, c.user_id, 'capsule', c.id,
    'capsule_unlock_reminder',
    coalesce('Your capsule "' || c.title || '" unlocks tomorrow.', 'A capsule unlocks tomorrow.'),
    null, '{}'::jsonb, 'unlock_reminders')
  from capsules c
  where c.unlock_date > now()
    and c.unlock_date <= now() + interval '24 hours'
    and c.hidden_at is null
    and c.moderation_status = 'active';
end;
$$;

create or replace function public.generate_weekly_recap()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user record;
  v_unlocked_count int;
begin
  for v_user in select id from profiles loop
    select count(*) into v_unlocked_count
    from memory_items_view
    where owner_id = v_user.id
      and status in ('unlocked', 'expired')
      and created_at > now() - interval '7 days';

    if v_unlocked_count > 0 then
      perform create_notification('weekly_recap', null, v_user.id, 'system', null,
        'weekly_recap', 'Your week in memories: ' || v_unlocked_count || ' new ' ||
        (case when v_unlocked_count = 1 then 'memory' else 'memories' end) || '.',
        null, jsonb_build_object('count', v_unlocked_count), 'weekly_recap');
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. Product announcements — admin-only broadcast, reusing the
--     is_admin column from Phase 10f. No admin UI ships in this phase
--     either (matching Phase 10f's own "architecture, no UI" posture)
--     — this is a real, callable, correctly-secured function with no
--     caller yet.
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_announcement(p_title text, p_body text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Only an admin can broadcast an announcement.';
  end if;

  insert into notifications (recipient_id, actor_id, type, entity_type, entity_id, title, body)
  select id, null, 'product_announcement', 'system', null, p_title, p_body
  from profiles pr
  join notification_preferences np on np.user_id = pr.id
  where np.product_updates;
end;
$$;

grant execute on function public.broadcast_announcement(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 15. Read side — get_notifications()/get_unread_notification_count().
--     SECURITY DEFINER because the notification list needs the actor's
--     username/display_name/avatar joined in, and profiles RLS only
--     ever lets a user read their own row directly (same reasoning as
--     every other cross-user read in this app). Both are hardcoded to
--     auth.uid() — never parameterized by an arbitrary user id.
-- ---------------------------------------------------------------------------
create or replace function public.get_notifications(p_filter text default 'all', p_limit int default 30, p_offset int default 0)
returns table (
  id uuid,
  actor_id uuid,
  actor_username text,
  actor_display_name text,
  actor_profile_photo_url text,
  type text,
  entity_type text,
  entity_id uuid,
  title text,
  body text,
  is_read boolean,
  is_archived boolean,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id, n.actor_id, pr.username, pr.display_name, pr.profile_photo_url,
    n.type, n.entity_type, n.entity_id, n.title, n.body, n.is_read, n.is_archived, n.metadata, n.created_at
  from notifications n
  left join profiles pr on pr.id = n.actor_id
  where n.recipient_id = auth.uid()
    and (
      p_filter = 'all' and not n.is_archived
      or p_filter = 'unread' and not n.is_read and not n.is_archived
      or p_filter = 'read' and n.is_read and not n.is_archived
      or p_filter = 'archived' and n.is_archived
    )
  order by n.created_at desc
  limit p_limit offset p_offset;
$$;

grant execute on function public.get_notifications(text, int, int) to authenticated;

create or replace function public.get_unread_notification_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from notifications where recipient_id = auth.uid() and not is_read and not is_archived;
$$;

grant execute on function public.get_unread_notification_count() to authenticated;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update notifications set is_read = true, read_at = now() where recipient_id = auth.uid() and not is_read and not is_archived;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;
