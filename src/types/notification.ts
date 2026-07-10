// Phase 11 — Notifications & Activity Center. Mirrors get_notifications()'s
// exact return shape (supabase/phase11_notifications.sql) — a flat row per
// notification with the actor's profile info already joined in, since
// profiles RLS never lets the client join that itself.
export type NotificationType =
  | 'new_follower' | 'follow_request' | 'follow_accepted' | 'mention'
  | 'drop_save_to_unlock' | 'drop_good_vibes' | 'drop_cant_wait' | 'drop_interested'
  | 'drop_unlock_viewed' | 'drop_liked' | 'drop_commented' | 'drop_replied' | 'drop_reflected'
  | 'moment_viewed' | 'moment_replied' | 'moment_reacted'
  | 'capsule_unlock_reminder' | 'capsule_unlocked' | 'capsule_viewed' | 'capsule_liked'
  | 'capsule_commented' | 'capsule_replied' | 'capsule_reflected'
  | 'weekly_recap' | 'security_alert' | 'password_changed' | 'new_login' | 'product_announcement';

export type NotificationEntityType = 'drop' | 'capsule' | 'moment' | 'comment' | 'user' | 'system';

export interface Notification {
  id: string;
  actor_id: string | null;
  actor_username: string | null;
  actor_display_name: string | null;
  actor_profile_photo_url: string | null;
  type: NotificationType;
  entity_type: NotificationEntityType;
  entity_id: string | null;
  title: string;
  body: string | null;
  is_read: boolean;
  is_archived: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type NotificationFilter = 'all' | 'unread' | 'read' | 'archived';

export const NOTIFICATION_FILTERS: { id: NotificationFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' },
  { id: 'archived', label: 'Archived' },
];

// Client-side time-bucketing for the "Today / Yesterday / This Week /
// Earlier" section headers — no server-side grouping needed, this is
// purely a display concern over already-sorted (newest-first) rows.
export type TimeBucket = 'today' | 'yesterday' | 'this_week' | 'earlier';

export const TIME_BUCKET_LABELS: Record<TimeBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  earlier: 'Earlier',
};

export const getTimeBucket = (isoDate: string): TimeBucket => {
  const date = new Date(isoDate);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  if (date >= startOfToday) return 'today';
  if (date >= startOfYesterday) return 'yesterday';
  if (date >= startOfWeek) return 'this_week';
  return 'earlier';
};

// Where tapping a notification should navigate — deliberately narrow:
// only ever links to a real, existing route. A missing/deleted target
// is handled by the destination page's own normal "not found" state,
// not by this function (see useNotifications.ts's resolveNotificationLink).
export const buildNotificationLink = (n: Pick<Notification, 'type' | 'entity_type' | 'entity_id' | 'actor_username'>): string | null => {
  if (n.entity_type === 'user' && n.actor_username) return `/u/${n.actor_username}`;
  if (n.entity_type === 'system') return n.type === 'security_alert' || n.type === 'password_changed' || n.type === 'new_login' ? '/settings/security' : null;
  if (!n.entity_id) return null;
  if (n.entity_type === 'drop') return `/drop/${n.entity_id}`;
  if (n.entity_type === 'capsule') return `/capsules/${n.entity_id}`;
  if (n.entity_type === 'moment') return `/moments/${n.entity_id}`;
  return null;
};
