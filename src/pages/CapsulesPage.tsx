import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Clock, Lock, Hourglass, Unlock, Archive as ArchiveIcon, LayoutList } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCapsules } from '../hooks/useCapsules';
import { useMemories } from '../hooks/useMemories';
import { Button } from '../components/ui/Button';
import { CapsuleArchive } from '../components/capsules/CapsuleArchive';
import { CapsuleTimeline } from '../components/capsules/CapsuleTimeline';
import { CapsuleWizard } from '../components/capsules/CapsuleWizard';
import { EmptyState } from '../components/ui/EmptyState';
import { EMPTY_CAPSULE_FILTERS, type Capsule } from '../types/capsule';

const SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface SectionProps {
  title: string;
  icon: typeof Lock;
  capsules: Capsule[];
  loading: boolean;
  emptyLabel: string;
  onDeleted: (id: string) => void;
}

const CapsuleSection: React.FC<SectionProps> = ({ title, icon: Icon, capsules, loading, emptyLabel, onDeleted }) => (
  <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm p-4 flex flex-col gap-3">
    <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
      <Icon size={15} className="text-purple-500" aria-hidden="true" />
      {title}
      {!loading && <span className="text-xs font-normal text-gray-400">({capsules.length})</span>}
    </h2>
    {loading ? (
      <div className="h-24 rounded-xl bg-gray-50 animate-pulse" />
    ) : capsules.length === 0 ? (
      <p className="text-xs text-gray-400">{emptyLabel}</p>
    ) : (
      <CapsuleTimeline capsules={capsules} onDeleted={onDeleted} />
    )}
  </div>
);

// "My Archive" — every capsule you've ever sealed. The default view is
// four labeled lifecycle sections (Locked / Unlocking Soon / Unlocked /
// Archived) rather than one flat list, so the countdown-to-open journey
// this app is built around is visible at a glance; "Browse & Search"
// switches to the full filterable timeline for when you need to find
// something specific.
export const CapsulesPage: React.FC = () => {
  const { user } = useAuth();
  const { getUserCapsules } = useCapsules();
  const { getArchivedMemories } = useMemories();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mode, setMode] = useState<'overview' | 'browse'>('overview');

  const [locked, setLocked] = useState<Capsule[]>([]);
  const [unlocked, setUnlocked] = useState<Capsule[]>([]);
  const [archived, setArchived] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [lockedData, unlockedData, archivedData] = await Promise.all([
      getUserCapsules(user.id, { ...EMPTY_CAPSULE_FILTERS, lockStatus: 'locked' }, 50, 0),
      getUserCapsules(user.id, { ...EMPTY_CAPSULE_FILTERS, lockStatus: 'unlocked' }, 12, 0),
      getArchivedMemories(50, 0),
    ]);
    setLocked(lockedData);
    setUnlocked(unlockedData);
    setArchived(archivedData.filter(m => m.memory_type === 'capsule').map(m => ({
      id: m.id, user_id: m.user_id, username: m.username, display_name: m.display_name, profile_photo_url: m.profile_photo_url,
      is_private: false, title: m.title, memory_text: m.caption, memory_types: m.memory_types, media: m.media, mood: m.mood,
      visibility: m.visibility, unlock_date: m.matured_at, is_unlocked: m.is_unlocked, has_opened: true, is_owner: m.is_own,
      like_count: m.like_count, is_liked: false, comment_count: m.comment_count, save_count: 0, is_saved: false,
      share_count: 0, created_at: m.created_at,
    } satisfies Capsule)));
    setLoading(false);
  }, [user, getUserCapsules, getArchivedMemories]);

  useEffect(() => { if (mode === 'overview') loadOverview(); }, [mode, refreshKey, loadOverview]);

  const now = Date.now();
  const unlockingSoon = locked.filter(c => new Date(c.unlock_date).getTime() - now <= SOON_WINDOW_MS);
  const stillLocked = locked.filter(c => new Date(c.unlock_date).getTime() - now > SOON_WINDOW_MS);

  const removeFrom = (setter: React.Dispatch<React.SetStateAction<Capsule[]>>) => (id: string) => setter(prev => prev.filter(c => c.id !== id));

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 -mx-4 px-4 -mt-6 pt-6 pb-6 bg-gradient-to-b from-purple-50/60 via-transparent to-transparent min-h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Clock size={20} className="text-purple-500" aria-hidden="true" />
            Time Capsules
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Memories you've sent into the future.</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setWizardOpen(true)}>
          <Plus size={15} aria-hidden="true" />
          New Capsule
        </Button>
      </div>

      <div className="flex bg-white/70 backdrop-blur-xl rounded-xl p-1 gap-1 border border-white/60 shadow-sm w-fit">
        <button
          type="button"
          onClick={() => setMode('overview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'overview' ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white' : 'text-gray-500'}`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setMode('browse')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'browse' ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white' : 'text-gray-500'}`}
        >
          <LayoutList size={12} aria-hidden="true" /> Browse & Search
        </button>
      </div>

      {mode === 'browse' ? (
        <CapsuleArchive key={refreshKey} userId={user.id} isOwnArchive />
      ) : (
        <div className="flex flex-col gap-4">
          <CapsuleSection title="Unlocking Soon" icon={Hourglass} capsules={unlockingSoon} loading={loading} emptyLabel="Nothing unlocking in the next 7 days." onDeleted={removeFrom(setLocked)} />
          <CapsuleSection title="Locked" icon={Lock} capsules={stillLocked} loading={loading} emptyLabel="No capsules sealed further out." onDeleted={removeFrom(setLocked)} />
          <CapsuleSection title="Unlocked" icon={Unlock} capsules={unlocked} loading={loading} emptyLabel="Nothing opened yet." onDeleted={removeFrom(setUnlocked)} />
          {archived.length > 0 && (
            <CapsuleSection title="Archived" icon={ArchiveIcon} capsules={archived} loading={loading} emptyLabel="" onDeleted={removeFrom(setArchived)} />
          )}
          {!loading && locked.length === 0 && unlocked.length === 0 && (
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm">
              <EmptyState icon={Clock} title="No capsules yet" description="Create your first Time Capsule — a memory you send into the future." />
            </div>
          )}
        </div>
      )}

      <CapsuleWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
};
