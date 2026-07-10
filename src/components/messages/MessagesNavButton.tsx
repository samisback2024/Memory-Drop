import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useMessages } from '../../hooks/useMessages';
import { supabase } from '../../lib/supabase';

// Same visual badge pattern as NotificationBell — but no dropdown
// preview, since a conversation is a whole screen to actually use, not
// a quick-glance summary the way a notification list is. Visible at
// every viewport width (not hidden below `sm`), same reasoning
// NotificationBell already established: MobileNav's 5 bottom-bar slots
// are already full (Feed/Capsules/Create/Memories/Profile), so this is
// the one persistent cross-device entry point.
export const MessagesNavButton: React.FC = () => {
  const { profile } = useAuth();
  const { getConversations, getMessageRequests } = useMessages();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(() => {
    Promise.all([getConversations('all'), getMessageRequests()]).then(([convos, requests]) => {
      const convoUnread = convos.reduce((sum, c) => sum + c.unread_count, 0);
      setUnreadCount(convoUnread + requests.length);
    });
  }, [getConversations, getMessageRequests]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`messages-badge:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, refresh]);

  return (
    <Link
      to="/messages"
      aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : 'Messages'}
      className="relative flex items-center gap-1.5 p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
    >
      <MessageCircle size={16} aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
};
