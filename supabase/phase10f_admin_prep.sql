-- Memory Drop — Phase 10f: Admin Preparation.
-- Run once, after supabase/phase10d_comments_reactions.sql, in the
-- Supabase SQL editor. Safe to re-run — every statement is idempotent.
--
-- Last of six Phase 10 sub-phases. Explicitly architecture only, per
-- the brief: "No admin UI yet. Just architecture." Nothing in this file
-- is reachable from the app today — there is no admin UI, and
-- `is_admin` defaults to `false` for every existing account, so
-- `moderate_content()`/`get_content_reports()` currently have zero
-- real-world callers. That's intentional, not incomplete: this phase
-- proves out the schema and the two entry points a future admin tool
-- would need, without taking on the risk of also building that tool or
-- (see Known limitations) sweeping every existing read RPC to enforce
-- moderation status before there's any UI that could ever set it to
-- anything but 'active'.
--
-- What an audit found before writing this: reporting was Drop-only
-- (`reports`, a one-way mailbox with no SELECT policy at all — Capsules
-- and Moments had no equivalent); there was no admin/moderator role
-- concept anywhere in the schema; and there was no soft-delete anywhere
-- — every deletion is a hard, cascading DELETE, which is fine for a
-- user deleting their own content but wrong for moderation (it destroys
-- the evidence a review process would need). This phase adds exactly
-- three things to close those gaps, architecturally:
--   1. `profiles.is_admin` — the role concept itself.
--   2. `capsule_reports` / `moment_reports` — parity with Drops' existing
--      `reports`, same one-way-mailbox shape.
--   3. `moderation_status` (+ audit columns) on posts/capsules/moments,
--      changeable only through `moderate_content()`, and
--      `get_content_reports()` as the unified read side a future
--      dashboard would query.

-- ---------------------------------------------------------------------------
-- 1. profiles.is_admin — the role concept. Nothing reads this column
--    anywhere yet except the two functions below, both of which reject
--    a non-admin caller outright.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. capsule_reports / moment_reports — same shape as Drops' existing
--    `reports` (phase4_feed.sql): one-way mailbox, no SELECT policy at
--    all, not even for the reporter. Kept as separate per-content-type
--    tables rather than one polymorphic table, matching this app's own
--    established convention (capsule_likes/capsule_comments/
--    capsule_saves already mirror Drops' equivalents the same way).
-- ---------------------------------------------------------------------------
create table if not exists public.capsule_reports (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'violence', 'nudity', 'fake_account', 'other')),
  details text check (details is null or char_length(details) <= 500),
  created_at timestamptz not null default now(),
  constraint unique_capsule_report unique (capsule_id, reporter_id)
);

create index if not exists capsule_reports_capsule_idx on public.capsule_reports (capsule_id);

alter table public.capsule_reports enable row level security;

drop policy if exists "Users can report capsules" on public.capsule_reports;
create policy "Users can report capsules"
  on public.capsule_reports for insert
  with check (auth.uid() = reporter_id);

create table if not exists public.moment_reports (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'violence', 'nudity', 'fake_account', 'other')),
  details text check (details is null or char_length(details) <= 500),
  created_at timestamptz not null default now(),
  constraint unique_moment_report unique (moment_id, reporter_id)
);

create index if not exists moment_reports_moment_idx on public.moment_reports (moment_id);

alter table public.moment_reports enable row level security;

drop policy if exists "Users can report moments" on public.moment_reports;
create policy "Users can report moments"
  on public.moment_reports for insert
  with check (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- 3. moderation_status + audit columns on posts/capsules/moments.
--    'active' (default, normal) / 'hidden' (soft, reversible — content
--    persists, a future admin UI would exclude it from public reads) /
--    'removed' (soft-delete equivalent — the auditable alternative to a
--    hard DELETE, which destroys evidence a review process would need).
--    The only way this can change is moderate_content() below — there
--    is deliberately no direct-UPDATE RLS policy for these columns, so
--    "how did this get set" always has exactly one answer.
-- ---------------------------------------------------------------------------
alter table public.posts add column if not exists moderation_status text not null default 'active' check (moderation_status in ('active', 'hidden', 'removed'));
alter table public.posts add column if not exists moderated_at timestamptz;
alter table public.posts add column if not exists moderated_by uuid references public.profiles(id) on delete set null;
alter table public.posts add column if not exists moderation_reason text;

alter table public.capsules add column if not exists moderation_status text not null default 'active' check (moderation_status in ('active', 'hidden', 'removed'));
alter table public.capsules add column if not exists moderated_at timestamptz;
alter table public.capsules add column if not exists moderated_by uuid references public.profiles(id) on delete set null;
alter table public.capsules add column if not exists moderation_reason text;

alter table public.moments add column if not exists moderation_status text not null default 'active' check (moderation_status in ('active', 'hidden', 'removed'));
alter table public.moments add column if not exists moderated_at timestamptz;
alter table public.moments add column if not exists moderated_by uuid references public.profiles(id) on delete set null;
alter table public.moments add column if not exists moderation_reason text;

create or replace function public.moderate_content(p_content_type text, p_content_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Only an admin can moderate content.';
  end if;
  if p_status not in ('active', 'hidden', 'removed') then
    raise exception 'Invalid moderation status.';
  end if;

  if p_content_type = 'drop' then
    update posts set moderation_status = p_status, moderated_at = now(), moderated_by = auth.uid(), moderation_reason = p_reason where id = p_content_id;
  elsif p_content_type = 'capsule' then
    update capsules set moderation_status = p_status, moderated_at = now(), moderated_by = auth.uid(), moderation_reason = p_reason where id = p_content_id;
  elsif p_content_type = 'moment' then
    update moments set moderation_status = p_status, moderated_at = now(), moderated_by = auth.uid(), moderation_reason = p_reason where id = p_content_id;
  else
    raise exception 'Unknown content type: %', p_content_type;
  end if;
end;
$$;

grant execute on function public.moderate_content(text, uuid, text, text) to authenticated;

-- get_content_reports() — the unified read side a future moderation
-- dashboard would query: one normalized shape across all three report
-- tables, admin-only. Non-admins get an empty result (a raised
-- exception is friendlier to build a UI against than a silent []),
-- matching moderate_content()'s own guard above.
create or replace function public.get_content_reports(p_limit int default 50, p_offset int default 0)
returns table (
  content_type text,
  content_id uuid,
  report_id uuid,
  reporter_id uuid,
  reporter_username text,
  reason text,
  details text,
  reported_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Only an admin can view content reports.';
  end if;

  return query
    select * from (
      select 'drop'::text, r.post_id, r.id, r.reporter_id, pr.username, r.reason, r.details, r.created_at
      from reports r join profiles pr on pr.id = r.reporter_id

      union all

      select 'capsule'::text, cr.capsule_id, cr.id, cr.reporter_id, pr.username, cr.reason, cr.details, cr.created_at
      from capsule_reports cr join profiles pr on pr.id = cr.reporter_id

      union all

      select 'moment'::text, mr.moment_id, mr.id, mr.reporter_id, pr.username, mr.reason, mr.details, mr.created_at
      from moment_reports mr join profiles pr on pr.id = mr.reporter_id
    ) as all_reports(content_type, content_id, report_id, reporter_id, reporter_username, reason, details, reported_at)
    order by reported_at desc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.get_content_reports(int, int) to authenticated;
