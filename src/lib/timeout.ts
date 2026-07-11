// A production audit found no request in this app ever times out — every
// Supabase call relies entirely on the browser's default (very long,
// often effectively "never") network timeout, so a hung connection just
// hangs the UI in a loading state forever. This is the shared piece: a
// real AbortController-backed timeout, wired into Supabase's own
// `.abortSignal()` support (postgrest-js) so a timed-out request is
// actually cancelled, not just abandoned while still running server-side.
//
// Scope: applied to this app's highest-traffic "get" calls (Feed,
// Capsules, Moments, Messages, Search) as the first pass — every read in
// this app already funnels through a small number of hook files, so
// widening coverage later is a matter of touching those same files
// again, not a new pattern to invent.
const DEFAULT_TIMEOUT_MS = 15000;

export const withAbortTimeout = (ms: number = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
};
