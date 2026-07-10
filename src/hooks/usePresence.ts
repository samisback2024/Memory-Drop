import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { PresenceRow } from '../types/message';

const HEARTBEAT_MS = 30000;

// Mounted once at AppShell level (see App.tsx) — joins a single app-wide
// Supabase Presence channel, the first use of Presence anywhere in this
// app (confirmed via research — nothing to reuse). A periodic upsert_
// presence() RPC call keeps presence_status current even for users
// nobody is watching live right now, which is what makes "last seen"
// queryable at all (Presence itself is ephemeral/in-memory on Supabase's
// side, not something a REST read can query directly).
export const usePresence = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    void supabase.rpc('upsert_presence', { p_is_online: true });

    const channel = supabase.channel('presence:online', { config: { presence: { key: user.id } } });
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        void channel.track({ online_at: new Date().toISOString() });
      }
    });

    const heartbeat = setInterval(() => {
      void supabase.rpc('upsert_presence', { p_is_online: true });
    }, HEARTBEAT_MS);

    const goOffline = () => { void supabase.rpc('upsert_presence', { p_is_online: false }); };
    window.addEventListener('beforeunload', goOffline);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') goOffline();
      else void supabase.rpc('upsert_presence', { p_is_online: true });
    });

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', goOffline);
      goOffline();
      supabase.removeChannel(channel);
    };
  }, [user]);
};

// Batch presence lookup for a handful of users at once (conversation
// list rows, a chat screen's header) — not a hook itself, just a plain
// async function, since callers already have their own loading state.
export const getPresence = async (userIds: string[]): Promise<PresenceRow[]> => {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase.rpc('get_presence', { p_user_ids: userIds });
  if (error || !data) return [];
  return data as PresenceRow[];
};
