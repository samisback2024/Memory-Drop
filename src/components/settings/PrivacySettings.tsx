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
import type { ManagedUser } from '../../types/settings';

type ListKind = 'blocked' | 'muted' | 'restricted' | 'close_friends';

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
  const { unblockUser, unmuteUser, unrestrictUser, searchUsers } = useSocial();
  const { getBlockedUsers, getMutedUsers, getRestrictedUsers, getCloseFriends, addCloseFriend, removeCloseFriend, deleteAllContent } = useSettings();

  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false);
  const [lists, setLists] = useState<Record<ListKind, ManagedUser[]>>({ blocked: [], muted: [], restricted: [], close_friends: [] });
  const [loading, setLoading] = useState<Record<ListKind, boolean>>({ blocked: true, muted: true, restricted: true, close_friends: true });
  const [friendQuery, setFriendQuery] = useState('');
  const [friendResults, setFriendResults] = useState<{ id: string; username: string; display_name: string | null; profile_photo_url: string | null }[]>([]);
  const [deleteAllStatus, setDeleteAllStatus] = useState<string | null>(null);

  const loadList = async (kind: ListKind) => {
    setLoading(prev => ({ ...prev, [kind]: true }));
    const fetcher = kind === 'blocked' ? getBlockedUsers : kind === 'muted' ? getMutedUsers : kind === 'restricted' ? getRestrictedUsers : getCloseFriends;
    const data = await fetcher();
    setLists(prev => ({ ...prev, [kind]: data }));
    setLoading(prev => ({ ...prev, [kind]: false }));
  };

  useEffect(() => { (['blocked', 'muted', 'restricted', 'close_friends'] as ListKind[]).forEach(loadList); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePrivate = async (next: boolean) => {
    setIsPrivate(next);
    await updateProfile({ isPrivate: next });
  };

  const handleUnblock = async (id: string) => { await unblockUser(id); setLists(prev => ({ ...prev, blocked: prev.blocked.filter(u => u.id !== id) })); };
  const handleUnmute = async (id: string) => { await unmuteUser(id); setLists(prev => ({ ...prev, muted: prev.muted.filter(u => u.id !== id) })); };
  const handleUnrestrict = async (id: string) => { await unrestrictUser(id); setLists(prev => ({ ...prev, restricted: prev.restricted.filter(u => u.id !== id) })); };
  const handleRemoveCloseFriend = async (id: string) => { await removeCloseFriend(id); setLists(prev => ({ ...prev, close_friends: prev.close_friends.filter(u => u.id !== id) })); };

  useEffect(() => {
    if (!friendQuery.trim()) { setFriendResults([]); return; }
    const timer = setTimeout(() => { searchUsers(friendQuery).then(r => setFriendResults(r.slice(0, 5))); }, 250);
    return () => clearTimeout(timer);
  }, [friendQuery, searchUsers]);

  const handleAddCloseFriend = async (id: string) => {
    await addCloseFriend(id);
    setFriendQuery('');
    setFriendResults([]);
    loadList('close_friends');
  };

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
          description="Only accepted followers can see your public-visibility content."
          checked={isPrivate}
          onChange={togglePrivate}
        />
      </SettingsCard>

      <SettingsCard title="Close Friends" description="Memories set to Close-Friends-only visibility are only visible to people on this list.">
        <div className="relative">
          <input
            type="text"
            value={friendQuery}
            onChange={e => setFriendQuery(e.target.value)}
            placeholder="Search a username to add…"
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {friendResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden">
              {friendResults.map(u => (
                <button key={u.id} type="button" onClick={() => handleAddCloseFriend(u.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <Avatar src={u.profile_photo_url} name={u.display_name || u.username} size="xs" />
                  <span className="text-sm text-gray-800 dark:text-gray-200">@{u.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <ManagedList users={lists.close_friends} loading={loading.close_friends} emptyLabel="Nobody's on your Close Friends list yet." actionLabel="Remove" onRemove={handleRemoveCloseFriend} />
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
