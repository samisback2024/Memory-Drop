-- Memory Drop — Phase 15b: fix notification_events_type_check rejecting
-- the renamed Orbit event types.
-- Run once, after supabase/phase15_orbit_system.sql, in the Supabase SQL
-- editor.
--
-- Gap in phase15_orbit_system.sql: notify_on_orbit() (rewritten there)
-- inserts into notification_events with p_event_type 'orbit'/
-- 'orbit_request'/'orbit_accept', but notification_events_type_check
-- (added in phase14_database_hardening.sql — a file the original Orbit
-- migration's search missed) still only allows the old 'follow'/
-- 'follow_request'/'follow_accept' literals. Every orbit/orbit request
-- since phase15 ran has been failing at insert time (visible as an error
-- toast in the app: "new row for relation notification_events violates
-- check constraint notification_events_type_check").
--
-- Drop the old constraint FIRST — same lesson as phase15_orbit_system.sql:
-- it doesn't allow 'orbit'/'orbit_request'/'orbit_accept' yet, so running
-- the backfill UPDATEs while it's still active fails immediately on the
-- very first row they touch. This table has no update-blocking trigger
-- (unlike notifications), so no need to disable anything else.

alter table public.notification_events drop constraint if exists notification_events_type_check;

update public.notification_events set event_type = 'orbit' where event_type = 'follow';
update public.notification_events set event_type = 'orbit_request' where event_type = 'follow_request';
update public.notification_events set event_type = 'orbit_accept' where event_type = 'follow_accept';

alter table public.notification_events add constraint notification_events_type_check check (event_type in (
  'orbit', 'orbit_request', 'orbit_accept', 'mention',
  'drop_interest', 'drop_unlock_view', 'drop_like', 'drop_comment', 'drop_reply',
  'capsule_like', 'capsule_view', 'capsule_comment', 'capsule_reply', 'capsule_unlocked', 'capsule_unlock_reminder',
  'moment_view', 'moment_reply', 'moment_reaction',
  'new_login', 'password_changed', 'weekly_recap',
  'message', 'message_reaction', 'message_request'
));
