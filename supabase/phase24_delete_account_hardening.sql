-- Phase 24 — hardens delete_my_account() (phase8_settings.sql). Reported
-- live: tapping "Delete my account" after typing the DELETE confirm
-- phrase did nothing — no error, no redirect, account still there.
--
-- Two compounding bugs, one on each side:
--
-- 1. Frontend (src/components/settings/AccountSettings.tsx,
--    handleDeleteAccount): any error from the RPC was silently
--    discarded — `if (!error) navigate('/login')` with no else branch —
--    so a failed deletion was indistinguishable from nothing having
--    happened. Fixed separately in the same commit as this migration
--    to show the error via toast.
--
-- 2. Backend (this file): the original function was a single bare
--    `delete from auth.users where id = auth.uid()`, relying entirely
--    on every other auth-schema table's foreign key to auth.users
--    being ON DELETE CASCADE, and never checking whether the delete
--    actually affected a row. If any of those FKs aren't cascading in
--    this project (schema drift between Supabase versions is common
--    here), the delete fails outright; if `auth.uid()` doesn't match
--    for any reason, it "succeeds" having deleted nothing — either way
--    the old function returned normally with no error, which is
--    exactly the silent-no-op symptom reported. This version clears
--    the auth-schema rows that reference the user explicitly first
--    (belt-and-suspenders alongside whatever cascades are already
--    configured) and raises a real, visible error if the final delete
--    affects zero rows instead of quietly succeeding.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted int;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  -- Explicit, not relied-on-cascade-alone: every one of these is a
  -- standard Supabase auth-schema table keyed to auth.users.id.
  -- auth.refresh_tokens isn't listed here — it's keyed to
  -- auth.sessions.id and cascades when the session row above is
  -- removed.
  delete from auth.identities where user_id = v_uid;
  delete from auth.sessions where user_id = v_uid;
  delete from auth.mfa_factors where user_id = v_uid;
  delete from auth.one_time_tokens where user_id = v_uid;

  delete from auth.users where id = v_uid;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'Could not delete your account. Please try again or contact support.';
  end if;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
