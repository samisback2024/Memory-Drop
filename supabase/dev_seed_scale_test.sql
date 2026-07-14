-- Memory Drop — Scale-test seed data (Phase 10f/10g).
--
-- ⚠ NOT a schema migration — do not add this to your normal migration
-- run. This creates 100 fake accounts (10 of them private, plus a
-- couple of block relationships) and thousands of fake content rows for
-- load/consistency testing: 1000 Drops, 300 Capsules, 300 Moments,
-- ~1500 orbits, ~4500 comments, ~6000 likes/reactions, ~600 bookmarks,
-- ~100 collections with ~300 items, ~500 favorites — matching the
-- revised Phase 10 spec's "1,000 Drops, 300 Capsules, 300 Moments, 100
-- users... Follow relationships, private accounts, blocks, comments,
-- reactions, saves, collections, favorites." Run it only against a
-- local/staging project you're happy to fill with junk and wipe
-- afterward — never against production.
--
-- Every fake account is named `scaletest_<n>` (username and email), so
-- it's trivially identifiable and removable. To wipe everything this
-- script creates, run:
--
--   delete from auth.users where email like 'scaletest_%@memorydrop.test';
--
-- ...which cascades through every table (profiles → posts/capsules/
-- moments/orbits/comments/likes/saves/collections/... all the way
-- down) via the same `on delete cascade` chain real account deletion
-- already relies on (see delete_my_account() in phase8_settings.sql) —
-- nothing extra to clean up by hand.
--
-- Known caveat: `auth.users` is a Supabase-managed table, not defined
-- anywhere in this repo's own migrations, so its exact required/NOT
-- NULL columns aren't something these SQL files can verify ahead of
-- time and can vary slightly by Supabase Postgres version. Run the
-- "1. Fake accounts" section alone first and confirm it creates real,
-- working profiles before running the rest of this script.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Fake accounts (100 users, 10 of them private) — inserting into
--    auth.users and letting the existing handle_new_user() trigger
--    (phase1_auth.sql) create the matching profiles row from
--    raw_user_meta_data, exactly like a real sign-up does. profiles.id
--    has a hard FK to auth.users.id, so there's no way to create
--    standalone fake profiles without this.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated',
  'scaletest_' || i || '@memorydrop.test',
  crypt('scaletest-password-' || i, gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'username', 'scaletest_' || i,
    'display_name', 'Scale Test User ' || i,
    'date_of_birth', (current_date - interval '20 years')::text
  ),
  false, '', '', '', ''
from generate_series(1, 100) as i
on conflict do nothing;

-- Pool of fake user ids, indexed 1..100 for deterministic-but-varied
-- distribution below (avoids an `order by random()` per generated row,
-- which would be needlessly slow across thousands of inserts).
create temporary table if not exists _seed_users as
select id, row_number() over (order by username) as rn
from public.profiles
where username like 'scaletest\_%' escape '\';

-- Every 10th seeded account (10 total) is private, so the "private
-- account" manual-test rows in the README checklist have real fixture
-- data — a non-owner should never see their locked content regardless
-- of visibility tier.
update public.profiles
set is_private = true
where id in (select id from _seed_users where rn % 10 = 0);

-- ---------------------------------------------------------------------------
-- 2. Orbits (~1500 rows) — each fake user orbits ~15 random others.
--    status is left for the existing orbit-request trigger to compute
--    (phase15_orbit_system.sql) — accepted for public accounts, pending
--    for the 10 private ones, exactly like a real orbit would resolve.
-- ---------------------------------------------------------------------------
insert into public.orbits (orbiter_id, orbiting_id)
select u1.id, u2.id
from _seed_users u1
cross join lateral (
  select id from _seed_users u2 where u2.rn <> u1.rn order by random() limit 15
) u2
on conflict do nothing;

-- A couple of block relationships, so the "blocked relationship" manual
-- test has real fixture data too — mutually invisible regardless of any
-- orbit/content relationship that exists between them.
insert into public.user_blocks (blocker_id, blocked_id)
select (select id from _seed_users where rn = 1), (select id from _seed_users where rn = 2)
union all
select (select id from _seed_users where rn = 3), (select id from _seed_users where rn = 4)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Drops (1000) — text-only on purpose (no photo/video/audio storage
--    uploads needed for a data-consistency/scale test), spread across
--    the last 400 days, a mix of already-unlocked and still-locked, a
--    mix of all three visibility tiers.
-- ---------------------------------------------------------------------------
insert into public.posts (user_id, post_type, caption, unlock_date, visibility, mood, created_at)
select
  (select id from _seed_users where rn = ((i % 100) + 1)),
  'text',
  'Scale-test drop #' || i || ' — a memory dropped for load testing.',
  -- ~70% already unlocked (up to 300 days ago), ~30% still locked (up to 60 days ahead)
  (case when random() < 0.7 then now() - (random() * 300 || ' days')::interval else now() + (random() * 60 || ' days')::interval end),
  (array['public', 'public', 'public', 'followers', 'private'])[1 + floor(random() * 5)::int],
  (array['joyful', 'grateful', 'nostalgic', 'hopeful', 'reflective', 'peaceful', 'bittersweet', 'excited'])[1 + floor(random() * 8)::int],
  now() - (random() * 400 || ' days')::interval
from generate_series(1, 1000) as i;

-- ---------------------------------------------------------------------------
-- 4. Moments (300) — text-only, duration_hours must be exactly 12/24/48
--    (a hard CHECK constraint). created_at is backdated so roughly half
--    land already-expired and half are still "live" — the
--    set_moment_expiry trigger computes expires_at from created_at +
--    duration_hours, so backdating created_at is what actually controls
--    this, not expires_at directly (the trigger overwrites it anyway).
-- ---------------------------------------------------------------------------
insert into public.moments (user_id, text_content, media_type, privacy, duration_hours, mood, created_at)
select
  (select id from _seed_users where rn = ((i % 100) + 1)),
  'Scale-test moment #' || i || '.',
  'text',
  (array['everyone', 'everyone', 'everyone', 'followers', 'only_me'])[1 + floor(random() * 5)::int],
  (array[12, 24, 48])[1 + floor(random() * 3)::int],
  (array['joyful', 'grateful', 'nostalgic', 'hopeful', 'reflective', 'peaceful', 'bittersweet', 'excited'])[1 + floor(random() * 8)::int],
  now() - (case when random() < 0.5 then (random() * 5 || ' days')::interval else (random() * 3 || ' days')::interval end)
from generate_series(1, 300) as i;

-- ---------------------------------------------------------------------------
-- 5. Capsules (300) — memory_types must be non-empty; unlock_date must
--    be after created_at (a BEFORE INSERT trigger, not a plain CHECK,
--    since it compares against created_at rather than real now()).
--    Backdating created_at and choosing an unlock_date offset that
--    sometimes lands before real now() and sometimes after naturally
--    produces a mix of unlocked/locked capsules while always satisfying
--    the trigger.
-- ---------------------------------------------------------------------------
insert into public.capsules (user_id, title, memory_text, memory_types, visibility, mood, unlock_date, created_at)
select
  (select id from _seed_users where rn = ((gen.i % 100) + 1)),
  'Scale-test capsule #' || gen.i,
  'A memory sealed for load testing, #' || gen.i || '.',
  array['text'],
  (array['public', 'public', 'followers', 'only_me'])[1 + floor(random() * 4)::int],
  (array['joyful', 'grateful', 'nostalgic', 'hopeful', 'reflective', 'peaceful', 'bittersweet', 'excited'])[1 + floor(random() * 8)::int],
  -- unlock_date must be strictly after created_at (a trigger, not a plain
  -- CHECK) — deriving it as an offset from the SAME created_at value
  -- below (not a fresh random() draw) is what guarantees that.
  gen.created_at + (30 + random() * 400 || ' days')::interval,
  gen.created_at
from (select i, now() - (random() * 400 || ' days')::interval as created_at from generate_series(1, 300) as i) as gen;

-- ---------------------------------------------------------------------------
-- 6. Comments — ~3000 on unlocked/visible Drops, ~1500 on unlocked/
--    visible Capsules, by random fake users. Filtered to already-
--    unlocked, non-private content even though the SQL editor's own
--    postgres role bypasses RLS — keeping seed data consistent with
--    what real RLS would actually allow makes the "no RLS leaks" test
--    pass meaningful signal instead of trivially-always-true.
-- ---------------------------------------------------------------------------
insert into public.comments (post_id, user_id, content)
select p.id, (select id from _seed_users where rn = (1 + floor(random() * 100)::int)), 'Scale-test comment on drop.'
from public.posts p, generate_series(1, 3)
where p.unlock_date <= now() and p.visibility <> 'private' and p.caption like 'Scale-test drop%'
order by random()
limit 3000;

insert into public.capsule_comments (capsule_id, user_id, content)
select c.id, (select id from _seed_users where rn = (1 + floor(random() * 100)::int)), 'Scale-test comment on capsule.'
from public.capsules c, generate_series(1, 3)
where c.unlock_date <= now() and c.visibility <> 'only_me' and c.title like 'Scale-test capsule%'
order by random()
limit 1500;

-- ---------------------------------------------------------------------------
-- 7. Comment reactions — react to a subset of the comments just created.
-- ---------------------------------------------------------------------------
insert into public.comment_reactions (drop_comment_id, user_id, emoji)
select cm.id, (select id from _seed_users where rn = (1 + floor(random() * 100)::int)), (array['❤️', '😂', '👍', '🔥', '🙏'])[1 + floor(random() * 5)::int]
from public.comments cm
where cm.content = 'Scale-test comment on drop.'
order by random()
limit 1800
on conflict do nothing;

insert into public.comment_reactions (capsule_comment_id, user_id, emoji)
select cc.id, (select id from _seed_users where rn = (1 + floor(random() * 100)::int)), (array['❤️', '😂', '👍', '🔥', '🙏'])[1 + floor(random() * 5)::int]
from public.capsule_comments cc
where cc.content = 'Scale-test comment on capsule.'
order by random()
limit 900
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 8. Likes — ~4000 on unlocked Drops, ~2000 on unlocked Capsules.
-- ---------------------------------------------------------------------------
insert into public.likes (post_id, user_id)
select p.id, (select id from _seed_users where rn = (1 + floor(random() * 100)::int))
from public.posts p, generate_series(1, 6)
where p.unlock_date <= now() and p.caption like 'Scale-test drop%'
order by random()
limit 4000
on conflict do nothing;

insert into public.capsule_likes (capsule_id, user_id)
select c.id, (select id from _seed_users where rn = (1 + floor(random() * 100)::int))
from public.capsules c, generate_series(1, 6)
where c.unlock_date <= now() and c.title like 'Scale-test capsule%'
order by random()
limit 2000
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 9. Bookmarks — ~400 saved Drops, ~200 saved Capsules ("many
--    bookmarks").
-- ---------------------------------------------------------------------------
insert into public.saved_posts (post_id, user_id)
select p.id, (select id from _seed_users where rn = (1 + floor(random() * 100)::int))
from public.posts p, generate_series(1, 2)
where p.unlock_date <= now() and p.caption like 'Scale-test drop%'
order by random()
limit 400
on conflict do nothing;

insert into public.capsule_saves (capsule_id, user_id)
select c.id, (select id from _seed_users where rn = (1 + floor(random() * 100)::int))
from public.capsules c, generate_series(1, 2)
where c.unlock_date <= now() and c.title like 'Scale-test capsule%'
order by random()
limit 200
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 10. Collections + Favorites — one "Scale Test Favorites" collection
--     per seeded user, with a few unlocked Drops/Capsules filed into it,
--     plus a separate spread of plain favorites (independent of
--     collection membership, same as the real feature).
-- ---------------------------------------------------------------------------
insert into public.memory_collections (user_id, name, icon)
select id, 'Scale Test Favorites', '⭐'
from _seed_users
on conflict do nothing;

insert into public.collection_items (collection_id, drop_id)
select mc.id, p.id
from public.memory_collections mc
join _seed_users u on u.id = mc.user_id
join lateral (
  select id from public.posts where user_id = u.id and unlock_date <= now() and caption like 'Scale-test drop%' order by random() limit 2
) p on true
where mc.name = 'Scale Test Favorites'
on conflict do nothing;

insert into public.collection_items (collection_id, capsule_id)
select mc.id, c.id
from public.memory_collections mc
join _seed_users u on u.id = mc.user_id
join lateral (
  select id from public.capsules where user_id = u.id and unlock_date <= now() and title like 'Scale-test capsule%' order by random() limit 1
) c on true
where mc.name = 'Scale Test Favorites'
on conflict do nothing;

insert into public.favorites (user_id, drop_id)
select (select id from _seed_users where rn = (1 + floor(random() * 100)::int)), p.id
from public.posts p
where p.unlock_date <= now() and p.caption like 'Scale-test drop%'
order by random()
limit 300
on conflict do nothing;

insert into public.favorites (user_id, capsule_id)
select (select id from _seed_users where rn = (1 + floor(random() * 100)::int)), c.id
from public.capsules c
where c.unlock_date <= now() and c.title like 'Scale-test capsule%'
order by random()
limit 200
on conflict do nothing;

drop table if exists _seed_users;

-- Done. Sanity-check counts:
--   select count(*) from public.profiles where username like 'scaletest\_%' escape '\';
--   select count(*) from public.profiles where username like 'scaletest\_%' escape '\' and is_private;
--   select count(*) from public.posts where caption like 'Scale-test drop%';
--   select count(*) from public.moments where text_content like 'Scale-test moment%';
--   select count(*) from public.capsules where title like 'Scale-test capsule%';
--   select count(*) from public.user_blocks ub
--     join public.profiles p on p.id = ub.blocker_id
--     where p.username like 'scaletest\_%' escape '\';
