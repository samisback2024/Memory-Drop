-- Phase 14v — "Delete chat." There was Pin/Mute/Archive on a
-- conversation but no way to actually remove one from your own inbox —
-- Archived still keeps it one tab away forever. This adds a real
-- "delete for me" at the conversation level, the same discipline
-- already used for a single message (message_deletes / is_unsent):
-- deleting only ever affects your own view, never the other member's.
--
-- A conversation you've deleted reappears automatically the next time
-- the other person sends a new message (comparing conversations.
-- last_message_at against your own deleted_at) — same behavior anyone
-- coming from any other messaging app already expects, and it means a
-- new message from someone can never silently vanish into a deleted
-- thread you'll never see again. Your own message history from before
-- you deleted stays hidden even after that happens; only messages sent
-- after your deleted_at become visible again.
--
-- No new RLS policy needed — conversation_members already lets a member
-- update their own row (phase12_messaging.sql), so setting deleted_at
-- is just another direct client update, same as is_pinned/is_muted/
-- is_archived.

alter table public.conversation_members add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- get_conversations() — a deleted-with-nothing-new-since conversation is
-- excluded from every tab, not just "all" (deleting supersedes pin/mute/
-- archive state, same as it would in any other messaging app).
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
    and (cm.deleted_at is null or c.last_message_at > cm.deleted_at)
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

-- ---------------------------------------------------------------------------
-- get_messages() — same signature as phase14d's fix (the ambiguous-
-- column fix, still needed, kept verbatim). Your own deleted history
-- stays hidden even once the conversation reappears from a new message.
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
  v_my_deleted_at timestamptz;
begin
  if not exists (select 1 from conversation_members cm where cm.conversation_id = p_conversation_id and cm.user_id = auth.uid()) then
    return;
  end if;

  select cm.user_id into v_other_id from conversation_members cm where cm.conversation_id = p_conversation_id and cm.user_id <> auth.uid();
  select cm.deleted_at into v_my_deleted_at from conversation_members cm where cm.conversation_id = p_conversation_id and cm.user_id = auth.uid();

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
      and (v_my_deleted_at is null or m.created_at > v_my_deleted_at)
      and (p_before_message_id is null or m.created_at < v_before_created_at)
    order by m.created_at desc
    limit p_limit;
end;
$$;

grant execute on function public.get_messages(uuid, uuid, int) to authenticated;
