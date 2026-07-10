import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Notification, NotificationFilter } from '../types/notification';

// Reads go through get_notifications()/get_unread_notification_count()
// (SECURITY DEFINER — the actor's username/avatar needs joining across
// profiles RLS, same reasoning as every other cross-user read in this
// app). Writes (mark read, archive, delete) are direct table calls —
// notifications' own RLS + the enforce_notification_update_rules()
// trigger are the real enforcement, same "direct write, RLS decides"
// pattern favorites/saves/pins already use.
export const useNotifications = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const getNotifications = useCallback(async (filter: NotificationFilter = 'all', limit = 30, offset = 0): Promise<Notification[]> => {
    const { data, error } = await supabase.rpc('get_notifications', { p_filter: filter, p_limit: limit, p_offset: offset });
    if (error || !data) return [];
    return data as Notification[];
  }, []);

  const refreshUnreadCount = useCallback(async (): Promise<void> => {
    const { data, error } = await supabase.rpc('get_unread_notification_count');
    if (!error && typeof data === 'number') setUnreadCount(data);
  }, []);

  // Realtime-ready: a live channel on INSERT keeps the bell's unread
  // count current without polling, filtered server-side to the
  // signed-in user's own notifications (Realtime respects RLS the same
  // way a normal read would). Subscribed once per session, torn down
  // on sign-out/unmount.
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    refreshUnreadCount();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => {
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [user, refreshUnreadCount]);

  const markRead = useCallback(async (id: string): Promise<void> => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markUnread = useCallback(async (id: string): Promise<void> => {
    await supabase.from('notifications').update({ is_read: false }).eq('id', id);
    setUnreadCount(prev => prev + 1);
  }, []);

  const markAllRead = useCallback(async (): Promise<void> => {
    await supabase.rpc('mark_all_notifications_read');
    setUnreadCount(0);
  }, []);

  const archive = useCallback(async (id: string, wasUnread: boolean): Promise<void> => {
    await supabase.from('notifications').update({ is_archived: true }).eq('id', id);
    if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Undo for archive — same row, just flip the flag back rather than a
  // separate "restore" concept.
  const unarchive = useCallback(async (id: string): Promise<void> => {
    await supabase.from('notifications').update({ is_archived: false }).eq('id', id);
  }, []);

  const deleteNotification = useCallback(async (id: string): Promise<void> => {
    await supabase.from('notifications').delete().eq('id', id);
  }, []);

  return {
    unreadCount,
    getNotifications,
    refreshUnreadCount,
    markRead,
    markUnread,
    markAllRead,
    archive,
    unarchive,
    deleteNotification,
  };
};
