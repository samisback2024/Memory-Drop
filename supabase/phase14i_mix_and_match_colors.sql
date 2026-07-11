-- Phase 14i — mix-and-match color themes, replacing the 4 fixed pairs
-- from phase14h with independently selectable primary/secondary hues.
--
-- Product feedback on phase14h's 4 preset pairs: more options, and let
-- people mix rather than being locked to a fixed pairing. Rather than
-- keep adding paired presets, color_theme becomes two independent
-- columns — any of 12 named hues for the primary slot, any of the same
-- 12 for the secondary slot (see src/index.css for the full ramps:
-- classic_purple, classic_blue, navy, claret, cornflower, terracotta,
-- royal_blue, scarlet, amber, graphite, forest, plum — the last four
-- are new, designed around this app's own concept rather than more
-- red/white/blue variants: amber for the unlock-reveal moment,
-- graphite for a clean minimal-professional option, forest and plum
-- for two more editorial/calm directions).

alter table public.user_settings drop constraint if exists user_settings_color_theme_check;
alter table public.user_settings drop column if exists color_theme;

alter table public.user_settings add column if not exists color_theme_primary text not null default 'classic_purple';
alter table public.user_settings add column if not exists color_theme_secondary text not null default 'classic_blue';

alter table public.user_settings drop constraint if exists user_settings_color_theme_primary_check;
alter table public.user_settings add constraint user_settings_color_theme_primary_check check (
  color_theme_primary in ('classic_purple', 'classic_blue', 'navy', 'claret', 'cornflower', 'terracotta', 'royal_blue', 'scarlet', 'amber', 'graphite', 'forest', 'plum')
) not valid;
alter table public.user_settings validate constraint user_settings_color_theme_primary_check;

alter table public.user_settings drop constraint if exists user_settings_color_theme_secondary_check;
alter table public.user_settings add constraint user_settings_color_theme_secondary_check check (
  color_theme_secondary in ('classic_purple', 'classic_blue', 'navy', 'claret', 'cornflower', 'terracotta', 'royal_blue', 'scarlet', 'amber', 'graphite', 'forest', 'plum')
) not valid;
alter table public.user_settings validate constraint user_settings_color_theme_secondary_check;
