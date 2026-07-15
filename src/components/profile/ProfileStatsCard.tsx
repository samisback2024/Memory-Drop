import React, { useEffect, useState } from 'react';
import {
  Lock, Unlock, Archive, Bookmark, Globe2, Users, UserPlus, Eye, KeyRound, MessageCircle, Star, Zap, Wand2,
} from 'lucide-react';
import { useMemories } from '../../hooks/useMemories';
import { SparkleDrop } from '../icons/SparkleDrop';
import type { MemoryStats } from '../../types/memory';

// A Lucide icon's own type doesn't fit SparkleDrop (Memory Drop's own
// custom icon, not from Lucide) — this shape is the actual common
// surface every icon used below needs, Lucide or custom.
type IconComponent = React.ComponentType<{ size?: number | string; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

const TILES: { key: keyof MemoryStats; label: string; icon: IconComponent }[] = [
  { key: 'total_drops', label: 'Drops', icon: Globe2 },
  { key: 'locked_items', label: 'Locked', icon: Lock },
  { key: 'unlocked_items', label: 'Unlocked', icon: Unlock },
  { key: 'expired_moments', label: 'Expired moments', icon: Archive },
  { key: 'saved_to_unlock', label: 'Save to Unlock', icon: Bookmark },
  { key: 'public_drops', label: 'Public drops', icon: Globe2 },
  { key: 'orbiting_count', label: 'Orbiting You', icon: Users },
  { key: 'in_orbit_count', label: 'In Orbit', icon: UserPlus },
  { key: 'total_views', label: 'Views received', icon: Eye },
  { key: 'total_unlocks', label: 'Unlocks received', icon: KeyRound },
  { key: 'total_reactions', label: 'Reactions received', icon: SparkleDrop },
  { key: 'total_comments', label: 'Comments received', icon: MessageCircle },
  { key: 'interested_received', label: "I'm Interested", icon: Star },
  { key: 'cant_wait_received', label: "Can't Wait", icon: Zap },
  { key: 'good_vibes_received', label: 'Good Vibes', icon: Wand2 },
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
