import { supabase } from './supabase';

// Self-hosted analytics — events land in this app's own `analytics_events`
// table (supabase/phase13_production_hardening.sql), not a third-party
// vendor. No API key was available for a real vendor (PostHog/GA/
// Mixpanel), and a third party would be a step down in privacy anyway —
// this app's data never leaves its own Supabase project. Genuinely
// privacy-conscious, not just claimed: an `analytics_enabled` toggle in
// Settings (default on, same "on by default, real toggle" posture every
// notification preference already uses) makes `track()` a true no-op
// when off, checked before every call, not just documented as an intent.
const SESSION_STORAGE_KEY = 'memorydrop_analytics_session_id';

const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
};

// Cached in memory so every track() call doesn't need its own settings
// round trip. Starts `null` (unknown) — the very first call in a session
// resolves it once; `setAnalyticsEnabled()` (called by the Settings
// toggle) updates it immediately so a just-flipped-off toggle takes
// effect on the next track() call, not just after a reload.
let cachedEnabled: boolean | null = null;

export const setAnalyticsEnabled = (enabled: boolean): void => {
  cachedEnabled = enabled;
};

const resolveEnabled = async (userId: string | undefined): Promise<boolean> => {
  if (cachedEnabled !== null) return cachedEnabled;
  if (!userId) {
    // No signed-in user yet (pre-auth funnel events) — nothing to check
    // a preference against, so these are allowed through; they're the
    // same kind of anonymous, non-identifying event a cookie-free
    // "how many people hit the landing page" count already is.
    return true;
  }
  const { data } = await supabase.from('user_settings').select('analytics_enabled').eq('user_id', userId).single();
  cachedEnabled = data ? (data.analytics_enabled as boolean) : true;
  return cachedEnabled;
};

export const track = async (eventName: string, properties: Record<string, unknown> = {}): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const enabled = await resolveEnabled(user?.id);
    if (!enabled) return;

    await supabase.from('analytics_events').insert({
      user_id: user?.id ?? null,
      session_id: getSessionId(),
      event_name: eventName,
      properties,
    });
  } catch {
    // Analytics must never break the app or surface an error to the
    // user — a failed event insert is silently dropped, same posture
    // this app already applies to storage-cleanup-on-delete elsewhere.
  }
};
