-- Phase 29: switch the out-of-the-box color theme from classic purple/
-- blue to "Memory Gold" (graphite/amber) — see SIGNATURE_PAIRS in
-- src/types/settings.ts and the comment on index.css's :root block.
-- Only changes the column DEFAULT, so it only affects rows inserted
-- from now on (new signups); existing users keep whatever is already
-- stored in their own row, customized or not.

alter table public.user_settings alter column color_theme_primary set default 'graphite';
alter table public.user_settings alter column color_theme_secondary set default 'amber';
