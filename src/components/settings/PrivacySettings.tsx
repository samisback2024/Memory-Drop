import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSocial } from '../../hooks/useSocial';
import { useSettings } from '../../hooks/useSettings';
import { SettingsSection } from './SettingsSection';
import { SettingsCard } from './SettingsCard';
import { ToggleRow } from './ToggleRow';
import { DangerZone } from './DangerZone';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { MESSAGING_PRIVACY_META } from '../../types/message';
import { setAnalyticsEnabled as setAnalyticsEnabledCache } from '../../lib/analytics';
import type { MessagingPrivacy } from '../../types/message';
import { PROFILE_STAT_META, type ManagedUser, type ProfileStatKey } from '../../types/settings';

const PROFILE_STAT_KEYS = Object.keys(PROFILE_STAT_META) as ProfileStatKey[];

const MESSAGING_PRIVACY_OPTIONS: MessagingPrivacy[] = ['everyone', 'followers', 'mutual_followers', 'nobody'];

type ListKind = 'blocked' | 'muted' | 'restricted';

const ManagedList: React.FC<{
  users: ManagedUser[];
  loading: boolean;
  emptyLabel: string;
  actionLabel: string;
  onRemove: (id: string) => void;
}> = ({ users, loading, emptyLabel, actionLabel, onRemove }) => {
  if (loading) return <div className="h-12 rounded-xl bg-gray-50 dark:bg-gray-800 animate-pulse" />;
  if (users.length === 0) return <p className="text-xs text-gray-400">{emptyLabel}</p>;
  return (
    <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
      {users.map(u => (
        <div key={u.id} className="flex items-center gap-3 py-2.5">
          <Avatar src={u.profile_photo_url} name={u.display_name || u.username} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{u.display_name || u.username}</p>
            <p className="text-xs text-gray-400 truncate">@{u.username}</p>
          </div>
          <button type="button" onClick={() => onRemove(u.id)} className="text-xs font-medium text-purple-600 hover:text-purple-700 flex-shrink-0">
            {actionLabel}
          </button>
        </div>
      ))}
    </div>
  );
};

export const PrivacySettings: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  const { unblockUser, unmuteUser, unrestrictUser } = useSocial();
  const { getBlockedUsers, getMutedUsers, getRestrictedUsers, deleteAllContent, getSettings, updateSettings } = useSettings();

  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false);
  const [messagingPrivacy, setMessagingPrivacy] = useState<MessagingPrivacy | null>(null);
  const [allowMessageRequests, setAllowMessageRequests] = useState(true);
  const [showInterestCounts, setShowInterestCounts] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabledState] = useState(true);
  // null until getSettings() resolves — ToggleRow only reads `checked`
  // as its initial state (it doesn't re-sync on prop changes), so this
  // gates rendering the checklist until the real saved values are in,
  // rather than briefly showing everything unchecked for a returning
  // user who already opted some stats in.
  const [visibleStats, setVisibleStats] = useState<ProfileStatKey[] | null>(null);
  const [lists, setLists] = useState<Record<ListKind, ManagedUser[]>>({ blocked: [], muted: [], restricted: [] });
  const [loading, setLoading] = useState<Record<ListKind, boolean>>({ blocked: true, muted: true, restricted: true });
  const [deleteAllStatus, setDeleteAllStatus] = useState<string | null>(null);

  const loadList = async (kind: ListKind) => {
    setLoading(prev => ({ ...prev, [kind]: true }));
    const fetcher = kind === 'blocked' ? getBlockedUsers : kind === 'muted' ? getMutedUsers : getRestrictedUsers;
    const data = await fetcher();
    setLists(prev => ({ ...prev, [kind]: data }));
    setLoading(prev => ({ ...prev, [kind]: false }));
  };

  useEffect(() => { (['blocked', 'muted', 'restricted'] as ListKind[]).forEach(loadList); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getSettings().then(s => {
      if (!s) return;
      setMessagingPrivacy(s.messaging_privacy);
      setAllowMessageRequests(s.allow_message_requests);
      setShowInterestCounts(s.show_interest_counts);
      setAnalyticsEnabledState(s.analytics_enabled);
      setVisibleStats((s.visible_stats ?? []) as ProfileStatKey[]);
    });
  }, [getSettings]);

  const togglePrivate = async (next: boolean) => {
    setIsPrivate(next);
    await updateProfile({ isPrivate: next });
  };

  const handleMessagingPrivacyChange = async (next: MessagingPrivacy) => {
    setMessagingPrivacy(next);
    await updateSettings({ messaging_privacy: next });
  };

  const handleAllowRequestsChange = async (next: boolean) => {
    setAllowMessageRequests(next);
    await updateSettings({ allow_message_requests: next });
  };

  const handleShowInterestCountsChange = async (next: boolean) => {
    setShowInterestCounts(next);
    await updateSettings({ show_interest_counts: next });
  };

  const handleAnalyticsChange = async (next: boolean) => {
    setAnalyticsEnabledState(next);
    setAnalyticsEnabledCache(next);
    await updateSettings({ analytics_enabled: next });
  };

  const handleStatVisibilityChange = async (key: ProfileStatKey, next: boolean) => {
    const updated = next ? [...(visibleStats ?? []), key] : (visibleStats ?? []).filter(k => k !== key);
    setVisibleStats(updated);
    await updateSettings({ visible_stats: updated });
  };

  const handleUnblock = async (id: string) => { await unblockUser(id); setLists(prev => ({ ...prev, blocked: prev.blocked.filter(u => u.id !== id) })); };
  const handleUnmute = async (id: string) => { await unmuteUser(id); setLists(prev => ({ ...prev, muted: prev.muted.filter(u => u.id !== id) })); };
  const handleUnrestrict = async (id: string) => { await unrestrictUser(id); setLists(prev => ({ ...prev, restricted: prev.restricted.filter(u => u.id !== id) })); };

  const handleDeleteAllContent = async () => {
    setDeleteAllStatus(null);
    const { error } = await deleteAllContent();
    setDeleteAllStatus(error ?? 'All your content has been deleted.');
  };

  return (
    <SettingsSection title="Privacy" description="Who can see you, and who can't.">
      <SettingsCard>
        <ToggleRow
          label="Private account"
          description="Only accepted Orbit members can see your public-visibility content."
          checked={isPrivate}
          onChange={togglePrivate}
        />
      </SettingsCard>

      <SettingsCard title="Who can message you" description="People outside this circle land in Message Requests instead of your main inbox.">
        <div className="flex flex-col gap-1.5">
          {MESSAGING_PRIVACY_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => handleMessagingPrivacyChange(option)}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
                messagingPrivacy === option
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{MESSAGING_PRIVACY_META[option].label}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{MESSAGING_PRIVACY_META[option].description}</span>
              </span>
              {messagingPrivacy === option && <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <ToggleRow
          label="Allow message requests"
          description="If off, people outside your circle can't message you at all — not even as a request."
          checked={allowMessageRequests}
          onChange={handleAllowRequestsChange}
        />
      </SettingsCard>

      <SettingsCard>
        <ToggleRow
          label="Show reaction counts on locked drops"
          description="Interested / Can't Wait / Good Vibes / Saved to Unlock counts on your still-locked drops. If off, only you see your own counts — everyone else still sees the buttons, just no numbers."
          checked={showInterestCounts}
          onChange={handleShowInterestCountsChange}
        />
      </SettingsCard>

      <SettingsCard title="Blocked users">
        <ManagedList users={lists.blocked} loading={loading.blocked} emptyLabel="You haven't blocked anyone." actionLabel="Unblock" onRemove={handleUnblock} />
      </SettingsCard>

      <SettingsCard title="Muted users">
        <ManagedList users={lists.muted} loading={loading.muted} emptyLabel="You haven't muted anyone." actionLabel="Unmute" onRemove={handleUnmute} />
      </SettingsCard>

      <SettingsCard title="Restricted users">
        <ManagedList users={lists.restricted} loading={loading.restricted} emptyLabel="You haven't restricted anyone." actionLabel="Unrestrict" onRemove={handleUnrestrict} />
      </SettingsCard>

      <SettingsCard title="Analytics" description="Helps us understand what's working — never shared with a third party.">
        <ToggleRow
          label="Share usage analytics"
          description="Signups, Drops/Capsules/Moments created, unlocks, orbits, searches, and shares — stored only in Memory Drop's own database, never sold or sent to an outside analytics company."
          checked={analyticsEnabled}
          onChange={handleAnalyticsChange}
        />
      </SettingsCard>

      <SettingsCard title="Profile stats visibility" description="Your Memory Stats card is always private to you. Check any of these to also show them on your public profile — everything starts unchecked.">
        {visibleStats === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 rounded-xl bg-gray-50 dark:bg-gray-800 animate-pulse" />)}
          </div>
        ) : (
          PROFILE_STAT_KEYS.map(key => (
            <ToggleRow
              key={key}
              label={PROFILE_STAT_META[key].label}
              description={PROFILE_STAT_META[key].description}
              checked={visibleStats.includes(key)}
              onChange={next => handleStatVisibilityChange(key, next)}
            />
          ))
        )}
      </SettingsCard>

      <SettingsCard title="Download my data" description="A full export of your memories and account data.">
        <Button variant="outline" size="sm" disabled className="self-start">
          <Download size={13} aria-hidden="true" /> Coming soon
        </Button>
      </SettingsCard>

      <DangerZone
        title="Delete all my data"
        description="Deletes every Drop, Moment, and Capsule you've made — your account itself stays active. This cannot be undone."
        actionLabel="Delete all my data"
        onConfirm={handleDeleteAllContent}
      />
      {deleteAllStatus && <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">{deleteAllStatus}</p>}
    </SettingsSection>
  );
};
