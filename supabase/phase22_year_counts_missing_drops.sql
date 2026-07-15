-- Phase 22 — fixes the Years tab showing a memory count that doesn't
-- match what's actually listed underneath it (e.g. "1 memory" for a
-- year that expands to 1 Capsule + 2 Drops).
--
-- get_memory_year_counts() was written in Phase 7, before Drops existed
-- as a unified "memory" — Phase 9 (phase9_unified_memory_wiring.sql)
-- widened get_memories()/get_memory() to include Drops alongside
-- Capsules/Moments, but this one function was never updated to match,
-- so it's been undercounting (silently omitting every Drop) ever since.
-- The corrected version mirrors get_memories()'s own inclusion rule for
-- a self-view exactly: Capsules and Drops count regardless of lock
-- status (it's your own archive — you should see everything you've
-- made, sealed or not), Moments only once expired (matching
-- get_memories()'s moment branch, which has no such "still active"
-- allowance), and Drops get the same `deleted_at is null` soft-delete
-- filter used everywhere else a deleted Drop needs to disappear.

create or replace function public.get_memory_year_counts()
returns table (year int, memory_count int)
language sql
stable
security definer
set search_path = public
as $$
  select extract(year from d.created_at)::int as year, count(*)::int as memory_count
  from (
    select created_at from capsules where user_id = auth.uid() and hidden_at is null
    union all
    select created_at from moments where user_id = auth.uid() and hidden_at is null and expires_at <= now()
    union all
    select created_at from posts where user_id = auth.uid() and deleted_at is null
  ) d
  group by 1
  order by 1 desc;
$$;

grant execute on function public.get_memory_year_counts() to authenticated;
