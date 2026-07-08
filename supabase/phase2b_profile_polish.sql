-- Memory Drop — Phase 2 polish: cover photo, extended profile fields,
-- username change cooldown.
-- Run once, after supabase/phase2_profiles.sql, in the Supabase SQL editor.
-- Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- 1. New profile columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists website text,
  add column if not exists location text,
  add column if not exists pronouns text,
  add column if not exists cover_photo_url text,
  add column if not exists username_changed_at timestamptz;

alter table public.profiles drop constraint if exists website_length;
alter table public.profiles add constraint website_length check (website is null or char_length(website) <= 200);

alter table public.profiles drop constraint if exists website_format;
alter table public.profiles add constraint website_format check (website is null or website ~* '^https?://');

alter table public.profiles drop constraint if exists location_length;
alter table public.profiles add constraint location_length check (location is null or char_length(location) <= 60);

alter table public.profiles drop constraint if exists pronouns_length;
alter table public.profiles add constraint pronouns_length check (pronouns is null or char_length(pronouns) <= 30);

-- ---------------------------------------------------------------------------
-- 2. Username change cooldown — 30 days between changes.
--
--    This is the real enforcement (getUsernameCooldownDaysRemaining on the
--    client just mirrors it to warn the user before they waste a submit).
--    Going from no-username to a first username (OLD.username_changed_at is
--    null) is always allowed — this only throttles repeat changes.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_username_cooldown()
returns trigger
language plpgsql
as $$
begin
  if new.username is distinct from old.username then
    if old.username_changed_at is not null
       and now() - old.username_changed_at < interval '30 days' then
      raise exception 'Username can only be changed once every 30 days.'
        using errcode = 'P0001';
    end if;
    new.username_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists set_username_cooldown on public.profiles;
create trigger set_username_cooldown
  before update on public.profiles
  for each row
  execute function public.enforce_username_cooldown();

-- ---------------------------------------------------------------------------
-- 3. get_profile_by_username: return the new public fields, and extend the
--    privacy nulling (previously bio-only) to website/location/pronouns too.
--    profile_photo_url, cover_photo_url, username, display_name stay visible
--    even when private — same convention as before. date_of_birth is still
--    never selected here at all: birthday stays private unconditionally.
-- ---------------------------------------------------------------------------
-- Postgres won't let CREATE OR REPLACE change a function's return columns
-- (the RETURNS TABLE shape here grew by four columns) — has to be dropped
-- first.
drop function if exists public.get_profile_by_username(text);

create function public.get_profile_by_username(p_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  profile_photo_url text,
  cover_photo_url text,
  website text,
  location text,
  pronouns text,
  is_private boolean,
  profile_completed boolean,
  created_at timestamptz,
  is_own_profile boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    case when p.is_private and p.id <> auth.uid() then null else p.bio end as bio,
    p.profile_photo_url,
    p.cover_photo_url,
    case when p.is_private and p.id <> auth.uid() then null else p.website end as website,
    case when p.is_private and p.id <> auth.uid() then null else p.location end as location,
    case when p.is_private and p.id <> auth.uid() then null else p.pronouns end as pronouns,
    p.is_private,
    p.profile_completed,
    p.created_at,
    (p.id = auth.uid()) as is_own_profile
  from public.profiles p
  where p.username = lower(p_username);
$$;

grant execute on function public.get_profile_by_username(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Storage: covers bucket — same ownership pattern as avatars
--    ({user_id}/{filename} paths), larger size limit for a wider image.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 8388608, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Cover images are publicly accessible" on storage.objects;
create policy "Cover images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'covers');

drop policy if exists "Users can upload their own cover" on storage.objects;
create policy "Users can upload their own cover"
  on storage.objects for insert
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own cover" on storage.objects;
create policy "Users can update their own cover"
  on storage.objects for update
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own cover" on storage.objects;
create policy "Users can delete their own cover"
  on storage.objects for delete
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
