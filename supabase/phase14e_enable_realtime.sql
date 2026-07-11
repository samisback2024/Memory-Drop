-- Phase 14e — enable Realtime broadcast for the tables the frontend
-- already subscribes to, found via live testing.
--
-- Root cause: Supabase Realtime's `postgres_changes` relies on Postgres
-- logical replication — a table only broadcasts INSERT/UPDATE/DELETE
-- events to subscribed clients once it's added to the `supabase_realtime`
-- publication. No migration in this project (Phase 11 notifications,
-- Phase 12 messaging, or any later phase) ever ran that ALTER
-- PUBLICATION statement, even though the frontend has been subscribing
-- to `postgres_changes` on these tables since they shipped:
--   - messages, message_reactions, message_reads, typing_status,
--     conversations (src/pages/ConversationPage.tsx, MessagesPage.tsx,
--     MessagesNavButton.tsx)
--   - notifications (src/hooks/useNotifications.ts)
-- The result: every one of those subscriptions has been silently inert
-- since it was written. A message send/reaction/read-receipt/typing
-- event/notification only ever appeared for a user who refetches
-- another way (e.g. the sender's own onSent-triggered refresh, or a
-- manual page reload) — never pushed live to anyone else. This is why
-- text messages, stickers, GIFs, media, and voice messages all share
-- the identical "recipient must refresh" symptom: they're all rows in
-- the same messages table riding the same dead subscription.
--
-- Fix: add each table to the supabase_realtime publication. No RLS
-- change needed — Realtime's postgres_changes already respects each
-- table's RLS for the subscribing client's role (Supabase's default,
-- documented Realtime Authorization behavior), so this only starts
-- broadcasting changes a client could already read some other way.

-- Guarded per-table: ALTER PUBLICATION ... ADD TABLE has no IF NOT
-- EXISTS clause, and errors out (aborting the whole script) if a table
-- was already added another way (e.g. toggled on in the Supabase
-- dashboard's Database → Replication UI). This checks first.
do $$
declare
  v_table text;
begin
  foreach v_table in array array['messages', 'message_reactions', 'message_reads', 'typing_status', 'conversations', 'notifications']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;
