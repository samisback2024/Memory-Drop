import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, X, ShieldOff } from 'lucide-react';
import { useMessages } from '../hooks/useMessages';
import { useSocial } from '../hooks/useSocial';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { Avatar } from '../components/ui/Avatar';
import { Inbox } from 'lucide-react';
import type { MessageRequest } from '../types/message';

// Accept moves the conversation into the normal list; Decline and
// Delete are the same server action (decline_message_request) — see
// the SQL migration's comment on why that consolidation is deliberate,
// not a missing feature. Block reuses Phase 3's existing blockUser (no
// new blocking mechanism for messaging specifically) and also declines
// the request, since a blocked conversation shouldn't linger as 'pending'.
export const MessageRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const { getMessageRequests, acceptMessageRequest, declineMessageRequest } = useMessages();
  const { blockUser } = useSocial();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    getMessageRequests().then(rows => { setRequests(rows); setLoading(false); });
  }, [getMessageRequests]);

  const removeRow = (id: string) => setRequests(prev => prev.filter(r => r.id !== id));

  const handleAccept = async (r: MessageRequest) => {
    setBusyId(r.id);
    const { error } = await acceptMessageRequest(r.id);
    setBusyId(null);
    if (!error) navigate(`/messages/${r.id}`);
    else showToast(error, 'error');
  };

  const handleDecline = async (r: MessageRequest) => {
    setBusyId(r.id);
    const { error } = await declineMessageRequest(r.id);
    setBusyId(null);
    if (!error) removeRow(r.id);
    else showToast(error, 'error');
  };

  const handleBlock = async (r: MessageRequest) => {
    setBusyId(r.id);
    await blockUser(r.other_user_id);
    const { error } = await declineMessageRequest(r.id);
    setBusyId(null);
    if (!error) removeRow(r.id);
    else showToast(error, 'error');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link to="/messages" aria-label="Back to messages" className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ChevronLeft size={20} aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Message requests</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
            {[0, 1].map(i => <div key={i} className="h-20 animate-pulse bg-gray-50 dark:bg-gray-800" />)}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState icon={Inbox} title="No message requests" description="Messages from people outside your circle land here first." />
        ) : (
          <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
            {requests.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar src={r.other_profile_photo_url} name={r.other_display_name || r.other_username || ''} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.other_display_name || r.other_username}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.last_message_preview}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAccept(r)}
                    disabled={busyId === r.id}
                    aria-label="Accept"
                    className="p-2 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors disabled:opacity-50"
                  >
                    <Check size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecline(r)}
                    disabled={busyId === r.id}
                    aria-label="Decline"
                    className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBlock(r)}
                    disabled={busyId === r.id}
                    aria-label="Block"
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                  >
                    <ShieldOff size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
