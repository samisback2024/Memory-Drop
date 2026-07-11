-- Phase 14c — fix notification_events.entity_type_check rejecting 'conversation'
--
-- Bug: Phase 12 (messaging) widened notifications.entity_type_check to allow
-- 'conversation' but never made the same change to the sibling
-- notification_events table (the idempotency ledger create_notification()
-- writes to first, before the notifications row). Three call sites pass
-- entity_type = 'conversation': the message_request, message (new_message),
-- and message_reaction notifications in phase12_messaging.sql. All three
-- have been failing this CHECK constraint since Phase 12 shipped, and
-- because create_notification() runs inside the same transaction as
-- send_message()/accept_message_request()/the reaction trigger, the
-- exception rolled back the whole transaction — meaning sending a message
-- (or a message request) has been completely broken, not just the
-- notification side-effect.

alter table public.notification_events drop constraint if exists notification_events_entity_type_check;

alter table public.notification_events add constraint notification_events_entity_type_check check (
  entity_type in ('drop', 'capsule', 'moment', 'comment', 'user', 'system', 'conversation')
) not valid;

alter table public.notification_events validate constraint notification_events_entity_type_check;
