-- Phase 14d — fix get_messages() "column reference conversation_id is
-- ambiguous" (Postgres error 42702), found via live testing.
--
-- Root cause: get_messages() is a `language plpgsql` function whose
-- `returns table (...)` includes a column named `conversation_id`. In
-- PL/pgSQL, RETURNS TABLE output columns are in scope as variables
-- throughout the function body. The membership-check queries near the
-- top reference `conversation_id` UNQUALIFIED inside a query against
-- `conversation_members` (which also has a `conversation_id` column) —
-- Postgres can't tell whether that means the OUT variable or the table
-- column, and rejects the query outright with 42702 every single time.
-- This has been present since the function was first written in
-- phase12_messaging.sql (unchanged by Phase 13's block-check widening,
-- unrelated to anything in Phase 14's own migrations) — meaning reading
-- message history has never actually worked in production. Sending a
-- message and receiving its notification both go through separate
-- functions (send_message(), create_notification()) that don't share
-- this bug, which is why writes/notifications succeeded while the
-- sender's own message list stayed empty.
--
-- A codebase-wide check found exactly one other `language plpgsql` +
-- `returns table` function (get_recent_likers(), phase10d) — its
-- user_id references are all alias-qualified already, not affected.
--
-- Fix: qualify every conversation_members reference with an explicit
-- alias. No signature change, no behavior change beyond no longer
-- crashing.

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
  if not exists (select 1 from conversation_members cm where cm.conversation_id = p_conversation_id and cm.user_id = auth.uid()) then
    return;
  end if;

  select cm.user_id into v_other_id from conversation_members cm where cm.conversation_id = p_conversation_id and cm.user_id <> auth.uid();

  if v_other_id is not null and is_blocked_either_way(v_other_id) then
    return;
  end if;

  if p_before_message_id is not null then
    select m2.created_at into v_before_created_at from messages m2 where m2.id = p_before_message_id;
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
