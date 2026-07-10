import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useMoments } from '../../hooks/useMoments';
import { MomentBubble } from './MomentBubble';
import type { MomentTrayItem } from '../../types/moment';

interface AuthorGroup {
  userId: string;
  name: string;
  photoUrl: string | null;
  hasUnviewed: boolean;
}

interface MomentTrayProps {
  onCreate: () => void;
  onOpenAuthor: (userId: string) => void;
  refreshKey?: number;
}

// Not an Instagram story rail: no merged "your story + add" bubble, no
// gap-free carousel. A dedicated "Add Moment" bubble always leads, and
// everyone with an active moment — including you, if you have one —
// gets a separate bubble grouped by author, ring lit up only while
// something of theirs is still unviewed.
export const MomentTray: React.FC<MomentTrayProps> = ({ onCreate, onOpenAuthor, refreshKey }) => {
  const { user } = useAuth();
  const { getMomentsTray } = useMoments();
  const [items, setItems] = useState<MomentTrayItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMomentsTray().then(data => { if (!cancelled) { setItems(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [getMomentsTray, refreshKey]);

  const groups = useMemo<AuthorGroup[]>(() => {
    const order: string[] = [];
    const map = new Map<string, AuthorGroup>();
    for (const item of items) {
      const existing = map.get(item.user_id);
      if (!existing) {
        order.push(item.user_id);
        map.set(item.user_id, {
          userId: item.user_id,
          name: item.display_name || item.username,
          photoUrl: item.profile_photo_url,
          hasUnviewed: !item.is_viewed,
        });
      } else if (!item.is_viewed) {
        existing.hasUnviewed = true;
      }
    }
    return order.map(id => map.get(id)!);
  }, [items]);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse flex-shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1" role="list" aria-label="Moments">
      <button
        type="button"
        onClick={onCreate}
        aria-label="Add Moment"
        className="flex flex-col items-center gap-1.5 w-16 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-2xl py-1"
      >
        <span className="w-16 h-16 rounded-full border-2 border-dashed border-purple-300 dark:border-purple-700 bg-purple-50/60 dark:bg-purple-950/30 flex items-center justify-center">
          <Plus size={22} className="text-purple-500" aria-hidden="true" />
        </span>
        <span className="text-xs text-gray-600 dark:text-gray-300 truncate w-full text-center">Add Moment</span>
      </button>

      {groups.map(group => (
        <MomentBubble
          key={group.userId}
          name={group.name}
          photoUrl={group.photoUrl}
          hasUnviewed={group.hasUnviewed}
          label={group.userId === user?.id ? 'You' : group.name.split(' ')[0]}
          onClick={() => onOpenAuthor(group.userId)}
        />
      ))}
    </div>
  );
};
