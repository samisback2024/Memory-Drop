import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit3, Globe2, Users, Lock, Heart } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { SettingsSection } from './SettingsSection';
import { SettingsCard } from './SettingsCard';
import { Button } from '../ui/Button';
import type { Visibility } from '../../types/feed';
import type { MomentPrivacy } from '../../types/moment';

const DROP_VISIBILITY_OPTIONS: { value: Visibility; label: string; icon: typeof Globe2 }[] = [
  { value: 'public', label: 'Public', icon: Globe2 },
  { value: 'followers', label: 'Followers', icon: Users },
  { value: 'private', label: 'Only me', icon: Lock },
];

const MOMENT_VISIBILITY_OPTIONS: { value: MomentPrivacy; label: string; icon: typeof Globe2 }[] = [
  { value: 'everyone', label: 'Everyone', icon: Globe2 },
  { value: 'followers', label: 'Followers', icon: Users },
  { value: 'close_friends', label: 'Close Friends', icon: Heart },
  { value: 'only_me', label: 'Only me', icon: Lock },
];

// Display name, bio, avatar, and cover photo already have a full,
// dedicated editor (Phase 2's EditProfilePage) — duplicating that UI
// here would just be two places doing the same job. Settings' Profile
// section is only the two things Phase 2 never had anywhere to live:
// the defaults new Drops and Moments start with.
export const ProfileSettings: React.FC = () => {
  const { getSettings, updateSettings } = useSettings();
  const [dropVisibility, setDropVisibility] = useState<Visibility>('public');
  const [momentVisibility, setMomentVisibility] = useState<MomentPrivacy>('everyone');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then(settings => {
      if (settings) {
        setDropVisibility(settings.default_drop_visibility);
        setMomentVisibility(settings.default_moment_visibility);
      }
      setLoading(false);
    });
  }, [getSettings]);

  const pickDropVisibility = (value: Visibility) => {
    setDropVisibility(value);
    updateSettings({ default_drop_visibility: value });
  };

  const pickMomentVisibility = (value: MomentPrivacy) => {
    setMomentVisibility(value);
    updateSettings({ default_moment_visibility: value });
  };

  return (
    <SettingsSection title="Profile" description="How you present yourself, and what new memories default to.">
      <SettingsCard>
        <Link to="/profile/edit">
          <Button variant="outline" size="sm">
            <Edit3 size={13} aria-hidden="true" /> Edit display name, bio, avatar & cover photo
          </Button>
        </Link>
      </SettingsCard>

      {!loading && (
        <>
          <SettingsCard title="Default Drop visibility" description="What a new Drop's visibility starts as — you can still change it per-drop.">
            <div className="flex gap-2">
              {DROP_VISIBILITY_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => pickDropVisibility(value)}
                  className={[
                    'flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-colors',
                    dropVisibility === value ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 text-purple-700 dark:text-purple-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400',
                  ].join(' ')}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </SettingsCard>

          <SettingsCard title="Default Moment visibility" description="What a new Moment's visibility starts as.">
            <div className="grid grid-cols-2 gap-2">
              {MOMENT_VISIBILITY_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => pickMomentVisibility(value)}
                  className={[
                    'flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-colors',
                    momentVisibility === value ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 text-purple-700 dark:text-purple-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400',
                  ].join(' ')}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </SettingsCard>
        </>
      )}
    </SettingsSection>
  );
};
