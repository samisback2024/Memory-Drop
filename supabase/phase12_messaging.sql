-- Memory Drop — Phase 12: Memory Chat (Direct Messaging).
-- Run once, after supabase/phase11_notifications.sql, in the Supabase SQL
-- editor. Safe to re-run — every statement is idempotent, except the
-- CREATE FUNCTION statements whose RETURNS TABLE shape is new (those are
-- all first-time CREATE OR REPLACE, no shape changes to an existing
-- function, so no DROP is needed anywhere in this file).
--
-- One-to-one conversations only — no group chat. `conversation_members`
-- is still a join table (not a user_a/user_b pair on `conversations`)
-- since that's the natural minimal shape even for 1:1, but a trigger
-- below enforces exactly two rows per conversation.
--
-- Scope decisions (see README Known limitations for the full list):
-- no new npm packages anywhere in this phase (matching this project's
-- own repeated precedent). GIFs are ordinary image attachments (no
-- Tenor/Giphy key available). Stickers are a small first-party curated
-- emoji set. Location sends a static link-out card, not an embedded map.
-- The message list is windowed/paginated, not virtualized with a
-- library. "Unsend" and "Delete for everyone" are the same underlying
-- capability (`is_unsent`), not two mechanisms. "Push notifications"
-- means Phase 11's existing in-app Activity Center, not OS push.
--
-- Security posture, reused throughout rather than reinvented:
-- `is_blocked_either_way()` (Phase 4) gates every cross-user read/write;
-- the SECURITY DEFINER cross-user-read template (get_profile_by_username,
-- get_notifications) backs every RPC that joins `profiles`; the two-layer
-- RLS-decides-rows / trigger-decides-columns pattern
-- (enforce_comment_rules, Phase 10d) backs message editing/unsending/
-- pinning; the pin-cap trigger pattern (enforce_pin_limit, Phase 10b)
-- backs the 3-pinned-messages-per-conversation cap; the idempotent-ledger
-- + funnel-function notification pattern (create_notification, Phase 11)
-- is reused as-is for every new notification type this phase adds.

-- ---------------------------------------------------------------------------
-- 0. user_settings / notification_preferences — widen with the columns
--    this phase needs. Reuses the existing 'reactions' preference column
--    for message-reaction notifications rather than adding a redundant
--    one; 'messages' and 'message_requests' are genuinely new categories.
-- ---------------------------------------------------------------------------
alter table public.user_settings add column if not exists messaging_privacy text not null default 'everyone' check (messaging_privacy in ('everyone', 'followers', 'mutual_followers', 'nobody'));
alter table public.user_settings add column if not exists allow_message_requests boolean not null default true;

alter table public.notification_preferences add column if not exists messages boolean not null default true;
alter table public.notification_preferences add column if not exists message_requests boolean not null default true;

-- ---------------------------------------------------------------------------
-- 1. conversations — one row per 1:1 thread. request_status drives the
--    Message Requests flow: 'none' (privacy allowed it outright),
--    'pending' (needs the recipient's Accept), 'accepted', or 'declined'
--    (hidden from both sides' normal lists, not just the requester's).
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text,
  last_message_sender_id uuid references public.profiles(id) on delete set null,
  request_status text not null default 'none' check (request_status in ('none', 'pending', 'accepted', 'declined')),
  request_initiator_id uuid references public.profiles(id) on delete set null
);

alter table public.conversations enable row level security;
-- SELECT policy is defined in section 3, below, once conversation_members
-- exists (this policy's USING clause needs to query it). No INSERT/
-- UPDATE/DELETE policy for any client role — every write path
-- (get_or_create_direct_conversation, send_message, accept/decline) is
-- SECURITY DEFINER, same "only the system can create/change this row"
-- discipline as `notifications`.

-- ---------------------------------------------------------------------------
-- 2. messages
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('text', 'image', 'video', 'audio', 'gif', 'sticker', 'location', 'file')),
  content text,
  metadata jsonb not null default '{}'::jsonb,
  reply_to_message_id uuid references public.messages(id) on delete set null,
  forwarded_from_message_id uuid references public.messages(id) on delete set null,
  is_edited boolean not null default false,
  edited_at timestamptz,
  is_unsent boolean not null default false,
  unsent_at timestamptz,
  is_pinned boolean not null default false,
  pinned_by uuid references public.profiles(id) on delete set null,
  pinned_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_text_content_check check (type <> 'text' or content is not null or is_unsent)
);

create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_pinned_idx on public.messages (conversation_id) where is_pinned;

alter table public.messages enable row level security;
-- SELECT/UPDATE policies are defined in section 3, below, once
-- conversation_members exists (same deferred-policy reasoning as
-- `conversations`' own SELECT policy above — their USING clauses need
-- to query a table that doesn't exist yet at this point in the file).

-- No INSERT policy — send_message() (below) is the only path, so it can
-- centrally enforce blocking, request-state, and the preview/notification
-- side effects in one place rather than duplicating those checks in RLS.
-- No DELETE policy — a hard delete never happens; "delete for me" is
-- message_deletes, "delete for everyone"/"unsend" is the is_unsent flag.

-- Two-layer design, same pattern as enforce_comment_rules() (Phase 10d):
-- RLS above decides which ROWS a member can target; this trigger decides
-- which COLUMNS are actually allowed to change, by whom.
create or replace function public.enforce_message_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.content is distinct from old.content then
    if auth.uid() <> old.sender_id then
      raise exception 'Only the sender can edit a message.';
    end if;
    if old.type <> 'text' then
      raise exception 'Only text messages can be edited.';
    end if;
    if old.is_unsent then
      raise exception 'Cannot edit an unsent message.';
    end if;
    new.is_edited = true;
    new.edited_at = now();
  end if;

  if new.is_unsent is distinct from old.is_unsent then
    if auth.uid() <> old.sender_id then
      raise exception 'Only the sender can unsend a message.';
    end if;
    if new.is_unsent then
      new.unsent_at = now();
      new.content = null;
    else
      new.unsent_at = old.unsent_at;
      new.content = old.content;
    end if;
  end if;

  if new.is_pinned is distinct from old.is_pinned then
    if not exists (select 1 from public.conversation_members where conversation_id = old.conversation_id and user_id = auth.uid()) then
      raise exception 'Only a conversation member can pin a message.';
    end if;
    if new.is_pinned then
      new.pinned_by = auth.uid();
      new.pinned_at = now();
    else
      new.pinned_by = null;
      new.pinned_at = null;
    end if;
  end if;

  new.conversation_id = old.conversation_id;
  new.sender_id = old.sender_id;
  new.type = old.type;
  new.metadata = old.metadata;
  new.reply_to_message_id = old.reply_to_message_id;
  new.forwarded_from_message_id = old.forwarded_from_message_id;
  new.created_at = old.created_at;
  return new;
end;
$$;

drop trigger if exists messages_rules on public.messages;
create trigger messages_rules
  before update on public.messages
  for each row execute function public.enforce_message_rules();

-- Capped at 3 pinned messages per conversation, same pattern (and same
-- number) as pinned_items' enforce_pin_limit() (Phase 10b).
create or replace function public.enforce_message_pin_limit()
returns trigger
language plpgsql
as $$
begin
  if new.is_pinned and not old.is_pinned then
    if (select count(*) from public.messages where conversation_id = new.conversation_id and is_pinned) >= 3 then
      raise exception 'You can only pin up to 3 messages per conversation — unpin one first.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_pin_limit on public.messages;
create trigger messages_pin_limit
  before update on public.messages
  for each row execute function public.enforce_message_pin_limit();

-- ---------------------------------------------------------------------------
-- 3. conversation_members — per-member state (pin/mute/archive/read
--    position/whether the thread is currently open on screen). A member
--    only ever reads or writes their OWN row directly; the other
--    member's row is only ever surfaced through a SECURITY DEFINER RPC,
--    same discipline as everywhere else cross-user data is read.
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  is_pinned boolean not null default false,
  is_muted boolean not null default false,
  is_archived boolean not null default false,
  is_active boolean not null default false,
  last_read_message_id uuid references public.messages(id) on delete set null,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_idx on public.conversation_members (user_id);

alter table public.conversation_members enable row level security;

drop policy if exists "Users can view their own conversation membership" on public.conversation_members;
create policy "Users can view their own conversation membership"
  on public.conversation_members for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own conversation membership" on public.conversation_members;
create policy "Users can update their own conversation membership"
  on public.conversation_members for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No INSERT/DELETE policy — only get_or_create_direct_conversation()
-- creates rows.

create or replace function public.enforce_conversation_member_rules()
returns trigger
language plpgsql
as $$
begin
  new.conversation_id = old.conversation_id;
  new.user_id = old.user_id;
  new.joined_at = old.joined_at;
  return new;
end;
$$;

drop trigger if exists conversation_members_rules on public.conversation_members;
create trigger conversation_members_rules
  before update on public.conversation_members
  for each row execute function public.enforce_conversation_member_rules();

-- Defense in depth — get_or_create_direct_conversation() always inserts
-- exactly two rows and is the only path that can, but this makes the
-- "one-to-one only" constraint a real database guarantee, not just a
-- convention every caller happens to follow.
create or replace function public.enforce_two_member_conversation()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.conversation_members where conversation_id = new.conversation_id) > 2 then
    raise exception 'Conversations support exactly two members in this phase.';
  end if;
  return new;
end;
$$;

drop trigger if exists conversation_members_cap on public.conversation_members;
create trigger conversation_members_cap
  after insert on public.conversation_members
  for each row execute function public.enforce_two_member_conversation();

-- Deferred from section 1 — needs conversation_members to exist.
drop policy if exists "Members can view their conversations" on public.conversations;
create policy "Members can view their conversations"
  on public.conversations for select
  using (exists (select 1 from public.conversation_members cm where cm.conversation_id = conversations.id and cm.user_id = auth.uid()));

-- Deferred from section 2 — same reason.
drop policy if exists "Conversation members can view messages" on public.messages;
create policy "Conversation members can view messages"
  on public.messages for select
  using (exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()));

drop policy if exists "Conversation members can update messages" on public.messages;
create policy "Conversation members can update messages"
  on public.messages for update
  using (exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()))
  with check (true);

-- ---------------------------------------------------------------------------
-- 4. attachments
-- ---------------------------------------------------------------------------
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  bucket text not null default 'chat-media',
  storage_path text not null,
  url text not null,
  mime_type text,
  size_bytes bigint,
  width int,
  height int,
  duration_seconds numeric,
  waveform jsonb,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

create index if not exists attachments_message_idx on public.attachments (message_id);

alter table public.attachments enable row level security;

drop policy if exists "Conversation members can view attachments" on public.attachments;
create policy "Conversation members can view attachments"
  on public.attachments for select
  using (exists (
    select 1 from public.messages m join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = attachments.message_id and cm.user_id = auth.uid()
  ));

-- No INSERT policy — created only as part of send_message()'s own insert.

-- ---------------------------------------------------------------------------
-- 5. message_reads — delivery + read receipts, one row per (message,
--    recipient). delivered_at and read_at are two separate timestamps on
--    purpose (Sent -> Delivered -> Seen, three real states), both set
--    only via SECURITY DEFINER RPCs below, never a direct client write.
-- ---------------------------------------------------------------------------
create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);

alter table public.message_reads enable row level security;

drop policy if exists "Conversation members can view read receipts" on public.message_reads;
create policy "Conversation members can view read receipts"
  on public.message_reads for select
  using (exists (
    select 1 from public.messages m join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = message_reads.message_id and cm.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- 6. message_reactions — same model as comment_reactions (Phase 10d):
--    one active emoji per user per message, swap via UPDATE, remove via
--    DELETE.
-- ---------------------------------------------------------------------------
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now()
);

create unique index if not exists message_reactions_message_user_idx on public.message_reactions (message_id, user_id);

alter table public.message_reactions enable row level security;

drop policy if exists "Conversation members can view message reactions" on public.message_reactions;
create policy "Conversation members can view message reactions"
  on public.message_reactions for select
  using (exists (
    select 1 from public.messages m join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = message_reactions.message_id and cm.user_id = auth.uid()
  ));

drop policy if exists "Conversation members can react to a message" on public.message_reactions;
create policy "Conversation members can react to a message"
  on public.message_reactions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.messages m join public.conversation_members cm on cm.conversation_id = m.conversation_id
      where m.id = message_reactions.message_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Users can change their own message reaction" on public.message_reactions;
create policy "Users can change their own message reaction"
  on public.message_reactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own message reaction" on public.message_reactions;
create policy "Users can remove their own message reaction"
  on public.message_reactions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. message_deletes — "delete for me," own-rows-only, filters
--    get_messages()/get_conversation_media() per caller. Never affects
--    what the other member sees, same "personal, invisible to anyone
--    else" posture as `hidden_posts` (Phase 4).
-- ---------------------------------------------------------------------------
create table if not exists public.message_deletes (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  deleted_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_deletes enable row level security;

drop policy if exists "Users can view their own message deletes" on public.message_deletes;
create policy "Users can view their own message deletes"
  on public.message_deletes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can delete-for-me a visible message" on public.message_deletes;
create policy "Users can delete-for-me a visible message"
  on public.message_deletes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.messages m join public.conversation_members cm on cm.conversation_id = m.conversation_id
      where m.id = message_deletes.message_id and cm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 8. message_stars — personal bookmark, own-rows-only, unlimited (unlike
--    pins, which are shared-per-conversation and capped).
-- ---------------------------------------------------------------------------
create table if not exists public.message_stars (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  starred_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_stars enable row level security;

drop policy if exists "Users can view their own starred messages" on public.message_stars;
create policy "Users can view their own starred messages"
  on public.message_stars for select
  using (auth.uid() = user_id);

drop policy if exists "Users can star a visible message" on public.message_stars;
create policy "Users can star a visible message"
  on public.message_stars for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.messages m join public.conversation_members cm on cm.conversation_id = m.conversation_id
      where m.id = message_stars.message_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Users can unstar their own star" on public.message_stars;
create policy "Users can unstar their own star"
  on public.message_stars for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 9. typing_status — one row per (conversation, user). Upserted only via
--    set_typing() below (throttled client-side); readers treat anything
--    older than 6 seconds as stale rather than trusting is_typing alone,
--    so a client that vanished mid-type never shows a stuck indicator.
-- ---------------------------------------------------------------------------
create table if not exists public.typing_status (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.typing_status enable row level security;

drop policy if exists "Conversation members can view typing status" on public.typing_status;
create policy "Conversation members can view typing status"
  on public.typing_status for select
  using (exists (select 1 from public.conversation_members cm where cm.conversation_id = typing_status.conversation_id and cm.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 10. presence_status — one row per user, kept in sync by a Presence
--     channel joined once at the app shell level (see README). Blocked
--     users can't see each other's presence, same rule as everywhere
--     else two users' visibility of each other is gated.
-- ---------------------------------------------------------------------------
create table if not exists public.presence_status (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_online boolean not null default false,
  last_seen_at timestamptz not null default now()
);

alter table public.presence_status enable row level security;

drop policy if exists "Presence visible to non-blocked users" on public.presence_status;
create policy "Presence visible to non-blocked users"
  on public.presence_status for select
  using (auth.uid() = user_id or not is_blocked_either_way(user_id));

-- No INSERT/UPDATE policy — only upsert_presence() below.

create or replace function public.upsert_presence(p_is_online boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.presence_status (user_id, is_online, last_seen_at)
  values (auth.uid(), p_is_online, now())
  on conflict (user_id) do update set is_online = excluded.is_online, last_seen_at = now();
end;
$$;

grant execute on function public.upsert_presence(boolean) to authenticated;

create or replace function public.get_presence(p_user_ids uuid[])
returns table (user_id uuid, is_online boolean, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select ps.user_id, ps.is_online, ps.last_seen_at
  from public.presence_status ps
  where ps.user_id = any(p_user_ids) and not is_blocked_either_way(ps.user_id);
$$;

grant execute on function public.get_presence(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Storage — chat-media bucket. Same posture as every other bucket in
--     this app: public-read + unguessable path + app-level gating (a
--     message's attachment URL is only ever handed out by get_messages()/
--     get_conversation_media() to conversation members), write policy
--     keyed off auth.uid() matching the first path segment.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-media', 'chat-media', true, 52428800)
on conflict (id) do nothing;

drop policy if exists "Chat media is publicly accessible" on storage.objects;
create policy "Chat media is publicly accessible"
  on storage.objects for select
  using (bucket_id = 'chat-media');

drop policy if exists "Users can upload their own chat media" on storage.objects;
create policy "Users can upload their own chat media"
  on storage.objects for insert
  with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own chat media" on storage.objects;
create policy "Users can delete their own chat media"
  on storage.objects for delete
  using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 12. is_mutual_follow() — new predicate. Only "mutual friends" (common
--     followees, Phase 3's get_mutual_friends) existed before; this is
--     genuinely "A follows B and B follows A."
-- ---------------------------------------------------------------------------
create or replace function public.is_mutual_follow(p_other_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from follows where follower_id = auth.uid() and following_id = p_other_id and status = 'accepted')
    and exists (select 1 from follows where follower_id = p_other_id and following_id = auth.uid() and status = 'accepted');
$$;

grant execute on function public.is_mutual_follow(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. can_message() — the privacy-tier gate. 'followers' means "people
--     who follow me can message me," same direction can_view_drop's
--     'followers' tier already uses for "can view."
-- ---------------------------------------------------------------------------
create or replace function public.can_message(p_recipient_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_privacy text;
  v_allow_requests boolean;
begin
  if p_recipient_id = auth.uid() then
    return 'blocked';
  end if;
  if is_blocked_either_way(p_recipient_id) then
    return 'blocked';
  end if;

  select coalesce(messaging_privacy, 'everyone'), coalesce(allow_message_requests, true)
    into v_privacy, v_allow_requests
    from user_settings where user_id = p_recipient_id;
  v_privacy := coalesce(v_privacy, 'everyone');
  v_allow_requests := coalesce(v_allow_requests, true);

  if v_privacy = 'everyone' then
    return 'allowed';
  end if;
  if v_privacy = 'followers' and exists (
    select 1 from follows where follower_id = auth.uid() and following_id = p_recipient_id and status = 'accepted'
  ) then
    return 'allowed';
  end if;
  if v_privacy = 'mutual_followers' and is_mutual_follow(p_recipient_id) then
    return 'allowed';
  end if;

  return case when v_allow_requests then 'request' else 'blocked' end;
end;
$$;

grant execute on function public.can_message(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 14. get_or_create_direct_conversation()
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_direct_conversation(p_other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_gate text;
  v_actor_name text;
begin
  if p_other_id = auth.uid() then
    raise exception 'You cannot message yourself.';
  end if;

  select cm1.conversation_id into v_conversation_id
  from conversation_members cm1
  join conversation_members cm2 on cm2.conversation_id = cm1.conversation_id and cm2.user_id = p_other_id
  where cm1.user_id = auth.uid()
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  v_gate := can_message(p_other_id);
  if v_gate = 'blocked' then
    raise exception 'You cannot message this user.';
  end if;

  insert into conversations (request_status, request_initiator_id)
  values (case when v_gate = 'request' then 'pending' else 'none' end, auth.uid())
  returning id into v_conversation_id;

  insert into conversation_members (conversation_id, user_id)
  values (v_conversation_id, auth.uid()), (v_conversation_id, p_other_id);

  if v_gate = 'request' then
    select coalesce(display_name, username) into v_actor_name from profiles where id = auth.uid();
    perform create_notification('message_request', auth.uid(), p_other_id, 'conversation', v_conversation_id,
      'message_request', v_actor_name || ' wants to send you a message.', null, '{}'::jsonb, 'message_requests');
  end if;

  return v_conversation_id;
end;
$$;

grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 15. send_message() — the one path that can create a message.
--     Attachments are passed as a jsonb array (built client-side after
--     uploading to storage) and inserted in the same call, so a message
--     and its media are never created as two separate round trips a
--     client could fail partway through. Notifies the other member
--     unless they currently have this thread open (is_active).
-- ---------------------------------------------------------------------------
create or replace function public.send_message(
  p_conversation_id uuid,
  p_type text,
  p_content text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_reply_to_message_id uuid default null,
  p_forwarded_from_message_id uuid default null,
  p_attachments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
  v_other_id uuid;
  v_other_active boolean;
  v_preview text;
  v_att jsonb;
  v_actor_name text;
begin
  if not exists (select 1 from conversation_members where conversation_id = p_conversation_id and user_id = auth.uid()) then
    raise exception 'You are not a member of this conversation.';
  end if;

  select user_id, is_active into v_other_id, v_other_active
    from conversation_members where conversation_id = p_conversation_id and user_id <> auth.uid();

  if v_other_id is not null and is_blocked_either_way(v_other_id) then
    raise exception 'You cannot message this user.';
  end if;

  if exists (select 1 from conversations where id = p_conversation_id and request_status = 'declined') then
    raise exception 'This conversation is no longer active.';
  end if;

  insert into messages (conversation_id, sender_id, type, content, metadata, reply_to_message_id, forwarded_from_message_id)
  values (p_conversation_id, auth.uid(), p_type, p_content, coalesce(p_metadata, '{}'::jsonb), p_reply_to_message_id, p_forwarded_from_message_id)
  returning id into v_message_id;

  for v_att in select * from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb)) loop
    insert into attachments (message_id, bucket, storage_path, url, mime_type, size_bytes, width, height, duration_seconds, waveform, thumbnail_url)
    values (
      v_message_id,
      coalesce(v_att->>'bucket', 'chat-media'), v_att->>'storage_path', v_att->>'url', v_att->>'mime_type',
      nullif(v_att->>'size_bytes', '')::bigint, nullif(v_att->>'width', '')::int, nullif(v_att->>'height', '')::int,
      nullif(v_att->>'duration_seconds', '')::numeric, v_att->'waveform', v_att->>'thumbnail_url'
    );
  end loop;

  v_preview := case p_type
    when 'text' then left(coalesce(p_content, ''), 120)
    when 'image' then '📷 Photo'
    when 'video' then '🎥 Video'
    when 'audio' then '🎤 Voice message'
    when 'gif' then 'GIF'
    when 'sticker' then coalesce(p_metadata->>'emoji', 'Sticker')
    when 'location' then '📍 Location'
    else '📎 File'
  end;

  -- If the recipient of a pending request replies, that's a real accept
  -- (same convention as Instagram) — no separate "you must tap Accept
  -- first" friction for the common case of just answering.
  update conversations set
    last_message_at = now(),
    last_message_preview = v_preview,
    last_message_sender_id = auth.uid(),
    request_status = case when request_status = 'pending' and request_initiator_id <> auth.uid() then 'accepted' else request_status end
  where id = p_conversation_id;

  if v_other_id is not null and not coalesce(v_other_active, false) then
    select coalesce(display_name, username) into v_actor_name from profiles where id = auth.uid();
    perform create_notification('message', auth.uid(), v_other_id, 'conversation', p_conversation_id,
      'new_message',
      v_actor_name || (case when p_reply_to_message_id is not null then ' replied.' else ' sent you a message.' end),
      v_preview, '{}'::jsonb, 'messages');
  end if;

  return v_message_id;
end;
$$;

grant execute on function public.send_message(uuid, text, text, jsonb, uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 16. get_conversations() — recent/unread/pinned/muted/archived. Pending
--     requests only ever appear here to the person who SENT them (so
--     they can see their own outgoing request); the recipient sees it
--     via get_message_requests() instead, never both places at once.
-- ---------------------------------------------------------------------------
create or replace function public.get_conversations(p_filter text default 'all')
returns table (
  id uuid,
  other_user_id uuid, other_username text, other_display_name text, other_profile_photo_url text,
  last_message_at timestamptz, last_message_preview text, last_message_sender_id uuid,
  is_pinned boolean, is_muted boolean, is_archived boolean,
  unread_count int,
  request_status text, request_initiator_id uuid,
  is_online boolean, last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, pr.id, pr.username, pr.display_name, pr.profile_photo_url,
    c.last_message_at, c.last_message_preview, c.last_message_sender_id,
    cm.is_pinned, cm.is_muted, cm.is_archived,
    (select count(*)::int from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid()
      and (cm.last_read_at is null or m.created_at > cm.last_read_at)),
    c.request_status, c.request_initiator_id,
    coalesce(ps.is_online, false), ps.last_seen_at
  from conversation_members cm
  join conversations c on c.id = cm.conversation_id
  join conversation_members other_cm on other_cm.conversation_id = c.id and other_cm.user_id <> cm.user_id
  join profiles pr on pr.id = other_cm.user_id
  left join presence_status ps on ps.user_id = pr.id
  where cm.user_id = auth.uid()
    and not is_blocked_either_way(pr.id)
    and c.last_message_at is not null
    and (c.request_status in ('none', 'accepted') or (c.request_status = 'pending' and c.request_initiator_id = auth.uid()))
    and (
      p_filter = 'all' and not cm.is_archived
      or p_filter = 'unread' and not cm.is_archived and exists (
        select 1 from messages m2 where m2.conversation_id = c.id and m2.sender_id <> auth.uid()
          and (cm.last_read_at is null or m2.created_at > cm.last_read_at)
      )
      or p_filter = 'pinned' and cm.is_pinned and not cm.is_archived
      or p_filter = 'muted' and cm.is_muted and not cm.is_archived
      or p_filter = 'archived' and cm.is_archived
    )
  order by cm.is_pinned desc, c.last_message_at desc nulls last;
$$;

grant execute on function public.get_conversations(text) to authenticated;

-- get_conversation_header() — get_conversations() deliberately excludes
-- conversations with no message yet (last_message_at is null), so a
-- freshly created-but-empty conversation (e.g. right after
-- NewConversationModal calls get_or_create_direct_conversation) has no
-- other way to resolve who the other member even is for the chat
-- screen's header. This is that one other way — a single-row lookup by
-- conversation id, no filter, no list semantics.
create or replace function public.get_conversation_header(p_conversation_id uuid)
returns table (
  id uuid, other_user_id uuid, other_username text, other_display_name text, other_profile_photo_url text,
  request_status text, request_initiator_id uuid, is_online boolean, last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, pr.id, pr.username, pr.display_name, pr.profile_photo_url,
    c.request_status, c.request_initiator_id, coalesce(ps.is_online, false), ps.last_seen_at
  from conversation_members cm
  join conversations c on c.id = cm.conversation_id
  join conversation_members other_cm on other_cm.conversation_id = c.id and other_cm.user_id <> cm.user_id
  join profiles pr on pr.id = other_cm.user_id
  left join presence_status ps on ps.user_id = pr.id
  where cm.user_id = auth.uid() and c.id = p_conversation_id;
$$;

grant execute on function public.get_conversation_header(uuid) to authenticated;

create or replace function public.get_message_requests()
returns table (
  id uuid, other_user_id uuid, other_username text, other_display_name text, other_profile_photo_url text,
  last_message_preview text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, pr.id, pr.username, pr.display_name, pr.profile_photo_url, c.last_message_preview, c.last_message_at
  from conversation_members cm
  join conversations c on c.id = cm.conversation_id
  join conversation_members other_cm on other_cm.conversation_id = c.id and other_cm.user_id <> auth.uid()
  join profiles pr on pr.id = other_cm.user_id
  where cm.user_id = auth.uid()
    and c.request_status = 'pending'
    and c.request_initiator_id <> auth.uid()
    and not is_blocked_either_way(pr.id)
  order by c.last_message_at desc nulls last;
$$;

grant execute on function public.get_message_requests() to authenticated;

create or replace function public.accept_message_request(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations set request_status = 'accepted'
  where id = p_conversation_id
    and request_status = 'pending'
    and request_initiator_id <> auth.uid()
    and exists (select 1 from conversation_members where conversation_id = p_conversation_id and user_id = auth.uid());
end;
$$;

grant execute on function public.accept_message_request(uuid) to authenticated;

-- Declining and "Delete" (from the Message Requests list) are the same
-- action — same consolidation reasoning as Unsend/Delete-for-everyone.
-- Either side of the conversation can call this (the sender can also
-- withdraw their own pending request this way).
create or replace function public.decline_message_request(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations set request_status = 'declined'
  where id = p_conversation_id
    and exists (select 1 from conversation_members where conversation_id = p_conversation_id and user_id = auth.uid());
end;
$$;

grant execute on function public.decline_message_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 17. get_messages() — upward pagination (p_before_message_id cursor),
--     newest-first (client reverses for display). Excludes the caller's
--     own message_deletes rows; nulls content/metadata for unsent
--     messages, same "nulled server-side, for everyone" discipline as
--     locked Drops.
-- ---------------------------------------------------------------------------
create or replace function public.get_messages(p_conversation_id uuid, p_before_message_id uuid default null, p_limit int default 50)
returns table (
  id uuid, conversation_id uuid, sender_id uuid,
  sender_username text, sender_display_name text, sender_profile_photo_url text,
  type text, content text, metadata jsonb,
  reply_to_message_id uuid, reply_to_type text, reply_to_content text, reply_to_sender_name text,
  forwarded_from_message_id uuid,
  is_edited boolean, edited_at timestamptz,
  is_unsent boolean,
  is_pinned boolean, pinned_by uuid, pinned_at timestamptz,
  created_at timestamptz,
  attachments jsonb,
  reactions jsonb,
  is_starred_by_me boolean,
  delivered_at timestamptz,
  read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_before_created_at timestamptz;
  v_other_id uuid;
begin
  if not exists (select 1 from conversation_members where conversation_id = p_conversation_id and user_id = auth.uid()) then
    return;
  end if;

  select user_id into v_other_id from conversation_members where conversation_id = p_conversation_id and user_id <> auth.uid();

  if p_before_message_id is not null then
    select created_at into v_before_created_at from messages where id = p_before_message_id;
  end if;

  return query
    select
      m.id, m.conversation_id, m.sender_id,
      pr.username, pr.display_name, pr.profile_photo_url,
      m.type,
      case when m.is_unsent then null else m.content end,
      case when m.is_unsent then '{}'::jsonb else m.metadata end,
      m.reply_to_message_id, rm.type,
      case when rm.is_unsent then null else left(coalesce(rm.content, ''), 140) end,
      rp.display_name,
      m.forwarded_from_message_id,
      m.is_edited, m.edited_at,
      m.is_unsent,
      m.is_pinned, m.pinned_by, m.pinned_at,
      m.created_at,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id, 'bucket', a.bucket, 'url', a.url, 'mime_type', a.mime_type,
          'size_bytes', a.size_bytes, 'width', a.width, 'height', a.height,
          'duration_seconds', a.duration_seconds, 'waveform', a.waveform, 'thumbnail_url', a.thumbnail_url
        )) from attachments a where a.message_id = m.id and not m.is_unsent
      ), '[]'::jsonb),
      coalesce((
        select jsonb_agg(jsonb_build_object('emoji', mr.emoji, 'user_id', mr.user_id))
        from message_reactions mr where mr.message_id = m.id
      ), '[]'::jsonb),
      exists (select 1 from message_stars ms where ms.message_id = m.id and ms.user_id = auth.uid()),
      (select mrd.delivered_at from message_reads mrd where mrd.message_id = m.id and mrd.user_id = v_other_id),
      (select mrd.read_at from message_reads mrd where mrd.message_id = m.id and mrd.user_id = v_other_id)
    from messages m
    join profiles pr on pr.id = m.sender_id
    left join messages rm on rm.id = m.reply_to_message_id
    left join profiles rp on rp.id = rm.sender_id
    where m.conversation_id = p_conversation_id
      and not exists (select 1 from message_deletes md where md.message_id = m.id and md.user_id = auth.uid())
      and (p_before_message_id is null or m.created_at < v_before_created_at)
    order by m.created_at desc
    limit p_limit;
end;
$$;

grant execute on function public.get_messages(uuid, uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 18. mark_messages_delivered() / mark_conversation_read() /
--     set_typing() / set_conversation_active()
-- ---------------------------------------------------------------------------
create or replace function public.mark_messages_delivered(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into message_reads (message_id, user_id, delivered_at)
  select m.id, auth.uid(), now()
  from messages m
  where m.conversation_id = p_conversation_id and m.sender_id <> auth.uid()
  on conflict (message_id, user_id) do update set delivered_at = coalesce(message_reads.delivered_at, excluded.delivered_at);
end;
$$;

grant execute on function public.mark_messages_delivered(uuid) to authenticated;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into message_reads (message_id, user_id, delivered_at, read_at)
  select m.id, auth.uid(), now(), now()
  from messages m
  where m.conversation_id = p_conversation_id and m.sender_id <> auth.uid()
  on conflict (message_id, user_id) do update set
    delivered_at = coalesce(message_reads.delivered_at, now()),
    read_at = now();

  update conversation_members
  set last_read_message_id = (select id from messages where conversation_id = p_conversation_id order by created_at desc limit 1),
      last_read_at = now()
  where conversation_id = p_conversation_id and user_id = auth.uid();
end;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

create or replace function public.set_typing(p_conversation_id uuid, p_is_typing boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from conversation_members where conversation_id = p_conversation_id and user_id = auth.uid()) then
    return;
  end if;
  insert into typing_status (conversation_id, user_id, is_typing, updated_at)
  values (p_conversation_id, auth.uid(), p_is_typing, now())
  on conflict (conversation_id, user_id) do update set is_typing = excluded.is_typing, updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.set_typing(uuid, boolean) to authenticated;

-- is_active suppresses the new-message notification while the recipient
-- has this thread open on screen (see send_message()). Best-effort — a
-- crashed tab can leave it stuck true; see README Known limitations.
create or replace function public.set_conversation_active(p_conversation_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversation_members set is_active = p_is_active
  where conversation_id = p_conversation_id and user_id = auth.uid();
end;
$$;

grant execute on function public.set_conversation_active(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 19. search_conversations() / search_messages() / get_conversation_media()
-- ---------------------------------------------------------------------------
create or replace function public.search_conversations(p_query text)
returns table (
  id uuid, other_user_id uuid, other_username text, other_display_name text, other_profile_photo_url text,
  last_message_preview text, last_message_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, pr.id, pr.username, pr.display_name, pr.profile_photo_url, c.last_message_preview, c.last_message_at
  from conversation_members cm
  join conversations c on c.id = cm.conversation_id
  join conversation_members other_cm on other_cm.conversation_id = c.id and other_cm.user_id <> auth.uid()
  join profiles pr on pr.id = other_cm.user_id
  where cm.user_id = auth.uid()
    and c.request_status in ('none', 'accepted')
    and not is_blocked_either_way(pr.id)
    and (pr.username ilike '%' || p_query || '%' or pr.display_name ilike '%' || p_query || '%')
  order by c.last_message_at desc nulls last
  limit 30;
$$;

grant execute on function public.search_conversations(text) to authenticated;

create or replace function public.search_messages(p_query text, p_limit int default 30)
returns table (id uuid, conversation_id uuid, other_display_name text, content text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.conversation_id, pr.display_name, m.content, m.created_at
  from messages m
  join conversation_members cm on cm.conversation_id = m.conversation_id and cm.user_id = auth.uid()
  join conversation_members other_cm on other_cm.conversation_id = m.conversation_id and other_cm.user_id <> auth.uid()
  join profiles pr on pr.id = other_cm.user_id
  where m.type = 'text'
    and not m.is_unsent
    and m.content ilike '%' || p_query || '%'
    and not exists (select 1 from message_deletes md where md.message_id = m.id and md.user_id = auth.uid())
    and not is_blocked_either_way(other_cm.user_id)
  order by m.created_at desc
  limit p_limit;
$$;

grant execute on function public.search_messages(text, int) to authenticated;

create or replace function public.get_conversation_media(p_conversation_id uuid)
returns table (id uuid, message_id uuid, type text, bucket text, url text, thumbnail_url text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.message_id, m.type, a.bucket, a.url, a.thumbnail_url, m.created_at
  from attachments a
  join messages m on m.id = a.message_id
  where m.conversation_id = p_conversation_id
    and not m.is_unsent
    and exists (select 1 from conversation_members where conversation_id = p_conversation_id and user_id = auth.uid())
    and not exists (select 1 from message_deletes md where md.message_id = m.id and md.user_id = auth.uid())
  order by m.created_at desc;
$$;

grant execute on function public.get_conversation_media(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 20. Notifications — message reactions. New messages and message
--     requests are notified directly from send_message()/
--     get_or_create_direct_conversation() above (they already computed
--     everything a trigger would need to re-look-up). A "reply"
--     notification is deliberately not a separate type: in a strictly
--     1:1 conversation there is only ever one possible recipient, who
--     already gets the 'new_message' notification — a distinct "replied
--     to you" notification would just be a second, redundant ping for
--     the same event. "Mention" is likewise not implemented for
--     messages: mentioning the only other person in a 1:1 thread is
--     redundant with new_message, and mentioning a third person who
--     isn't a conversation member wouldn't let them see anything anyway
--     (there's no group chat in this phase) — see README Known
--     limitations.
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_message_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid;
  v_conversation_id uuid;
  v_actor_name text;
begin
  select sender_id, conversation_id into v_sender_id, v_conversation_id from messages where id = new.message_id;
  if v_sender_id is null or v_sender_id = new.user_id then
    return new;
  end if;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.user_id;
  perform create_notification('message_reaction', new.user_id, v_sender_id, 'conversation', v_conversation_id,
    'message_reaction', v_actor_name || ' reacted ' || new.emoji || ' to your message.', null, '{}'::jsonb, 'reactions');
  return new;
end;
$$;

drop trigger if exists notify_on_message_reaction_trigger on public.message_reactions;
create trigger notify_on_message_reaction_trigger
  after insert or update on public.message_reactions
  for each row execute function public.notify_on_message_reaction();

-- ---------------------------------------------------------------------------
-- 21. Widen notifications' type/entity_type check constraints (Phase 11)
--     to cover the three new message-related notification types.
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'new_follower', 'follow_request', 'follow_accepted', 'mention',
  'drop_save_to_unlock', 'drop_good_vibes', 'drop_cant_wait', 'drop_interested',
  'drop_unlock_viewed', 'drop_liked', 'drop_commented', 'drop_replied', 'drop_reflected',
  'moment_viewed', 'moment_replied', 'moment_reacted',
  'capsule_unlock_reminder', 'capsule_unlocked', 'capsule_viewed', 'capsule_liked',
  'capsule_commented', 'capsule_replied', 'capsule_reflected',
  'weekly_recap', 'security_alert', 'password_changed', 'new_login', 'product_announcement',
  'new_message', 'message_reaction', 'message_request'
));

alter table public.notifications drop constraint if exists notifications_entity_type_check;
alter table public.notifications add constraint notifications_entity_type_check check (entity_type in ('drop', 'capsule', 'moment', 'comment', 'user', 'system', 'conversation'));
