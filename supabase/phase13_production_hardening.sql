-- Memory Drop — Phase 13: Production Readiness (security hardening +
-- analytics). Run once, after supabase/phase12_messaging.sql, in the
-- Supabase SQL editor. Safe to re-run — every statement is idempotent.
--
-- This phase is an audit-and-harden pass, not new features. A research
-- pass across the whole app (see README) found most of Phase 12's
-- cross-user RPCs already call is_blocked_either_way() — except four
-- that didn't, a genuine gap this file closes:
--   - get_messages() and get_conversation_media() let a blocked user go
--     on reading a conversation's full history/shared media forever
--     (blocking only ever stopped NEW messages and hid the thread from
--     list views, never revoked read access to what already existed).
--   - message_reactions' INSERT policy let a blocked user keep reacting
--     to the other party's messages.
--   - typing_status leaked "is typing" across a block relationship the
--     same way presence_status already correctly didn't.
-- The chat-media bucket was also the only one of six without an
-- allowed_mime_types allowlist (every other bucket has one).

-- ---------------------------------------------------------------------------
-- 1. get_messages() — same signature/shape, widened with a block check.
--    Returns nothing at all (not nulled rows) once either party has
--    blocked the other, same "table-level, not RPC-nulled" discipline
--    Capsules already established for lock state.
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

  if v_other_id is not null and is_blocked_either_way(v_other_id) then
    return;
  end if;

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

-- ---------------------------------------------------------------------------
-- 2. get_conversation_media() — same fix.
-- ---------------------------------------------------------------------------
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
    and not exists (
      select 1 from conversation_members other_cm
      where other_cm.conversation_id = p_conversation_id
        and other_cm.user_id <> auth.uid()
        and is_blocked_either_way(other_cm.user_id)
    )
    and not exists (select 1 from message_deletes md where md.message_id = m.id and md.user_id = auth.uid())
  order by m.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- 3. message_reactions — INSERT policy widened to also reject reacting
--    to a message whose sender you're blocked with either way.
-- ---------------------------------------------------------------------------
drop policy if exists "Conversation members can react to a message" on public.message_reactions;
create policy "Conversation members can react to a message"
  on public.message_reactions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.messages m join public.conversation_members cm on cm.conversation_id = m.conversation_id
      where m.id = message_reactions.message_id and cm.user_id = auth.uid()
    )
    and not is_blocked_either_way((select sender_id from public.messages where id = message_reactions.message_id))
  );

-- ---------------------------------------------------------------------------
-- 4. typing_status — SELECT policy widened, same posture presence_status
--    already had (Phase 12 got this right for presence, missed it here).
-- ---------------------------------------------------------------------------
drop policy if exists "Conversation members can view typing status" on public.typing_status;
create policy "Conversation members can view typing status"
  on public.typing_status for select
  using (
    exists (select 1 from public.conversation_members cm where cm.conversation_id = typing_status.conversation_id and cm.user_id = auth.uid())
    and not is_blocked_either_way(typing_status.user_id)
  );

-- ---------------------------------------------------------------------------
-- 5. chat-media bucket — the one bucket of six missing a server-side
--    MIME allowlist (every other bucket already has one). Matches the
--    types MessageComposer.tsx's four attach paths (image/video/audio/
--    generic file) actually produce, plus common document types for the
--    "file" attach option.
-- ---------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav',
  'application/pdf', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id = 'chat-media';

-- ---------------------------------------------------------------------------
-- 6. analytics_events — self-hosted, privacy-conscious event log. No
--    third-party vendor (no API key available, and a third party would
--    be a step down in privacy, not up). Insert-only, one-way mailbox,
--    same posture as `reports`/`feedback_reports` — nobody, including
--    the user who generated an event, can read it back through the
--    client; it exists for the app's own operators to query directly.
--    user_id is nullable so pre-auth funnel events (e.g. landing-page
--    views) can still be recorded, keyed by a client-generated
--    session_id instead.
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id text not null,
  event_name text not null check (char_length(event_name) between 1 and 100),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_name_idx on public.analytics_events (event_name, created_at desc);
create index if not exists analytics_events_user_idx on public.analytics_events (user_id, created_at desc) where user_id is not null;

alter table public.analytics_events enable row level security;

-- Anyone (signed in or not) can insert an event about themselves — the
-- same "own row only" discipline as everywhere else, just also allowing
-- anon so the pre-auth signup funnel (landing page, register started)
-- can be tracked at all.
drop policy if exists "Anyone can record their own analytics event" on public.analytics_events;
create policy "Anyone can record their own analytics event"
  on public.analytics_events for insert
  with check (user_id is null or user_id = auth.uid());

-- No SELECT policy for authenticated/anon at all — one-way mailbox.
revoke select on public.analytics_events from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 7. user_settings — one new opt-out toggle, default on (matches the
--    existing "on by default, real toggle" posture every notification
--    preference already uses).
-- ---------------------------------------------------------------------------
alter table public.user_settings add column if not exists analytics_enabled boolean not null default true;
