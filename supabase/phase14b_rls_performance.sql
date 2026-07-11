-- Memory Drop — Phase 14b: RLS Policy Performance (production audit).
-- Run once, after supabase/phase14_database_hardening.sql, in the
-- Supabase SQL editor. Safe to re-run — every DROP + CREATE POLICY pair
-- is idempotent and semantically identical to what it replaces, just
-- with `auth.uid()` wrapped in a subquery.
--
-- Background: Postgres's planner can turn `auth.uid()` into a
-- once-per-statement "InitPlan" (cached, not re-evaluated per row) when
-- it's written as `(select auth.uid())` inside a filter — but when it
-- appears bare (`auth.uid() = user_id`) directly in an RLS policy's
-- USING/WITH CHECK clause that gets applied to every row of a table
-- scan, the planner doesn't reliably make that optimization on its own.
-- This is Supabase's own documented RLS performance guidance, not a
-- Memory-Drop-specific discovery.
--
-- Scope, deliberately narrow — read this before assuming "why isn't
-- every auth.uid() in the schema fixed":
--   1. This app already funnels essentially every real client read
--      through a SECURITY DEFINER RPC (get_drops_feed, get_capsule,
--      get_messages, get_notifications, ...) — established since Phase
--      2. SECURITY DEFINER functions BYPASS table-level RLS entirely
--      when they run. That means the six policies below are NOT on the
--      hot path for normal app usage today — they're the defense-in-
--      depth backstop against direct PostgREST/REST access (the exact
--      thing Phase 10g's posts-table hardening was about). Fixing them
--      is still worthwhile (free, zero-risk, and the backstop path
--      matters more as this app grows integrations), just not the
--      highest-leverage place in absolute terms.
--   2. The functions is_blocked_either_way()/can_view_drop()/
--      can_view_capsule()/can_view_moment()/can_view_author_posts() are
--      themselves SECURITY DEFINER — Postgres never inlines a SECURITY
--      DEFINER function into the calling query, so wrapping auth.uid()
--      INSIDE their bodies would not achieve the outer-query InitPlan
--      benefit (each call already executes exactly once per invocation
--      regardless of wrapping) — deliberately left unchanged rather than
--      making a no-op edit that looks like a fix but isn't one.
--   3. The real highest-leverage location for this exact optimization
--      in this app's architecture is inside the SECURITY DEFINER RPC
--      bodies themselves (get_drops_feed, get_conversations, etc.) —
--      wherever one of those functions' own query scans many rows and
--      filters each one against auth.uid(). That's a much larger
--      surface (dozens of RPCs) requiring individual review of each
--      query's shape, not a mechanical find-replace — a genuine,
--      separate follow-up, not attempted in this pass. See
--      KNOWN_LIMITATIONS.md.
--
-- What IS fixed here: the six RLS policies with `auth.uid()` written
-- directly in their USING/WITH CHECK clause on the app's highest-row-
-- count tables (posts, capsules, moments, messages, conversation_members,
-- notifications) — verified against each policy's exact current source
-- before rewriting, semantics unchanged, only the auth.uid() wrapping
-- added.

drop policy if exists "Users can view visible posts" on public.posts;
create policy "Users can view visible posts"
  on public.posts for select
  using (
    user_id = (select auth.uid())
    or (
      unlock_date <= now()
      and moderation_status = 'active'
      and not is_blocked_either_way(user_id)
      and can_view_drop(user_id, visibility)
    )
  );

drop policy if exists "Users can view visible capsules" on public.capsules;
create policy "Users can view visible capsules"
  on public.capsules for select
  using (
    user_id = (select auth.uid())
    or (
      unlock_date <= now()
      and not is_blocked_either_way(user_id)
      and can_view_capsule(user_id, visibility)
    )
  );

drop policy if exists "Users can view visible moments" on public.moments;
create policy "Users can view visible moments"
  on public.moments for select
  using (
    user_id = (select auth.uid())
    or (expires_at > now() and not is_blocked_either_way(user_id) and can_view_moment(user_id, privacy))
  );

drop policy if exists "Conversation members can view messages" on public.messages;
create policy "Conversation members can view messages"
  on public.messages for select
  using (exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = (select auth.uid())));

drop policy if exists "Conversation members can update messages" on public.messages;
create policy "Conversation members can update messages"
  on public.messages for update
  using (exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = (select auth.uid())))
  with check (true);

drop policy if exists "Users can view their own conversation membership" on public.conversation_members;
create policy "Users can view their own conversation membership"
  on public.conversation_members for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own conversation membership" on public.conversation_members;
create policy "Users can update their own conversation membership"
  on public.conversation_members for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select
  using ((select auth.uid()) = recipient_id);

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
  on public.notifications for delete
  using ((select auth.uid()) = recipient_id);
