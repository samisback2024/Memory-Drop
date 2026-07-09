import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut, Trash2 } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { SettingsSection } from './SettingsSection';
import { SettingsCard } from './SettingsCard';
import { SessionList } from './SessionList';
import { Button } from '../ui/Button';
import { formatDate } from '../../utils/date';

export const SecuritySettings: React.FC = () => {
  const { getSettings, signOutAllDevices, clearSessionHistory } = useSettings();
  const navigate = useNavigate();
  const [passwordChangedAt, setPasswordChangedAt] = useState<string | null>(null);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { getSettings().then(s => setPasswordChangedAt(s?.password_changed_at ?? null)); }, [getSettings]);

  const handleSignOutAll = async () => {
    setSigningOutAll(true);
    const { error } = await signOutAllDevices();
    if (!error) navigate('/login');
    else setSigningOutAll(false);
  };

  const handleClearHistory = async () => {
    await clearSessionHistory();
    setRefreshKey(k => k + 1);
  };

  return (
    <SettingsSection title="Security" description="Keep your account safe.">
      <SettingsCard title="Password last changed">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {passwordChangedAt ? formatDate(passwordChangedAt) : "You haven't changed it from Settings yet."}
        </p>
      </SettingsCard>

      <SettingsCard
        title="Two-factor authentication"
        description="An extra layer of security when signing in. Coming soon — this is a preview of where it'll live."
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <ShieldCheck size={15} aria-hidden="true" /> Not enabled
          </span>
          <Button variant="outline" size="sm" disabled>Set up</Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Active sessions & login history" description="Devices and browsers you've signed into Memory Drop from.">
        <SessionList key={refreshKey} />
        <Button variant="ghost" size="sm" onClick={handleClearHistory} className="self-start !text-gray-400">
          <Trash2 size={12} aria-hidden="true" /> Clear history
        </Button>
      </SettingsCard>

      <SettingsCard title="Sign out everywhere" description="Ends every active session on every device, including this one.">
        <Button variant="outline" size="sm" onClick={handleSignOutAll} loading={signingOutAll} className="self-start">
          <LogOut size={13} aria-hidden="true" /> Sign out of all devices
        </Button>
      </SettingsCard>
    </SettingsSection>
  );
};
