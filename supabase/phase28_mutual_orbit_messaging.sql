-- ---------------------------------------------------------------------------
-- Phase 28 — messaging now strictly requires mutual Orbit
-- ---------------------------------------------------------------------------
-- Product decision: you can only message someone once you're both in each
-- other's Orbit (send a request, they accept, you accept theirs back —
-- see the Orbit system, phase15_orbit_system.sql). This replaces the old
-- configurable messaging_privacy tiers ('everyone'/'followers'/
-- 'mutual_followers'/'nobody') and the "message requests from people
-- outside your circle" pathway — those columns (user_settings.
-- messaging_privacy, .allow_message_requests) are left in place
-- (never destructively dropped), just no longer read by this logic, so no
-- existing settings data is lost. conversations.request_status/
-- request_initiator_id are likewise left alone — any pending requests
-- that already exist from before this migration stay visible and
-- resolvable via the existing accept/decline path; this migration only
-- stops NEW ones from being created.

-- 1. can_message() — collapses to a single hard rule: self and blocked
--    users are still 'blocked' first, everyone else is 'allowed' only if
--    is_mutual_orbit() is true, otherwise 'blocked'. Never returns
--    'request' anymore.
create or replace function public.can_message(p_recipient_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_recipient_id = auth.uid() then
    return 'blocked';
  end if;
  if is_blocked_either_way(p_recipient_id) then
    return 'blocked';
  end if;
  if is_mutual_orbit(p_recipient_id) then
    return 'allowed';
  end if;
  return 'blocked';
end;
$$;

-- 2. get_or_create_direct_conversation() — the 'request' branch is now
--    unreachable (can_message never returns it), so new conversations are
--    always created with request_status = 'none'; anything not 'allowed'
--    raises instead of falling through to a pending request.
create or replace function public.get_or_create_direct_conversation(p_other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
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

  if can_message(p_other_id) <> 'allowed' then
    raise exception 'You can only message people you mutually orbit.';
  end if;

  insert into conversations (request_status, request_initiator_id)
  values ('none', auth.uid())
  returning id into v_conversation_id;

  insert into conversation_members (conversation_id, user_id)
  values (v_conversation_id, auth.uid()), (v_conversation_id, p_other_id);

  return v_conversation_id;
end;
$$;

-- 3. send_message() — previously only re-checked blocking on every send
--    (so a block made after a conversation started still cut it off).
--    Now also re-checks mutual orbit the same way, so leaving someone's
--    Orbit (or them leaving yours) revokes messaging immediately, not
--    just at conversation creation. can_message() already covers both
--    self/blocked/orbit in one call, so this replaces the standalone
--    is_blocked_either_way check rather than duplicating it.
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

  if v_other_id is not null and can_message(v_other_id) <> 'allowed' then
    raise exception 'You can only message people you mutually orbit.';
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

  -- Only still reachable for a conversation created before this migration
  -- shipped (request_status = 'pending') where both sides have since
  -- become mutually orbiting — resolves any such leftover gracefully
  -- instead of leaving it stuck. Every new conversation is created with
  -- 'none' now, so this is a no-op for anything created going forward.
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
