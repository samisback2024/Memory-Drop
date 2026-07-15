import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useMoments } from '../../hooks/useMoments';
import { Avatar } from '../ui/Avatar';
import type { MomentTrayItem } from '../../types/moment';

interface AuthorGroup {
  userId: string;
  name: string;
  photoUrl: string | null;
  hasUnviewed: boolean;
}

interface MomentSidebarProps {
  onCreate: () => void;
  onOpenAuthor: (userId: string) => void;
  refreshKey?: number;
}

// A vertical rail on the left, not a top-of-feed story tray — same
// gradient-ring "still has something unviewed" language ProfileHeader's
// own avatar-with-moments indicator already uses, just applied here per
// person instead of per profile. One tap opens that person's moments
// directly (MomentViewer), same as the old tray did.
export const MomentSidebar: React.FC<MomentSidebarProps> = ({ onCreate, onOpenAuthor, refreshKey }) => {
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

  return (
    <div className="flex flex-col items-center gap-3 w-14 flex-shrink-0 pt-1" role="list" aria-label="Moments">
      <button
        type="button"
        onClick={onCreate}
        aria-label="Add Moment"
        className="flex flex-col items-center gap-1 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-2xl"
      >
        <span className="w-11 h-11 rounded-2xl border-2 border-dashed border-purple-300 dark:border-purple-700 bg-purple-50/60 dark:bg-purple-950/30 flex items-center justify-center">
          <Plus size={16} className="text-purple-500" aria-hidden="true" />
        </span>
        <span className="text-[10px] text-gray-500 dark:text-gray-400">Add</span>
      </button>

      {loading ? (
        [0, 1, 2].map(i => <div key={i} className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse flex-shrink-0" />)
      ) : (
        groups.map(group => {
          const label = group.userId === user?.id ? 'You' : group.name.split(' ')[0];
          return (
            <button
              key={group.userId}
              type="button"
              onClick={() => onOpenAuthor(group.userId)}
              aria-label={`View ${label}'s moments`}
              className="flex flex-col items-center gap-1 max-w-full focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-2xl"
            >
              <span
                className={[
                  'rounded-2xl p-[2.5px] flex-shrink-0',
                  group.hasUnviewed ? 'bg-gradient-to-br from-purple-500 via-fuchsia-500 to-blue-500' : 'bg-gray-200 dark:bg-gray-700',
                ].join(' ')}
              >
                <Avatar src={group.photoUrl} name={group.name} size="md" shape="square" className="border-2 border-white dark:border-gray-900" />
              </span>
              <span className="text-[10px] text-gray-600 dark:text-gray-300 truncate w-full text-center">{label}</span>
            </button>
          );
        })
      )}
    </div>
  );
};
