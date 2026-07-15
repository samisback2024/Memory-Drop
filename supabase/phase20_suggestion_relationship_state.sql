-- Memory Drop — Phase 20: fix "Suggested for you" / "New Creators"
-- always showing the initial Orbit button state, even after you've
-- actually sent a request.
--
-- Root cause: get_suggested_friends()/get_new_creators() never returned
-- relationship state at all — the frontend (SuggestedFriends.tsx,
-- NewCreators.tsx) hard-fills is_in_orbit/is_orbit_pending/
-- is_orbiting_you as `false` for every row, unlike every other list
-- (get_orbiters/get_orbiting/search_users) which compute the real
-- values. So the button rendered there could never show "Orbit
-- Requested" even for someone you'd already requested — it would
-- always reset back to "Request Orbit" on the next visit.
--
-- Run once, after supabase/phase19_interest_stats.sql, in the Supabase
-- SQL editor.

drop function if exists public.get_suggested_friends(int);
create function public.get_suggested_friends(p_limit int default 10)
returns table (
  id uuid, username text, display_name text, profile_photo_url text, is_private boolean, mutual_count bigint,
  is_in_orbit boolean, is_orbit_pending boolean, is_orbiting_you boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with my_orbiting as (
    select orbiting_id from orbits where orbiter_id = auth.uid() and status = 'accepted'
  ),
  blocked as (
    select blocked_id as uid from user_blocks where blocker_id = auth.uid()
    union
    select blocker_id as uid from user_blocks where blocked_id = auth.uid()
  ),
  candidates as (
    select f.orbiting_id as candidate_id, count(*) as mutual_count
    from orbits f
    where f.orbiter_id in (select orbiting_id from my_orbiting)
      and f.status = 'accepted'
    group by f.orbiting_id
  )
  select p.id, p.username, p.display_name, p.profile_photo_url, p.is_private,
    coalesce(c.mutual_count, 0) as mutual_count,
    exists(select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p.id and status = 'accepted'),
    exists(select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = p.id and status = 'pending'),
    exists(select 1 from orbits where orbiter_id = p.id and orbiting_id = auth.uid() and status = 'accepted')
  from profiles p
  left join candidates c on c.candidate_id = p.id
  where p.id <> auth.uid()
    and p.username is not null
    and p.id not in (select orbiting_id from my_orbiting)
    and p.id not in (select uid from blocked)
  order by mutual_count desc, p.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_suggested_friends(int) to authenticated;

drop function if exists public.get_new_creators(int);
create function public.get_new_creators(p_limit int default 20)
returns table (
  id uuid, username text, display_name text, profile_photo_url text, is_private boolean, mutual_count int,
  is_in_orbit boolean, is_orbit_pending boolean, is_orbiting_you boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.username, pr.display_name, pr.profile_photo_url, pr.is_private, 0,
    exists(select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = pr.id and status = 'accepted'),
    exists(select 1 from orbits where orbiter_id = auth.uid() and orbiting_id = pr.id and status = 'pending'),
    exists(select 1 from orbits where orbiter_id = pr.id and orbiting_id = auth.uid() and status = 'accepted')
  from public.profiles pr
  where pr.id <> auth.uid()
    and pr.username is not null
    and not is_blocked_either_way(pr.id)
  order by pr.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_new_creators(int) to authenticated;
