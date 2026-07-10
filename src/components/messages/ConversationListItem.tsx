import React from 'react';
import { Link } from 'react-router-dom';
import { Pin, BellOff } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { PresenceDot } from './PresenceDot';
import { formatRelativeTime } from '../../utils/date';
import type { Conversation } from '../../types/message';

interface ConversationListItemProps {
  conversation: Conversation;
}

export const ConversationListItem: React.FC<ConversationListItemProps> = ({ conversation: c }) => {
  const name = c.other_display_name || c.other_username || 'Unknown';
  const unread = c.unread_count > 0;

  return (
    <Link
      to={`/messages/${c.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
    >
      <div className="relative flex-shrink-0">
        <Avatar src={c.other_profile_photo_url} name={name} size="lg" />
        <PresenceDot isOnline={c.is_online} className="absolute bottom-0 right-0" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm truncate ${unread ? 'font-bold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-800 dark:text-gray-200'}`}>
            {name}
          </p>
          {c.is_pinned && <Pin size={11} className="text-gray-400 flex-shrink-0" aria-label="Pinned" />}
          {c.is_muted && <BellOff size={11} className="text-gray-400 flex-shrink-0" aria-label="Muted" />}
        </div>
        <p className={`text-sm truncate ${unread ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
          {c.request_status === 'pending' ? 'Message request sent' : (c.last_message_preview || 'Say hello 👋')}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {c.last_message_at && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{formatRelativeTime(c.last_message_at)}</span>
        )}
        {unread && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-purple-600 text-white text-[10px] font-semibold flex items-center justify-center leading-none">
            {c.unread_count > 9 ? '9+' : c.unread_count}
          </span>
        )}
      </div>
    </Link>
  );
};
