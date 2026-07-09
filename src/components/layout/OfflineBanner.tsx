import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

// Mounted once in AppShell — a persistent, dismissal-free banner (it
// disappears on its own the moment the browser reports it's back
// online, so there's nothing to dismiss).
export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-amber-50 text-amber-700 text-xs font-medium px-4 py-2 border-b border-amber-100">
      <WifiOff size={13} aria-hidden="true" />
      You're offline — some content may be out of date.
    </div>
  );
};
