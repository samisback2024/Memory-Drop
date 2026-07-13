-- Phase 14t — fix: soft-deleting a drop 403'd every time, found live while
-- QA-testing the confirm-dialog + Deleted tab feature end to end.
--
-- Root cause: phase14s's posts SELECT policy wrapped the whole thing in
-- `deleted_at is null AND (...)` — including the owner's own branch. The
-- instant deleteDrop()'s UPDATE sets deleted_at, the row stops satisfying
-- its own SELECT policy for anyone, including its owner. PostgREST issues
-- every UPDATE as `UPDATE ... RETURNING *` internally (to know whether 0
-- or 1 rows were actually affected, for the response's Content-Range
-- header) — and that RETURNING is itself subject to the table's SELECT
-- policy. A row that stops being selectable by its own owner the moment
-- the update applies makes that RETURNING clause fail RLS, which Postgres
-- reports as the UPDATE itself violating "row-level security policy for
-- table posts", even though the actual WITH CHECK clause on the UPDATE
-- policy (unrelated to deleted_at) was never the problem.
--
-- Fix: the owner can always SELECT their own row via direct table access
-- regardless of deleted_at (matching how every other owner-only column
-- on posts already works) — deleted_at is only enforced against
-- everyone else. This doesn't reopen the "deleted post visible in feeds"
-- gap: get_drops_feed/get_drop/get_saved_drops (phase14s) each already
-- filter `deleted_at is null` explicitly in their own WHERE clause
-- regardless of this base table policy, since they're SECURITY DEFINER
-- and bypass table RLS entirely — this policy is the direct-table-read
-- backstop, the same role it already plays for unlock_date/
-- moderation_status.

drop policy if exists "Users can view visible posts" on public.posts;
create policy "Users can view visible posts"
  on public.posts for select
  using (
    user_id = (select auth.uid())
    or (
      deleted_at is null
      and unlock_date <= now()
      and moderation_status = 'active'
      and not is_blocked_either_way(user_id)
      and can_view_drop(user_id, visibility)
    )
  );
