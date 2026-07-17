import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Video, PenLine } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useMoments } from '../../hooks/useMoments';
import { EmptyMomentsState } from './EmptyMomentsState';
import { formatRelativeTime } from '../../utils/date';
import type { Moment, MomentMediaType } from '../../types/moment';

const TYPE_ICONS: Record<MomentMediaType, typeof ImageIcon> = { photo: ImageIcon, video: Video, text: PenLine };

interface MomentArchiveProps {
  onOpenMoment: (momentId: string) => void;
  refreshKey?: number;
}

// Only ever your own moments, active or expired — this is the "owner
// archive" the expiration rules promise: nothing here becomes visible to
// anyone else once it's expired, this view is just for you.
export const MomentArchive: React.FC<MomentArchiveProps> = ({ onOpenMoment, refreshKey }) => {
  const { user } = useAuth();
  const { getUserMoments } = useMoments();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    getUserMoments(user.id, true).then(data => { if (!cancelled) { setMoments(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [user, getUserMoments, refreshKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="aspect-[9/16] rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
      </div>
    );
  }

  if (moments.length === 0) return <EmptyMomentsState variant="archive" />;

  const sorted = [...moments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {sorted.map(m => {
        const Icon = TYPE_ICONS[m.media_type];
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onOpenMoment(m.id)}
            className="relative aspect-[9/16] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 group"
          >
            {m.media_url ? (
              m.media_type === 'video' ? (
                <video src={m.media_url} className="w-full h-full object-cover" muted />
              ) : (
                <img src={m.media_url} alt="" className="w-full h-full object-cover" />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-purple-50 dark:bg-purple-950/30 p-2">
                <p className="text-[10px] text-gray-600 text-center line-clamp-4">{m.text_content}</p>
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center">
              <Icon size={11} aria-hidden="true" />
            </span>
            {m.is_expired && (
              <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] text-white/90 bg-black/50 rounded-full px-2 py-0.5 truncate">
                {formatRelativeTime(m.created_at)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
