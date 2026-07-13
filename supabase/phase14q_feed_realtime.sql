-- Phase 14q — Feed never updated live; a new Drop from someone you
-- follow (or a public account) only ever appeared after a manual
-- refresh. Same root cause phase14e already fixed for messaging/
-- notifications: `posts` was never added to the supabase_realtime
-- publication, so postgres_changes INSERT events for it were never
-- broadcast at all, even though nothing in the frontend was
-- subscribing to it yet either (this migration and the FeedPage
-- subscription it enables ship together).
--
-- No RLS change needed — same as phase14e, postgres_changes already
-- respects posts' own SELECT RLS for the subscribing client, so a
-- still-locked drop from someone else never broadcasts its INSERT to
-- anyone who couldn't already read that row some other way.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    execute 'alter publication supabase_realtime add table public.posts';
  end if;
end $$;
