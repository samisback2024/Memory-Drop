import React, { useEffect, useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { SettingsSection } from './SettingsSection';
import { SettingsCard } from './SettingsCard';
import { ToggleRow } from './ToggleRow';
import { NOTIFICATION_PREFERENCE_META } from '../../types/settings';
import type { NotificationPreferences } from '../../types/settings';

type PreferenceKey = keyof Omit<NotificationPreferences, 'user_id' | 'created_at' | 'updated_at'>;

const PREFERENCE_ORDER: PreferenceKey[] = [
  'unlock_reminders', 'new_followers', 'follow_requests', 'messages', 'message_requests', 'mentions', 'comments', 'reactions', 'replies', 'weekly_recap', 'security_alerts', 'product_updates',
];

// Real delivery since Phase 11 — every trigger that creates a
// notification checks the matching column here first (see
// supabase/phase11_notifications.sql's create_notification()), so
// turning one of these off genuinely stops that category from ever
// reaching the Activity Center, not just a cosmetic preference.
export const NotificationSettings: React.FC = () => {
  const { getNotificationPreferences, updateNotificationPreferences } = useSettings();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => { getNotificationPreferences().then(setPrefs); }, [getNotificationPreferences]);

  if (!prefs) {
    return (
      <SettingsSection title="Notification Preferences" description="Choose what you'd want to hear about.">
        <div className="h-40 rounded-2xl bg-white/60 dark:bg-gray-900/60 animate-pulse" />
      </SettingsSection>
    );
  }

  const toggle = (key: PreferenceKey) => async (checked: boolean) => {
    setPrefs(prev => (prev ? { ...prev, [key]: checked } : prev));
    await updateNotificationPreferences({ [key]: checked });
  };

  return (
    <SettingsSection title="Notification Preferences" description="Choose what you'd want to hear about in your Activity Center.">
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
