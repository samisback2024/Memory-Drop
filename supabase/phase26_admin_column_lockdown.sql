-- ---------------------------------------------------------------------------
-- Phase 26a — lock down profiles.is_admin against client self-grant
-- ---------------------------------------------------------------------------
-- profiles.is_admin (added in phase10f_admin_prep.sql) is gated only by the
-- row-level "Users can update their own profile" policy (phase1_auth.sql),
-- which is row-scoped, not column-scoped. Nothing stopped an authenticated
-- user from calling `supabase.from('profiles').update({is_admin: true})`
-- directly and self-granting admin, then using moderate_content()/
-- get_content_reports() (phase10f_admin_prep.sql) to read or act on other
-- users' reports. This trigger blocks any change to is_admin that doesn't
-- come from the service role (i.e. not through the client-facing
-- "authenticated" RLS path) — same "RLS decides rows, trigger decides
-- columns" pattern already used for username_changed_at
-- (enforce_username_cooldown, phase2b_profile_polish.sql).
create or replace function public.enforce_admin_column_lock()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.role() <> 'service_role' then
    raise exception 'is_admin cannot be changed from a client request.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists lock_admin_column on public.profiles;
create trigger lock_admin_column
  before update on public.profiles
  for each row
  execute function public.enforce_admin_column_lock();
