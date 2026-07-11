import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { SettingsSection } from './SettingsSection';
import { SettingsCard } from './SettingsCard';
import { ThemeSelector } from './ThemeSelector';
import { ColorThemeSelector } from './ColorThemeSelector';
import { ToggleRow } from './ToggleRow';

// "Reduce animations" here and Accessibility's "Reduced motion" toggle
// are the same underlying setting shown in two places, not two separate
// preferences — a request to slow the whole app down doesn't need to be
// made twice depending on which menu you found it in.
export const AppearanceSettings: React.FC = () => {
  const { reducedMotion, setReducedMotion } = useTheme();

  return (
    <SettingsSection title="Appearance" description="How Memory Drop looks.">
      <SettingsCard title="Theme">
        <ThemeSelector />
      </SettingsCard>
      <SettingsCard title="Color theme" description="Changes the accent color across the whole app.">
        <ColorThemeSelector />
      </SettingsCard>
      <SettingsCard>
        <ToggleRow
          label="Reduce animations"
          description="Fewer transitions and motion effects throughout the app."
          checked={reducedMotion}
          onChange={setReducedMotion}
        />
      </SettingsCard>
    </SettingsSection>
  );
};
