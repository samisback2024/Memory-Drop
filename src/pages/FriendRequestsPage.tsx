import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSocial } from '../hooks/useSocial';
import { FriendRequestCard } from '../components/social/FriendRequestCard';
import { EmptySocialState } from '../components/social/EmptySocialState';
import { UserListSkeleton } from '../components/social/UserList';
import type { PendingRequest } from '../types/social';

export const FriendRequestsPage: React.FC = () => {
  const { getPendingRequestsReceived, getPendingRequestsSent, acceptRequest, declineRequest, cancelRequest } = useSocial();
  const [received, setReceived] = useState<PendingRequest[]>([]);
  const [sent, setSent] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPendingRequestsReceived(), getPendingRequestsSent()]).then(([r, s]) => {
      if (cancelled) return;
      setReceived(r);
      setSent(s);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [getPendingRequestsReceived, getPendingRequestsSent]);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/friends" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 w-fit">
        <ArrowLeft size={15} aria-hidden="true" />
        Back to friends
      </Link>
      <h1 className="text-lg font-bold text-gray-900 -mb-1">Follow requests</h1>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Requests</h2>
        {loading ? (
          <UserListSkeleton />
        ) : received.length === 0 ? (
          <EmptySocialState variant="requests" />
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {received.map(u => (
              <FriendRequestCard
                key={u.id}
                user={u}
                direction="received"
                onAccept={async () => {
                  const { error } = await acceptRequest(u.id);
                  if (!error) setReceived(prev => prev.filter(x => x.id !== u.id));
                }}
                onDecline={async () => {
                  const { error } = await declineRequest(u.id);
                  if (!error) setReceived(prev => prev.filter(x => x.id !== u.id));
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Sent</h2>
        {loading ? (
          <UserListSkeleton />
        ) : sent.length === 0 ? (
          <EmptySocialState variant="sent-requests" />
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {sent.map(u => (
              <FriendRequestCard
                key={u.id}
                user={u}
                direction="sent"
                onCancel={async () => {
                  const { error } = await cancelRequest(u.id);
                  if (!error) setSent(prev => prev.filter(x => x.id !== u.id));
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
