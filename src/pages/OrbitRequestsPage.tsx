import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSocial } from '../hooks/useSocial';
import { useToast } from '../hooks/useToast';
import { OrbitRequestCard } from '../components/social/OrbitRequestCard';
import { EmptySocialState } from '../components/social/EmptySocialState';
import { UserListSkeleton } from '../components/social/UserList';
import type { PendingRequest } from '../types/social';

export const OrbitRequestsPage: React.FC = () => {
  const { getOrbitRequestsReceived, getOrbitRequestsSent, acceptOrbitRequest, declineOrbitRequest, cancelRequest } = useSocial();
  const { showToast } = useToast();
  const [received, setReceived] = useState<PendingRequest[]>([]);
  const [sent, setSent] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getOrbitRequestsReceived(), getOrbitRequestsSent()]).then(([r, s]) => {
      if (cancelled) return;
      setReceived(r);
      setSent(s);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [getOrbitRequestsReceived, getOrbitRequestsSent]);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/friends" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 w-fit">
        <ArrowLeft size={15} aria-hidden="true" />
        Back to friends
      </Link>
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 -mb-1">Orbit requests</h1>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Received</h2>
        {loading ? (
          <UserListSkeleton />
        ) : received.length === 0 ? (
          <EmptySocialState variant="requests" />
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {received.map(u => (
              <OrbitRequestCard
                key={u.id}
                user={u}
                direction="received"
                onAccept={async () => {
                  const { error } = await acceptOrbitRequest(u.id);
                  if (!error) { setReceived(prev => prev.filter(x => x.id !== u.id)); showToast(`You accepted ${u.display_name || u.username}'s Orbit request.`); }
                  else showToast(error, 'error');
                }}
                onDecline={async () => {
                  const { error } = await declineOrbitRequest(u.id);
                  if (!error) setReceived(prev => prev.filter(x => x.id !== u.id));
                  else showToast(error, 'error');
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Sent by you</h2>
        {loading ? (
          <UserListSkeleton />
        ) : sent.length === 0 ? (
          <EmptySocialState variant="sent-requests" />
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {sent.map(u => (
              <OrbitRequestCard
                key={u.id}
                user={u}
                direction="sent"
                onCancel={async () => {
                  const { error } = await cancelRequest(u.id);
                  if (!error) setSent(prev => prev.filter(x => x.id !== u.id));
                  else showToast(error, 'error');
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
