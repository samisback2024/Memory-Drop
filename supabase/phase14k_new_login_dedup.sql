-- Phase 14k — stop duplicate "New sign-in detected" notifications.
--
-- Real bug, reported live: one login produced two "New sign-in
-- detected" notifications. notify_on_new_session() fires once per row
-- inserted into user_sessions, and create_notification()'s idempotency
-- ledger (notification_events) can't dedupe this event type at all —
-- its natural key is (event_type, actor_id, recipient_id, entity_type,
-- entity_id), and new_login always passes null for both actor_id and
-- entity_id. In a unique constraint, NULL never equals NULL, so two
-- new_login events for the same user never collide and both sail
-- through — the ledger's "idempotent" guarantee silently doesn't apply
-- here. The client-side sessionStorage guard in AppShell.tsx was
-- assumed to prevent a double user_sessions insert in the first place
-- (see the comment this migration replaces below), but evidently
-- doesn't always hold — browser storage restrictions, an OAuth
-- redirect's timing, or some other edge case can still produce two
-- inserts for what's really one sign-in.
--
-- Fix: a real time-window dedup, directly on the notifications table
-- (not the ineffective ledger) — skip sending if this recipient
-- already got a new_login notification in the last 5 minutes. Long
-- enough to absorb any double-fire glitch, short enough that a
-- genuinely new session later the same day still gets its own alert.

create or replace function public.notify_on_new_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from notifications
    where recipient_id = new.user_id
      and type = 'new_login'
      and created_at > now() - interval '5 minutes'
  ) then
    return new;
  end if;

  perform create_notification('new_login', null, new.user_id, 'system', null,
    'new_login', 'New sign-in detected' || (case when new.device_label is not null then ' — ' || new.device_label else '' end) || '.',
    null, '{}'::jsonb, 'security_alerts');
  return new;
end;
$$;
