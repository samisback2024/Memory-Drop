-- Phase 14h — selectable color themes.
--
-- Just a new preference column — the actual palettes live entirely in
-- the frontend (src/index.css CSS variables + tailwind.config.js
-- pointing purple/blue at them). This column is only "which one is
-- currently active," applied client-side via a data-color-theme
-- attribute on <html> (src/hooks/useTheme.tsx), same pattern the
-- existing `theme` (light/dark/system) column already uses.

alter table public.user_settings add column if not exists color_theme text not null default 'classic';

alter table public.user_settings drop constraint if exists user_settings_color_theme_check;
alter table public.user_settings add constraint user_settings_color_theme_check check (
  color_theme in ('classic', 'ink_claret', 'riviera', 'grand_prix')
) not valid;
alter table public.user_settings validate constraint user_settings_color_theme_check;
