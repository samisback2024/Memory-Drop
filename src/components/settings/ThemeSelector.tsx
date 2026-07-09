import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../types/settings';

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

// Applies instantly (dark class on <html>, no reload) and persists to
// user_settings. See the README for the honest scope of what dark mode
// currently covers — the core shell and Settings itself, not yet every
// page in the app.
export const ThemeSelector: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={[
            'flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-colors',
            theme === value ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 text-purple-700 dark:text-purple-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400',
          ].join(' ')}
        >
          <Icon size={16} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
};
