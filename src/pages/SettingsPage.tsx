import React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  User, UserCircle, Lock, ShieldCheck, Bell, Palette, Accessibility, HardDrive, LifeBuoy, Info, ChevronRight,
} from 'lucide-react';
import { AccountSettings } from '../components/settings/AccountSettings';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { PrivacySettings } from '../components/settings/PrivacySettings';
import { SecuritySettings } from '../components/settings/SecuritySettings';
import { NotificationSettings } from '../components/settings/NotificationSettings';
import { AppearanceSettings } from '../components/settings/AppearanceSettings';
import { AccessibilitySettings } from '../components/settings/AccessibilitySettings';
import { StorageSettings } from '../components/settings/StorageSettings';
import { HelpSettings } from '../components/settings/HelpSettings';
import { AboutSettings } from '../components/settings/AboutSettings';

const SECTIONS: { id: string; label: string; description: string; icon: typeof User }[] = [
  { id: 'account', label: 'Account', description: 'Email, password, username, delete account', icon: User },
  { id: 'profile', label: 'Profile', description: 'Display name, bio, default visibility', icon: UserCircle },
  { id: 'privacy', label: 'Privacy', description: 'Private account, blocking, close friends', icon: Lock },
  { id: 'security', label: 'Security', description: 'Sessions, two-factor, sign out everywhere', icon: ShieldCheck },
  { id: 'notifications', label: 'Notifications', description: 'What you’d want to hear about', icon: Bell },
  { id: 'appearance', label: 'Appearance', description: 'Light, dark, or system theme', icon: Palette },
  { id: 'accessibility', label: 'Accessibility', description: 'Font size, contrast, motion, touch targets', icon: Accessibility },
  { id: 'storage', label: 'Storage', description: 'What you’re using, and how to manage it', icon: HardDrive },
  { id: 'help', label: 'Help & Support', description: 'FAQ, bug reports, feedback', icon: LifeBuoy },
  { id: 'about', label: 'About', description: 'Version, legal, credits', icon: Info },
];

const SECTION_COMPONENTS: Record<string, React.FC> = {
  account: AccountSettings,
  profile: ProfileSettings,
  privacy: PrivacySettings,
  security: SecuritySettings,
  notifications: NotificationSettings,
  appearance: AppearanceSettings,
  accessibility: AccessibilitySettings,
  storage: StorageSettings,
  help: HelpSettings,
  about: AboutSettings,
};

// One page, ten sections, drilled into by :section rather than ten
// separate route files — the list-then-detail shape every mobile
// settings app uses, not a wall of tabs.
export const SettingsPage: React.FC = () => {
  const { section } = useParams<{ section?: string }>();

  if (section && SECTION_COMPONENTS[section]) {
    const SectionComponent = SECTION_COMPONENTS[section];
    return <SectionComponent />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your account, your privacy, your app.</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden divide-y divide-gray-50 dark:divide-gray-800 transition-colors">
        {SECTIONS.map(({ id, label, description, icon: Icon }) => (
          <Link
            key={id}
            to={`/settings/${id}`}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center flex-shrink-0">
              <Icon size={16} className="text-purple-600 dark:text-purple-400" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
              <p className="text-xs text-gray-400 truncate">{description}</p>
            </div>
            <ChevronRight size={15} className="text-gray-300 flex-shrink-0" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
};
