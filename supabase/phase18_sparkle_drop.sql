-- Memory Drop — Phase 18: "Like" becomes Sparkle Drop.
-- Run once, after supabase/phase17_moments_stat.sql, in the Supabase SQL
-- editor.
--
-- Purely a copy change to the notification title text these two triggers
-- write going forward — the underlying `likes`/`capsule_likes` tables,
-- columns, and notification type strings ('drop_liked'/'capsule_liked')
-- are untouched (this is a presentation-layer rename per the product
-- brief, not a schema rename like Phase 15's Orbit work). No backfill of
-- historical notification rows either — old ones keep reading "liked",
-- matching how Phase 15 also left old Orbit notification text as-is.
-- Zero data risk: CREATE OR REPLACE on a trigger function whose
-- signature isn't changing.

create or replace function public.notify_on_drop_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_actor_name text;
begin
  select user_id into v_owner_id from posts where id = new.post_id;
  if v_owner_id is null or v_owner_id = new.user_id then
    return new;
  end if;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.user_id;
  perform create_notification('drop_like', new.user_id, v_owner_id, 'drop', new.post_id,
    'drop_liked', v_actor_name || ' sent your Drop a Sparkle Drop.', null, '{}'::jsonb, 'reactions');
  return new;
end;
$$;

create or replace function public.notify_on_capsule_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_actor_name text;
begin
  select user_id into v_owner_id from capsules where id = new.capsule_id;
  if v_owner_id is null or v_owner_id = new.user_id then
    return new;
  end if;
  select coalesce(display_name, username) into v_actor_name from profiles where id = new.user_id;
  perform create_notification('capsule_like', new.user_id, v_owner_id, 'capsule', new.capsule_id,
    'capsule_liked', v_actor_name || ' sent your Capsule a Sparkle Drop.', null, '{}'::jsonb, 'reactions');
  return new;
end;
$$;
