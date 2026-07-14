import React from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus, UserCheck, AtSign, Bookmark, Heart, Sparkles, Clock3, Unlock,
  MessageCircle, MessageSquare, Reply, Feather, Eye, Gift, Bell, ShieldAlert, KeyRound, LogIn, Megaphone,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { formatRelativeTime } from '../../utils/date';
import { buildNotificationLink, type Notification, type NotificationType } from '../../types/notification';

const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  new_orbiter: UserPlus, orbit_request: UserPlus, orbit_accepted: UserCheck, mention: AtSign,
  drop_save_to_unlock: Bookmark, drop_good_vibes: Sparkles, drop_cant_wait: Clock3, drop_interested: Heart,
  drop_unlock_viewed: Unlock, drop_liked: Heart, drop_commented: MessageCircle, drop_replied: Reply, drop_reflected: Feather,
  moment_viewed: Eye, moment_replied: Reply, moment_reacted: Sparkles,
  capsule_unlock_reminder: Clock3, capsule_unlocked: Gift, capsule_viewed: Eye, capsule_liked: Heart,
  capsule_commented: MessageCircle, capsule_replied: Reply, capsule_reflected: Feather,
  message_request: MessageSquare, new_message: MessageCircle, message_reaction: Sparkles,
  weekly_recap: Sparkles, security_alert: ShieldAlert, password_changed: KeyRound, new_login: LogIn, product_announcement: Megaphone,
};

interface NotificationItemProps {
  notification: Notification;
  onOpen?: () => void;
  dense?: boolean;
}

// One shared row behind both the bell dropdown preview and the full
// Activity Center list — clicking it marks the notification read (if
// it wasn't already) and navigates via buildNotificationLink(), which
// only ever points at a real route; the destination page's own normal
// "not found" state handles a since-deleted target, so a stale
// notification can never produce a broken link, just a page saying the
// memory is gone.
export const NotificationItem: React.FC<NotificationItemProps> = ({ notification: n, onOpen, dense = false }) => {
  const Icon = TYPE_ICONS[n.type];
  const link = buildNotificationLink(n);
  const displayName = n.actor_display_name || n.actor_username;

  const content = (
    <div
      className={[
        'flex items-start gap-3 transition-colors',
        dense ? 'px-3 py-2.5' : 'px-4 py-3',
        !n.is_read ? 'bg-purple-50/60 dark:bg-purple-950/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60',
      ].join(' ')}
    >
      {displayName ? (
        <Avatar src={n.actor_profile_photo_url} name={displayName} size="sm" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-950/50 dark:to-blue-950/50 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-purple-500" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-800 dark:text-gray-100">{n.title}</p>
        {n.body && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{n.body}</p>}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{formatRelativeTime(n.created_at)}</p>
      </div>
      {!n.is_read && <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" aria-label="Unread" />}
    </div>
  );

  if (!link) {
    return (
      <button type="button" onClick={onOpen} className="w-full text-left">
        {content}
      </button>
    );
  }

  return (
    <Link to={link} onClick={onOpen}>
      {content}
    </Link>
  );
};
