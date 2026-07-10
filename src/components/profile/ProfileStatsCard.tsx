import React, { useEffect, useState } from 'react';
import {
  Lock, Unlock, Archive, Bookmark, Globe2, Users, UserPlus, Eye, KeyRound, Heart, MessageCircle,
} from 'lucide-react';
import { useMemories } from '../../hooks/useMemories';
import type { MemoryStats } from '../../types/memory';

const TILES: { key: keyof MemoryStats; label: string; icon: typeof Lock }[] = [
  { key: 'total_drops', label: 'Drops', icon: Globe2 },
  { key: 'locked_items', label: 'Locked', icon: Lock },
  { key: 'unlocked_items', label: 'Unlocked', icon: Unlock },
  { key: 'expired_moments', label: 'Expired moments', icon: Archive },
  { key: 'saved_to_unlock', label: 'Saved to unlock', icon: Bookmark },
  { key: 'public_drops', label: 'Public drops', icon: Globe2 },
  { key: 'followers_count', label: 'Followers', icon: Users },
  { key: 'following_count', label: 'Following', icon: UserPlus },
  { key: 'total_views', label: 'Views received', icon: Eye },
  { key: 'total_unlocks', label: 'Unlocks received', icon: KeyRound },
  { key: 'total_reactions', label: 'Reactions received', icon: Heart },
  { key: 'total_comments', label: 'Comments received', icon: MessageCircle },
];

// One live-aggregated RPC (get_memory_stats) behind every number here —
// never a separately-tracked counter that could quietly drift out of
// sync with what Feed/Capsules/Memories actually show.
export const ProfileStatsCard: React.FC = () => {
  const { getMemoryStats } = useMemories();
  const [stats, setStats] = useState<MemoryStats | null>(null);

  useEffect(() => { getMemoryStats().then(setStats); }, [getMemoryStats]);

  if (!stats) {
    return <div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-50 dark:bg-gray-800 animate-pulse" />)}</div>;
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {TILES.map(({ key, label, icon: Icon }) => (
        <div key={key} className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 dark:bg-gray-800 py-3 px-1 text-center">
          <Icon size={14} className="text-purple-500" aria-hidden="true" />
          <span className="text-base font-bold text-gray-900 dark:text-gray-100">{stats[key]}</span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{label}</span>
        </div>
      ))}
    </div>
  );
};
