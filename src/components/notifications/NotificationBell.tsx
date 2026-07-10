import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { EmptyState } from '../ui/EmptyState';
import type { Notification } from '../../types/notification';

const PREVIEW_SIZE = 6;

// Desktop Navbar's bell — badge count is the same visual pattern
// Friends' pending-request badge already established (absolute-
// positioned red circle on the icon). The dropdown is a lightweight
// preview (6 most recent); the full Activity Center at /notifications
// is where every other requirement (sections, filters, archive, undo,
// pagination) actually lives — this never tries to duplicate it.
export const NotificationBell: React.FC = () => {
  const { unreadCount, getNotifications, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getNotifications('all', PREVIEW_SIZE, 0).then(data => { setItems(data); setLoading(false); });
  }, [open, getNotifications]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleOpenItem = (id: string, wasUnread: boolean) => {
    if (wasUnread) {
      markRead(id);
      setItems(prev => prev.map(i => (i.id === id ? { ...i, is_read: true } : i)));
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex items-center gap-1.5 p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
      >
        <Bell size={16} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" aria-label="Notifications" className="absolute right-0 top-12 w-80 max-w-[90vw] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => { markAllRead(); setItems(prev => prev.map(i => ({ ...i, is_read: true }))); }}
                className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700"
              >
                <CheckCheck size={12} aria-hidden="true" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col gap-2 p-3">{[0, 1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-gray-50 dark:bg-gray-800 animate-pulse" />)}</div>
            ) : items.length === 0 ? (
              <EmptyState icon={Bell} title="Nothing yet" description="Activity from people you're connected to will show up here." />
            ) : (
              <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
                {items.map(n => (
                  <NotificationItem key={n.id} notification={n} dense onOpen={() => handleOpenItem(n.id, !n.is_read)} />
                ))}
              </div>
            )}
          </div>

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-medium text-purple-600 hover:text-purple-700 py-3 border-t border-gray-100 dark:border-gray-800"
          >
            See all
          </Link>
        </div>
      )}
    </div>
  );
};
