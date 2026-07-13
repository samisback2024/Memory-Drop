-- Phase 14m — fix: reacting to (or saving-to-unlock) someone else's still-
-- locked drop was silently failing with a 403 "row-level security policy"
-- error on every single attempt.
--
-- Root cause: drop_interests' INSERT policy (phase4d_engagement.sql) checks
-- eligibility with a plain subquery against `posts`:
--
--   exists (select 1 from posts p where p.id = drop_id and p.unlock_date > now() and ...)
--
-- That subquery is itself gated by posts' OWN select RLS — and
-- phase10g_polish_fixes.sql (carried forward unchanged into
-- phase14b_rls_performance.sql) deliberately tightened that policy so a
-- non-owner can never SELECT a still-locked row directly, to stop sealed
-- content leaking via raw REST/PostgREST access. That hardening was correct
-- on its own, but it broke drop_interests' policy as a side effect: for any
-- drop that isn't your own, the subquery can no longer see the row at all
-- while it's locked — which is exactly the one state drop_interests exists
-- for. Confirmed live: clicking Interested/Can't Wait/Good Vibes/Save to
-- Unlock on another account's locked-but-visible drop 403'd every time.
--
-- Fix: give the eligibility check its own SECURITY DEFINER function, same
-- pattern as can_view_drop()/is_blocked_either_way() — it bypasses posts'
-- RLS internally (safe: it only ever returns a boolean, never row content),
-- so the same logic phase4d intended now actually runs regardless of
-- whether the caller could SELECT the row directly.

create or replace function public.can_add_drop_interest(p_drop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from posts p
    where p.id = p_drop_id
      and p.unlock_date > now()
      and (
        p.user_id = auth.uid()
        or (not is_blocked_either_way(p.user_id) and can_view_drop(p.user_id, p.visibility))
      )
  );
$$;

grant execute on function public.can_add_drop_interest(uuid) to authenticated;

drop policy if exists "Users can express interest in locked visible drops" on public.drop_interests;
create policy "Users can express interest in locked visible drops"
  on public.drop_interests for insert
  with check (
    (select auth.uid()) = user_id
    and can_add_drop_interest(drop_id)
  );
