import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, Archive, Trash2, Mail, MailOpen, Loader2 } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useToast } from '../hooks/useToast';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { NotificationItem } from '../components/notifications/NotificationItem';
import { EmptyState } from '../components/ui/EmptyState';
import {
  NOTIFICATION_FILTERS, TIME_BUCKET_LABELS, getTimeBucket,
  type Notification, type NotificationFilter, type TimeBucket,
} from '../types/notification';

const PAGE_SIZE = 30;
const BUCKET_ORDER: TimeBucket[] = ['today', 'yesterday', 'this_week', 'earlier'];

// The Activity Center — every notification type funnels through the
// same get_notifications() RPC and renders through the same
// NotificationItem the bell dropdown uses. Time-bucket section headers
// (Today/Yesterday/This Week/Earlier) are a pure client-side grouping
// over an already newest-first-sorted list; the four filter tabs (All/
// Unread/Read/Archived) are what actually changes the underlying query.
export const NotificationsPage: React.FC = () => {
  const { getNotifications, markRead, markUnread, markAllRead, archive, unarchive, deleteNotification, unreadCount } = useNotifications();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getNotifications(filter, PAGE_SIZE, 0).then(data => {
      setItems(data);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
      // Landing on this page is the read signal now — same reasoning as
      // the bell dropdown. `items` still holds the original is_read
      // values, so the unread highlight/dot survives for this one visit.
      if (data.some(n => !n.is_read)) markAllRead();
    });
  }, [filter, getNotifications, markAllRead]);

  useEffect(() => { load(); }, [load]);

  const { pulling, distance, refreshing } = usePullToRefresh(load, true);

  const loadMore = () => {
    setLoadingMore(true);
    getNotifications(filter, PAGE_SIZE, items.length).then(data => {
      setItems(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setLoadingMore(false);
    });
  };

  const removeFromList = (id: string) => setItems(prev => prev.filter(n => n.id !== id));

  const handleToggleRead = async (n: Notification) => {
    setItems(prev => prev.map(i => (i.id === n.id ? { ...i, is_read: !i.is_read } : i)));
    if (n.is_read) await markUnread(n.id);
    else await markRead(n.id);
  };

  const handleArchive = async (n: Notification) => {
    removeFromList(n.id);
    await archive(n.id, !n.is_read);
    showToast('Notification archived.', 'success', {
      label: 'Undo',
      onClick: async () => { await unarchive(n.id); setItems(prev => [n, ...prev]); },
    });
  };

  const handleDelete = async (n: Notification) => {
    removeFromList(n.id);
    await deleteNotification(n.id);
    showToast('Notification deleted.', 'success', {
      label: 'Undo',
      onClick: () => {
        // A delete is a real DELETE, not a flag — "undo" re-creates a
        // client-side placeholder row rather than actually restoring
        // the deleted database row (there's nothing left to restore).
        // Good enough for "I didn't mean to dismiss that," not a true
        // undo of the delete itself.
        setItems(prev => [n, ...prev]);
        showToast('Restored to this list only — it was already deleted.', 'error');
      },
    });
  };

  const grouped = useMemo(() => {
    const buckets: Record<TimeBucket, Notification[]> = { today: [], yesterday: [], this_week: [], earlier: [] };
    for (const n of items) buckets[getTimeBucket(n.created_at)].push(n);
    return buckets;
  }, [items]);

  return (
    <div className="flex flex-col gap-4">
      {(pulling || refreshing) && (
        <div className="flex justify-center items-center overflow-hidden transition-[height]" style={{ height: refreshing ? 36 : distance }}>
          <Loader2 size={20} className={refreshing ? 'text-purple-500 animate-spin' : 'text-purple-400'} style={{ opacity: refreshing ? 1 : Math.min(distance / 70, 1) }} aria-hidden="true" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Bell size={18} className="text-purple-500" aria-hidden="true" />
            Notifications
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">What's happened across your Drops, Capsules, and Moments.</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => { markAllRead(); setItems(prev => prev.map(n => ({ ...n, is_read: true }))); }}
            className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 flex-shrink-0"
          >
            <CheckCheck size={14} aria-hidden="true" /> Mark all read
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Notification filters" className="flex bg-white dark:bg-gray-900 rounded-xl p-1 gap-1 border border-gray-100 dark:border-gray-800 shadow-sm overflow-x-auto">
        {NOTIFICATION_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={[
              'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              'focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
              filter === id ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? 'All caught up' : filter === 'archived' ? 'Nothing archived' : 'Nothing yet'}
            description={filter === 'unread' ? 'No unread notifications right now.' : filter === 'archived' ? 'Notifications you archive land here.' : 'Activity from people you\'re connected to will show up here.'}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {BUCKET_ORDER.filter(b => grouped[b].length > 0).map(bucket => (
            <div key={bucket} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              <h2 className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                {TIME_BUCKET_LABELS[bucket]}
              </h2>
              <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
                {grouped[bucket].map(n => (
                  <div key={n.id} className="flex items-center">
                    <div className="flex-1 min-w-0">
                      <NotificationItem notification={n} onOpen={() => { if (!n.is_read) handleToggleRead(n); }} />
                    </div>
                    <div className="flex items-center gap-0.5 pr-3 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleRead(n)}
                        aria-label={n.is_read ? 'Mark as unread' : 'Mark as read'}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
                      >
                        {n.is_read ? <Mail size={14} aria-hidden="true" /> : <MailOpen size={14} aria-hidden="true" />}
                      </button>
                      {filter !== 'archived' ? (
                        <button
                          type="button"
                          onClick={() => handleArchive(n)}
                          aria-label="Archive"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
                        >
                          <Archive size={14} aria-hidden="true" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => { removeFromList(n.id); await unarchive(n.id); }}
                          aria-label="Unarchive"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
                        >
                          <Archive size={14} className="fill-current" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(n)}
                        aria-label="Delete"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="self-center text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50 py-2"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
