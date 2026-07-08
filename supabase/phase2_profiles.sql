-- Memory Drop — Phase 2: Profiles
-- Run once, after supabase/phase1_auth.sql, in the Supabase SQL editor.
-- Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- 1. profiles: rename avatar_url -> profile_photo_url, drop is_demo,
--    add the new Phase 2 columns
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar_url'
  ) then
    alter table public.profiles rename column avatar_url to profile_photo_url;
  end if;
end $$;

alter table public.profiles drop column if exists is_demo;

alter table public.profiles
  add column if not exists bio text,
  add column if not exists is_private boolean not null default false,
  add column if not exists profile_completed boolean not null default false;

-- profile_photo_url and updated_at already exist from Phase 1 (the former
-- just renamed above); listed in the Phase 2 spec for completeness.

alter table public.profiles drop constraint if exists bio_length;
alter table public.profiles add constraint bio_length check (bio is null or char_length(bio) <= 150);

alter table public.profiles drop constraint if exists display_name_length;
alter table public.profiles add constraint display_name_length
  check (display_name is null or char_length(display_name) <= 50);

-- ---------------------------------------------------------------------------
-- 2. profile_completed is derived, not client-set — recomputed on every
--    write so it can't drift from the data that actually backs it.
--    Completion = username + display name + bio + photo all present.
-- ---------------------------------------------------------------------------
create or replace function public.compute_profile_completed()
returns trigger
language plpgsql
as $$
begin
  new.profile_completed :=
    coalesce(length(trim(new.username)), 0) > 0
    and coalesce(length(trim(new.display_name)), 0) > 0
    and coalesce(length(trim(new.bio)), 0) > 0
    and coalesce(length(trim(new.profile_photo_url)), 0) > 0;
  return new;
end;
$$;

drop trigger if exists set_profile_completed on public.profiles;
create trigger set_profile_completed
  before insert or update on public.profiles
  for each row
  execute function public.compute_profile_completed();

-- ---------------------------------------------------------------------------
-- 3. Public profile lookup by username, privacy-aware.
--
--    This becomes the *only* sanctioned way to read someone else's profile.
--    It's a SECURITY DEFINER function, so it bypasses RLS on purpose: it's
--    the one place that's allowed to decide, column by column, what a
--    private account exposes (bio hidden, everything else shown — same
--    convention as Instagram). See the RLS change in step 4, which removes
--    the old "anyone can select the raw row" policy so this function is
--    genuinely the only path, not just the recommended one.
-- ---------------------------------------------------------------------------
create or replace function public.get_profile_by_username(p_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  profile_photo_url text,
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
    p.is_private,
    p.profile_completed,
    p.created_at,
    (p.id = auth.uid()) as is_own_profile
  from public.profiles p
  where p.username = lower(p_username);
$$;

grant execute on function public.get_profile_by_username(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS: tighten SELECT to "own row only" now that get_profile_by_username
--    is the real public-read path. (Phase 1 had a broad "select true" policy
--    before privacy existed — replacing it here.) Insert/update policies are
--    unchanged from Phase 1.
-- ---------------------------------------------------------------------------
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 5. Storage: avatars bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Objects are stored at `{user_id}/{filename}` — the folder-name check below
-- is what makes "users can only upload/update/delete their own avatar" hold.
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
