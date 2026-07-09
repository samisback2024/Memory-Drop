import React from 'react';
import { Ear } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { SettingsSection } from './SettingsSection';
import { SettingsCard } from './SettingsCard';
import { ToggleRow } from './ToggleRow';
import { FONT_SIZE_META } from '../../types/settings';
import type { FontSize } from '../../types/settings';

const FONT_SIZES = Object.keys(FONT_SIZE_META) as FontSize[];

export const AccessibilitySettings: React.FC = () => {
  const { fontSize, setFontSize, highContrast, setHighContrast, reducedMotion, setReducedMotion, largerTouchTargets, setLargerTouchTargets } = useTheme();

  return (
    <SettingsSection title="Accessibility" description="These apply everywhere in the app immediately, not just in Settings.">
      <SettingsCard title="Font size">
        <div className="grid grid-cols-4 gap-2">
          {FONT_SIZES.map(size => (
            <button
              key={size}
              type="button"
              onClick={() => setFontSize(size)}
              className={[
                'py-2.5 rounded-xl border text-xs font-medium transition-colors',
                fontSize === size ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 text-purple-700 dark:text-purple-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400',
              ].join(' ')}
            >
              {FONT_SIZE_META[size].label}
            </button>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard>
        <div className="flex flex-col gap-4">
          <ToggleRow label="High contrast" description="Stronger contrast between text and backgrounds." checked={highContrast} onChange={setHighContrast} />
          <ToggleRow label="Reduced motion" description="Fewer transitions and motion effects — same setting as Appearance's 'Reduce animations.'" checked={reducedMotion} onChange={setReducedMotion} />
          <ToggleRow label="Larger touch targets" description="Bigger buttons and tap areas throughout the app." checked={largerTouchTargets} onChange={setLargerTouchTargets} />
        </div>
      </SettingsCard>

      <SettingsCard>
        <div className="flex items-start gap-2.5">
          <Ear size={16} className="text-purple-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Screen reader support</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Every button, image, and control in Memory Drop is labeled for screen readers — not a setting to turn on, just how it's built.</p>
          </div>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
};
