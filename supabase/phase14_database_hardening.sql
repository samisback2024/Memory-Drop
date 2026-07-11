-- Memory Drop — Phase 14a: Database Hardening (production audit).
-- Run once, after supabase/phase13_production_hardening.sql, in the
-- Supabase SQL editor. Safe to re-run — every statement is idempotent.
--
-- This is not a new-feature phase — it's a full schema audit (indexes,
-- constraints, function correctness) across all 13 prior migrations,
-- prompted by a production-readiness review. See phase14b_rls_performance.sql
-- for the companion RLS-policy performance pass (kept separate: that one
-- rewrites existing policies, a materially higher-risk class of change
-- than adding new indexes/constraints, and deserves its own isolated,
-- easily-revertible migration).

-- ---------------------------------------------------------------------------
-- 1. Missing indexes on foreign-key columns.
--
--    Postgres does NOT automatically index a foreign-key column — only
--    the referenced side's primary key. Every column below is an FK (or
--    a column functionally used like one) that had no supporting index,
--    found by cross-checking every `references` clause across all 13
--    migrations against `create index` statements. Two consequences of
--    the gap: (a) `delete from profiles where id = ...` (account
--    deletion, Phase 8's delete_my_account()) has to sequential-scan
--    every one of these tables to enforce `on delete cascade`/`set
--    null`; (b) is_blocked_either_way() — called by nearly every
--    hot-path SELECT policy in the app (Feed, Capsules, Moments,
--    Messages) — checks `blocked_id = auth.uid()` against
--    `user_blocks`, which had no index on that column at all.
-- ---------------------------------------------------------------------------
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);
create index if not exists user_mutes_muted_idx on public.user_mutes (muted_id);
create index if not exists user_restrictions_restricted_idx on public.user_restrictions (restricted_id);

create index if not exists comments_user_idx on public.comments (user_id);
create index if not exists comments_parent_idx on public.comments (parent_comment_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists drop_unlock_views_user_idx on public.drop_unlock_views (user_id);

create index if not exists close_friends_friend_idx on public.close_friends (friend_id);

create index if not exists moment_reactions_user_idx on public.moment_reactions (user_id);
create index if not exists moment_replies_user_idx on public.moment_replies (user_id);

create index if not exists capsule_unlocks_user_idx on public.capsule_unlocks (user_id);
create index if not exists capsule_views_viewer_idx on public.capsule_views (viewer_id);
create index if not exists capsule_reflections_user_idx on public.capsule_reflections (user_id);
create index if not exists capsule_likes_user_idx on public.capsule_likes (user_id);
create index if not exists capsule_comments_user_idx on public.capsule_comments (user_id);
create index if not exists capsule_saves_user_idx on public.capsule_saves (user_id);

-- favorites/collection_items/pinned_items: each has a composite unique
-- index led by (user_id, ...) or (collection_id, ...), which can't serve
-- a lookup keyed on the content-id column alone (e.g. "which favorites
-- point at this capsule, because it's being deleted").
create index if not exists favorites_capsule_idx on public.favorites (capsule_id) where capsule_id is not null;
create index if not exists favorites_moment_idx on public.favorites (moment_id) where moment_id is not null;
create index if not exists favorites_drop_idx on public.favorites (drop_id) where drop_id is not null;
create index if not exists collection_items_capsule_idx on public.collection_items (capsule_id) where capsule_id is not null;
create index if not exists collection_items_moment_idx on public.collection_items (moment_id) where moment_id is not null;
create index if not exists collection_items_drop_idx on public.collection_items (drop_id) where drop_id is not null;
create index if not exists pinned_items_capsule_idx on public.pinned_items (capsule_id) where capsule_id is not null;
create index if not exists pinned_items_moment_idx on public.pinned_items (moment_id) where moment_id is not null;
create index if not exists pinned_items_drop_idx on public.pinned_items (drop_id) where drop_id is not null;

create index if not exists capsule_reports_reporter_idx on public.capsule_reports (reporter_id);
create index if not exists moment_reports_reporter_idx on public.moment_reports (reporter_id);
create index if not exists posts_moderated_by_idx on public.posts (moderated_by) where moderated_by is not null;
create index if not exists capsules_moderated_by_idx on public.capsules (moderated_by) where moderated_by is not null;
create index if not exists moments_moderated_by_idx on public.moments (moderated_by) where moderated_by is not null;

create index if not exists comment_reactions_user_idx on public.comment_reactions (user_id);

create index if not exists notification_events_actor_idx on public.notification_events (actor_id) where actor_id is not null;
create index if not exists notifications_actor_idx on public.notifications (actor_id) where actor_id is not null;

create index if not exists messages_sender_idx on public.messages (sender_id);
create index if not exists messages_reply_to_idx on public.messages (reply_to_message_id) where reply_to_message_id is not null;
create index if not exists messages_forwarded_from_idx on public.messages (forwarded_from_message_id) where forwarded_from_message_id is not null;
create index if not exists messages_pinned_by_idx on public.messages (pinned_by) where pinned_by is not null;
create index if not exists message_reads_user_idx on public.message_reads (user_id);
create index if not exists message_reactions_user_idx on public.message_reactions (user_id);
create index if not exists message_deletes_user_idx on public.message_deletes (user_id);
create index if not exists message_stars_user_idx on public.message_stars (user_id);
create index if not exists typing_status_user_idx on public.typing_status (user_id);
create index if not exists conversations_last_sender_idx on public.conversations (last_message_sender_id) where last_message_sender_id is not null;
create index if not exists conversations_initiator_idx on public.conversations (request_initiator_id) where request_initiator_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Missing CHECK constraints.
--
--    Trigger-maintained counters already defend against going negative
--    in normal app usage (every decrement trigger uses
--    greatest(x - 1, 0)), but nothing stops a direct UPDATE (SQL editor,
--    service-role script) from driving one negative — these constraints
--    make "never negative" a database guarantee, not just a trigger
--    convention. Existing data is already >= 0 in every column below
--    (a consequence of the triggers' own defensiveness), so this is
--    safe to add without a backfill.
-- ---------------------------------------------------------------------------
alter table public.posts add constraint posts_counts_non_negative check (
  like_count >= 0 and comment_count >= 0 and share_count >= 0 and save_count >= 0
  and interested_count >= 0 and cant_wait_count >= 0 and good_vibes_count >= 0 and save_to_unlock_count >= 0
) not valid;
alter table public.posts validate constraint posts_counts_non_negative;

alter table public.capsules add constraint capsules_counts_non_negative check (
  like_count >= 0 and comment_count >= 0 and save_count >= 0 and share_count >= 0
) not valid;
alter table public.capsules validate constraint capsules_counts_non_negative;

alter table public.moments add constraint moments_view_count_non_negative check (view_count >= 0) not valid;
alter table public.moments validate constraint moments_view_count_non_negative;

-- notification_events.event_type had no enum check at all, unlike
-- notifications.type (which already lists every valid value) — this is
-- every literal event_type string actually passed to create_notification()
-- across phase11/phase12, so a typo'd event type now fails loudly at
-- insert time instead of silently creating an event nothing will ever
-- match against for deduplication.
alter table public.notification_events add constraint notification_events_type_check check (event_type in (
  'follow', 'follow_request', 'follow_accept', 'mention',
  'drop_interest', 'drop_unlock_view', 'drop_like', 'drop_comment', 'drop_reply',
  'capsule_like', 'capsule_view', 'capsule_comment', 'capsule_reply', 'capsule_unlocked', 'capsule_unlock_reminder',
  'moment_view', 'moment_reply', 'moment_reaction',
  'new_login', 'password_changed', 'weekly_recap',
  'message', 'message_reaction', 'message_request'
)) not valid;
alter table public.notification_events validate constraint notification_events_type_check;

-- Attachment metadata: dimensions/duration/size should never be negative.
alter table public.attachments add constraint attachments_dimensions_non_negative check (
  (width is null or width >= 0) and (height is null or height >= 0)
  and (duration_seconds is null or duration_seconds >= 0) and (size_bytes is null or size_bytes >= 0)
) not valid;
alter table public.attachments validate constraint attachments_dimensions_non_negative;

-- moderation_reason had no length cap, unlike every other free-text
-- field in this app (comments, notification bodies, etc. all have one).
alter table public.posts add constraint posts_moderation_reason_length check (moderation_reason is null or char_length(moderation_reason) <= 500) not valid;
alter table public.posts validate constraint posts_moderation_reason_length;
alter table public.capsules add constraint capsules_moderation_reason_length check (moderation_reason is null or char_length(moderation_reason) <= 500) not valid;
alter table public.capsules validate constraint capsules_moderation_reason_length;
alter table public.moments add constraint moments_moderation_reason_length check (moderation_reason is null or char_length(moderation_reason) <= 500) not valid;
alter table public.moments validate constraint moments_moderation_reason_length;

-- ---------------------------------------------------------------------------
-- 3. create_notification() — explicit revoke, defense in depth.
--
--    Every other SECURITY DEFINER RPC in this app explicitly grants
--    execute only to the roles that should have it; create_notification()
--    never got an explicit grant/revoke statement when it shipped in
--    Phase 11. It's SECURITY DEFINER and accepts an arbitrary
--    p_recipient_id/p_type/p_title/p_body — if the schema's default
--    PUBLIC execute privilege on new functions were ever left in place,
--    any authenticated client could call it directly and forge a
--    notification (including a fake security_alert or password_changed)
--    for any recipient. This has almost certainly been unreachable in
--    practice (nothing in the client ever calls it directly, and
--    Supabase's own `authenticated`/`anon` roles don't get blanket
--    function-execute by default), but explicit is safer than implicit
--    for a function this sensitive.
-- ---------------------------------------------------------------------------
revoke all on function public.create_notification(text, uuid, uuid, text, uuid, text, text, text, jsonb, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. generate_weekly_recap() — N+1 query fix.
--
--    The original looped row-by-row over every profile and ran a
--    separate aggregate query per user against memory_items_view. Same
--    signature, same behavior, one query instead of N — a single
--    group-by pass computes every user's count at once. (Still
--    unscheduled — see Known limitations; this fixes its shape for
--    whenever pg_cron does get wired up, not because it runs today.)
-- ---------------------------------------------------------------------------
create or replace function public.generate_weekly_recap()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  for v_row in
    select owner_id, count(*) as unlocked_count
    from memory_items_view
    where status in ('unlocked', 'expired')
      and created_at > now() - interval '7 days'
    group by owner_id
    having count(*) > 0
  loop
    perform create_notification('weekly_recap', null, v_row.owner_id, 'system', null,
      'weekly_recap', 'Your week in memories: ' || v_row.unlocked_count || ' new ' ||
      (case when v_row.unlocked_count = 1 then 'memory' else 'memories' end) || '.',
      null, jsonb_build_object('count', v_row.unlocked_count), 'weekly_recap');
  end loop;
end;
$$;
