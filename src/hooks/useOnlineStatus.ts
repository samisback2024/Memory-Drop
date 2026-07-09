import { useEffect, useState } from 'react';

// Phase 10e — the one piece of real offline detection in this app.
// Every read hook (useDrops/useMemories/useSearch/useCapsules/...)
// already swallows fetch errors into an empty array rather than
// surfacing them (a pre-existing pattern, not something this phase
// changed), so a failed request today renders as "nothing here" —
// indistinguishable from a genuinely empty result. Rewiring every hook
// to distinguish "empty" from "errored" would be a much larger, more
// invasive change than this polish-focused phase should take on (see
// README Known limitations). This hook instead answers the one
// question that's cheap and reliable to answer: is the browser online
// at all. Pages combine "result is empty" + "we're offline" to show a
// genuinely useful retry affordance for the most common real-world
// failure case, without needing every hook's return contract to change.
export const useOnlineStatus = (): boolean => {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
};
