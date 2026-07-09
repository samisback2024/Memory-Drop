import React, { useEffect, useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { SettingsSection } from './SettingsSection';
import { SettingsCard } from './SettingsCard';
import { ToggleRow } from './ToggleRow';
import { NOTIFICATION_PREFERENCE_META } from '../../types/settings';
import type { NotificationPreferences } from '../../types/settings';

type PreferenceKey = keyof Omit<NotificationPreferences, 'user_id' | 'created_at' | 'updated_at'>;

const PREFERENCE_ORDER: PreferenceKey[] = [
  'unlock_reminders', 'new_followers', 'follow_requests', 'comments', 'reactions', 'replies', 'weekly_recap', 'product_updates',
];

// Store-only, per this phase's own scope — there's no push delivery yet
// (that's a later phase), but every toggle here is real and persisted,
// so nothing needs re-asking once notifications actually ship.
export const NotificationSettings: React.FC = () => {
  const { getNotificationPreferences, updateNotificationPreferences } = useSettings();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => { getNotificationPreferences().then(setPrefs); }, [getNotificationPreferences]);

  if (!prefs) {
    return (
      <SettingsSection title="Notification Preferences" description="Choose what you'd want to hear about — delivery comes in a later phase.">
        <div className="h-40 rounded-2xl bg-white/60 dark:bg-gray-900/60 animate-pulse" />
      </SettingsSection>
    );
  }

  const toggle = (key: PreferenceKey) => async (checked: boolean) => {
    setPrefs(prev => (prev ? { ...prev, [key]: checked } : prev));
    await updateNotificationPreferences({ [key]: checked });
  };

  return (
    <SettingsSection title="Notification Preferences" description="Choose what you'd want to hear about — delivery comes in a later phase, but your choices are saved now.">
      <SettingsCard>
        <div className="flex flex-col gap-4">
          {PREFERENCE_ORDER.map(key => (
            <ToggleRow
              key={key}
              label={NOTIFICATION_PREFERENCE_META[key].label}
              description={NOTIFICATION_PREFERENCE_META[key].description}
              checked={prefs[key]}
              onChange={toggle(key)}
            />
          ))}
        </div>
      </SettingsCard>
    </SettingsSection>
  );
};
