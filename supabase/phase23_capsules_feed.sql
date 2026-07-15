-- Phase 23 — Capsules gets the same "My / In Orbit / Public" discovery
-- tabs Drops already has. Until now the Capsules page only ever called
-- get_user_capsules(auth.uid(), ...) — there was no way to see anyone
-- else's capsules without visiting their profile.
--
-- That gap compounds a second, real bug this migration also fixes:
-- get_user_capsules()/get_capsule() hide a still-locked capsule from
-- everyone but its owner *entirely* (`c.user_id = auth.uid() or
-- (c.unlock_date <= now() and can_view_capsule(...))`) — so a friend's
-- public capsule that hasn't unlocked yet was invisible everywhere,
-- not just on this new tab, until the moment it opened. Drops never had
-- this problem: get_drops_feed's in_orbit/public_drops tabs show a
-- locked Drop's sealed card (countdown, no content) the same way this
-- new function shows a locked Capsule's sealed card — the "something's
-- coming" anticipation is the point, not a bug to hide. This migration
-- only adds the new function; get_user_capsules/get_capsule (used by
-- profile pages and the existing Browse & Search view) are unchanged.

create or replace function public.get_capsules_feed(p_tab text, p_limit int default 20, p_offset int default 0)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  profile_photo_url text,
  is_private boolean,
  title text,
  memory_text text,
  memory_types text[],
  media jsonb,
  mood text,
  visibility text,
  unlock_date timestamptz,
  is_unlocked boolean,
  has_opened boolean,
  is_owner boolean,
  like_count int,
  is_liked boolean,
  comment_count int,
  save_count int,
  is_saved boolean,
  share_count int,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select
      c.id, c.user_id, pr.username, pr.display_name, pr.profile_photo_url, pr.is_private,
      case when c.unlock_date <= now() then c.title else null end,
      case when c.unlock_date <= now() then c.memory_text else null end,
      c.memory_types,
      case when c.unlock_date <= now() then coalesce(
        (select jsonb_agg(jsonb_build_object('url', cm.media_url, 'type', cm.media_type, 'position', cm.position) order by cm.position)
         from capsule_media cm where cm.capsule_id = c.id),
        '[]'::jsonb
      ) else '[]'::jsonb end as media,
      c.mood,
      c.visibility,
      c.unlock_date,
      (c.unlock_date <= now()) as is_unlocked,
      exists(select 1 from capsule_unlocks cu where cu.capsule_id = c.id and cu.user_id = auth.uid()) as has_opened,
      (c.user_id = auth.uid()) as is_owner,
      c.like_count,
      exists(select 1 from capsule_likes cl where cl.capsule_id = c.id and cl.user_id = auth.uid()) as is_liked,
      c.comment_count, c.save_count,
      exists(select 1 from capsule_saves cs where cs.capsule_id = c.id and cs.user_id = auth.uid()) as is_saved,
      c.share_count,
      c.created_at
    from capsules c
    join profiles pr on pr.id = c.user_id
    where
      c.hidden_at is null
      and c.moderation_status = 'active'
      and not is_blocked_either_way(c.user_id)
      and (
        case p_tab
          when 'my_capsules' then c.user_id = auth.uid()
          when 'in_orbit' then
            c.user_id <> auth.uid()
            and exists(select 1 from orbits f where f.orbiter_id = auth.uid() and f.orbiting_id = c.user_id and f.status = 'accepted')
            and can_view_capsule(c.user_id, c.visibility)
          when 'public' then
            c.user_id <> auth.uid()
            and c.visibility = 'public'
            and not coalesce(pr.is_private, false)
          else false
        end
      )
    order by
      case when p_tab in ('in_orbit', 'public') then c.created_at end desc,
      c.unlock_date asc,
      c.id desc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.get_capsules_feed(text, int, int) to authenticated;
