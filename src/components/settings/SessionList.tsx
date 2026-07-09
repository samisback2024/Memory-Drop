import React, { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { formatRelativeTime } from '../../utils/date';
import type { UserSession } from '../../types/settings';

// A self-reported login history, not a live view into Supabase Auth's
// internal session store (the client SDK doesn't expose that, and this
// app has no service-role backend to query it with) — each row is
// something *this app* recorded when you signed in, most recent first,
// with the most recent one labeled "This device" as a reasonable guess.
export const SessionList: React.FC = () => {
  const { getSessions } = useSettings();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getSessions().then(data => { setSessions(data); setLoading(false); }); }, [getSessions]);

  if (loading) return <div className="h-16 rounded-xl bg-gray-50 dark:bg-gray-800 animate-pulse" />;
  if (sessions.length === 0) return <p className="text-xs text-gray-400">No sign-in history recorded yet.</p>;

  return (
    <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
      {sessions.map((s, i) => (
        <div key={s.id} className="flex items-center gap-3 py-2.5">
          <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
            <Monitor size={14} className="text-gray-400" aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 dark:text-gray-100">{s.device_label || 'Unknown device'}</p>
            <p className="text-xs text-gray-400">{formatRelativeTime(s.created_at)}</p>
          </div>
          {i === 0 && <span className="text-[10px] font-medium text-green-600 bg-green-50 dark:bg-green-950/40 rounded-full px-2 py-0.5 flex-shrink-0">This device</span>}
        </div>
      ))}
    </div>
  );
};
