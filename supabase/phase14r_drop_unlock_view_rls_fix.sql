-- Phase 14r — fix: recording "I viewed this unlocked drop" 403'd every
-- time for any drop that wasn't the viewer's own, found live while
-- testing the recordUnlockView upsert fix (see useDrops.ts).
--
-- Same root cause as phase14m's drop_interests fix: drop_unlock_views'
-- INSERT policy (phase4d_engagement.sql) checks eligibility with a plain
-- subquery against `posts` —
--
--   exists (select 1 from posts p where p.id = drop_id and p.unlock_date <= now() and ...)
--
-- — which is itself gated by posts' own SELECT RLS (phase10g/phase14b's
-- moderation_status/unlock_date hardening), evaluated as the calling
-- role rather than bypassing it. Give it the same SECURITY DEFINER
-- escape hatch as can_add_drop_interest.

create or replace function public.can_record_drop_unlock_view(p_drop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from posts p
    where p.id = p_drop_id
      and p.user_id <> auth.uid()
      and p.unlock_date <= now()
      and not is_blocked_either_way(p.user_id)
      and can_view_drop(p.user_id, p.visibility)
  );
$$;

grant execute on function public.can_record_drop_unlock_view(uuid) to authenticated;

drop policy if exists "Users can record viewing an unlocked drop" on public.drop_unlock_views;
create policy "Users can record viewing an unlocked drop"
  on public.drop_unlock_views for insert
  with check (
    (select auth.uid()) = user_id
    and can_record_drop_unlock_view(drop_id)
  );
