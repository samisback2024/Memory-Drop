import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useComments } from '../../hooks/useComments';
import { useDismissableMenu } from '../../hooks/useDismissableMenu';
import { Avatar } from '../ui/Avatar';
import type { CommentContentType, RecentLiker } from '../../types/comment';

interface RecentLikersPopoverProps {
  contentType: CommentContentType;
  contentId: string;
  count: number;
}

// "Recent reactions" — likes/capsule_likes' own SELECT policies are
// own-rows-only, so this goes through get_recent_likers() (Phase 10d),
// the same cross-user-read-needs-a-SECURITY-DEFINER-RPC pattern used
// everywhere else in this app. Tap the count to see who recently liked.
export const RecentLikersPopover: React.FC<RecentLikersPopoverProps> = ({ contentType, contentId, count }) => {
  const { getRecentLikers } = useComments();
  const [open, setOpen] = useState(false);
  const [likers, setLikers] = useState<RecentLiker[]>([]);
  const [loading, setLoading] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismissableMenu<HTMLSpanElement>(open, close);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (count === 0) return;
    if (!open) {
      setLoading(true);
      getRecentLikers(contentType, contentId, 10).then(data => { setLikers(data); setLoading(false); });
    }
    setOpen(p => !p);
  };

  if (count === 0) return <span>{''}</span>;

  return (
    <span className="relative" ref={ref}>
      <button type="button" onClick={toggle} className="hover:underline">{count}</button>
      {open && (
        <div className="absolute left-0 top-6 z-30 w-56 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-lg p-2 animate-fade-in">
          {loading ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1">Loading...</p>
          ) : likers.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1">No one yet.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {likers.map(l => (
                <Link key={l.user_id} to={`/u/${l.username}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
                  <Avatar src={l.profile_photo_url} name={l.display_name || l.username} size="xs" />
                  <span className="truncate">{l.display_name || l.username}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </span>
  );
};
