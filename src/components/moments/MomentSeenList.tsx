import React, { useEffect, useState } from 'react';
import { Eye, X } from 'lucide-react';
import { useMoments } from '../../hooks/useMoments';
import { Avatar } from '../ui/Avatar';
import { formatRelativeTime } from '../../utils/date';
import type { MomentSeenEntry } from '../../types/moment';

interface MomentSeenListProps {
  isOpen: boolean;
  onClose: () => void;
  momentId: string;
  viewCount: number;
}

// Owner-only, by construction — get_moment_seen_list quietly returns
// nothing for anyone else, so this never needs to guard against being
// rendered for the wrong viewer.
export const MomentSeenList: React.FC<MomentSeenListProps> = ({ isOpen, onClose, momentId, viewCount }) => {
  const { getMomentSeenList } = useMoments();
  const [viewers, setViewers] = useState<MomentSeenEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    getMomentSeenList(momentId).then(data => { if (!cancelled) { setViewers(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [isOpen, momentId, getMomentSeenList]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl max-h-[70vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
            <Eye size={16} className="text-gray-400" aria-hidden="true" />
            Seen by {viewCount}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="py-1">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
          ) : viewers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No one has seen this moment yet.</p>
          ) : (
            viewers.map(v => (
              <div key={v.viewer_id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar src={v.profile_photo_url} name={v.display_name || v.username} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{v.display_name || v.username}</p>
                  <p className="text-xs text-gray-400 truncate">@{v.username}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatRelativeTime(v.viewed_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
