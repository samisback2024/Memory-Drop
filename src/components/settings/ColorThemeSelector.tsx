import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { COLOR_THEME_META, type ColorTheme } from '../../types/settings';

const OPTIONS = Object.keys(COLOR_THEME_META) as ColorTheme[];

// A swatch (not an icon) is the point here — color is the whole
// decision. Applies instantly via data-color-theme on <html> (see
// useTheme.tsx/index.css), same no-reload pattern ThemeSelector uses
// for light/dark.
export const ColorThemeSelector: React.FC = () => {
  const { colorTheme, setColorTheme } = useTheme();

  return (
    <div role="radiogroup" aria-label="Color theme" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {OPTIONS.map(value => {
        const meta = COLOR_THEME_META[value];
        const active = colorTheme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setColorTheme(value)}
            className={[
              'flex flex-col items-center gap-2 py-3 px-2 rounded-xl border text-center transition-colors',
              active ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
            ].join(' ')}
          >
            <span className="flex -space-x-1.5">
              <span className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800" style={{ backgroundColor: meta.primary }} aria-hidden="true" />
              <span className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800" style={{ backgroundColor: meta.secondary }} aria-hidden="true" />
            </span>
            <span className={`text-xs font-medium ${active ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-200'}`}>{meta.label}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{meta.description}</span>
          </button>
        );
      })}
    </div>
  );
};
