import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, AtSign, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { useToast } from '../../hooks/useToast';
import { SettingsSection } from './SettingsSection';
import { SettingsCard } from './SettingsCard';
import { DangerZone } from './DangerZone';
import { Button } from '../ui/Button';
import { validateEmail, validatePassword, validateUsername, getUsernameCooldownDaysRemaining } from '../../lib/validators';

export const AccountSettings: React.FC = () => {
  const { user, profile, signOut, updateProfile } = useAuth();
  const { changeEmail, changePassword, deleteAccount } = useSettings();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [newEmail, setNewEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [newUsername, setNewUsername] = useState(profile?.username ?? '');
  const [usernameStatus, setUsernameStatus] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const cooldownDays = getUsernameCooldownDaysRemaining(profile?.username_changed_at ?? null);

  // On a fresh page load straight to /settings/account, useAuth's
  // profile fetch is still async when this component first mounts —
  // the useState initializer above runs before it resolves and never
  // re-syncs once it arrives, so the username field would silently
  // stay blank (and "Update username" would reject it as required)
  // even though the account clearly has one. Runs once, the first time
  // profile actually has data.
  const hydratedUsername = useRef(false);
  useEffect(() => {
    if (!profile || hydratedUsername.current) return;
    hydratedUsername.current = true;
    setNewUsername(profile.username ?? '');
  }, [profile]);

  const handleChangeEmail = async () => {
    setEmailError(null);
    setEmailStatus(null);
    const validationError = validateEmail(newEmail);
    if (validationError) { setEmailError(validationError); return; }
    const { error } = await changeEmail(newEmail);
    if (error) { setEmailError(error); return; }
    setEmailStatus('Check both your old and new email for a confirmation link.');
    setNewEmail('');
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordStatus(null);
    const validationError = validatePassword(newPassword);
    if (validationError) { setPasswordError(validationError); return; }
    setPasswordBusy(true);
    const { error } = await changePassword(currentPassword, newPassword);
    setPasswordBusy(false);
    if (error) { setPasswordError(error); return; }
    setPasswordStatus('Password updated.');
    setCurrentPassword('');
    setNewPassword('');
  };

  const handleChangeUsername = async () => {
    setUsernameError(null);
    setUsernameStatus(null);
    const validationError = validateUsername(newUsername);
    if (validationError) { setUsernameError(validationError); return; }
    const { error } = await updateProfile({ username: newUsername });
    if (error) { setUsernameError(error); return; }
    setUsernameStatus('Username updated.');
  };

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  const handleDeleteAccount = async () => {
    const { error } = await deleteAccount();
    // Previously silent on failure — DangerZone's confirm button would
    // just sit there with no feedback at all if the RPC errored (e.g. a
    // permissions issue on auth.users), indistinguishable from nothing
    // having happened. Now it's at least visible and actionable.
    if (error) { showToast(error, 'error'); return; }
    navigate('/login');
  };

  return (
    <SettingsSection title="Account" description="Your login details and account-level controls.">
      <SettingsCard title="Email" description={`Currently ${user?.email ?? '—'}`}>
        <div className="flex flex-col gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="New email address"
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {emailError && <p className="text-xs text-red-600">{emailError}</p>}
          {emailStatus && <p className="text-xs text-green-600">{emailStatus}</p>}
          <Button variant="outline" size="sm" onClick={handleChangeEmail} className="self-start">
            <Mail size={13} aria-hidden="true" /> Change email
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Password">
        <div className="flex flex-col gap-2">
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
          {passwordStatus && <p className="text-xs text-green-600">{passwordStatus}</p>}
          <Button variant="outline" size="sm" onClick={handleChangePassword} loading={passwordBusy} className="self-start">
            <Lock size={13} aria-hidden="true" /> Change password
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Username" description={cooldownDays > 0 ? `You can change it again in ${cooldownDays} day${cooldownDays === 1 ? '' : 's'}.` : 'You can change your username once every 30 days.'}>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            disabled={cooldownDays > 0}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          />
          {usernameError && <p className="text-xs text-red-600">{usernameError}</p>}
          {usernameStatus && <p className="text-xs text-green-600">{usernameStatus}</p>}
          <Button variant="outline" size="sm" onClick={handleChangeUsername} disabled={cooldownDays > 0} className="self-start">
            <AtSign size={13} aria-hidden="true" /> Update username
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard>
        <Button variant="outline" size="sm" onClick={handleSignOut} className="self-start">
          <LogOut size={13} aria-hidden="true" /> Log out
        </Button>
      </SettingsCard>

      <DangerZone
        title="Delete account"
        description="Permanently deletes your account and everything in it — drops, moments, capsules, memories, your Orbit, all of it. This cannot be undone."
        actionLabel="Delete my account"
        onConfirm={handleDeleteAccount}
      />
    </SettingsSection>
  );
};
