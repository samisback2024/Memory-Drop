import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Notification, NotificationFilter } from '../types/notification';

interface NotificationsContextType {
  unreadCount: number;
  getNotifications: (filter?: NotificationFilter, limit?: number, offset?: number) => Promise<Notification[]>;
  refreshUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markUnread: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  archive: (id: string, wasUnread: boolean) => Promise<void>;
  unarchive: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

// One realtime channel per session, not one per component. NotificationBell
// (always mounted in Navbar) and NotificationsPage both need unreadCount —
// each previously called this as a plain hook, so each independently ran
// `supabase.channel('notifications:${user.id}').on(...).subscribe()`.
// Supabase's client keys channels by topic name and returns the same
// object for a repeat topic, so the second `.on()` call landed on a
// channel that had already been subscribed — which throws ("cannot add
// postgres_changes callbacks... after subscribe()") and crashed
// NotificationsPage into its error boundary on every visit, found via
// live testing. Provider-scoped state (same pattern as AuthProvider/
// ThemeProvider) means exactly one subscription exists regardless of how
// many components read unreadCount.
export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const getNotifications = useCallback(async (filter: NotificationFilter = 'all', limit = 30, offset = 0): Promise<Notification[]> => {
    const { data, error } = await supabase.rpc('get_notifications', { p_filter: filter, p_limit: limit, p_offset: offset });
    if (error || !data) return [];
    return data as Notification[];
  }, []);

  const refreshUnreadCount = useCallback(async (): Promise<void> => {
    const { data, error } = await supabase.rpc('get_unread_notification_count');
    if (!error && typeof data === 'number') setUnreadCount(data);
  }, []);

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
    return () => { supabase.removeChannel(channel); };
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

  const value: NotificationsContextType = {
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

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

// Reads go through get_notifications()/get_unread_notification_count()
// (SECURITY DEFINER — the actor's username/avatar needs joining across
// profiles RLS, same reasoning as every other cross-user read in this
// app). Writes (mark read, archive, delete) are direct table calls —
// notifications' own RLS + the enforce_notification_update_rules()
// trigger are the real enforcement, same "direct write, RLS decides"
// pattern favorites/saves/pins already use.
export const useNotifications = (): NotificationsContextType => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
};
