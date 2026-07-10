import React, { useState } from 'react';
import { Search, Loader2, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { useSocial } from '../../hooks/useSocial';
import { useMessages } from '../../hooks/useMessages';
import { useToast } from '../../hooks/useToast';
import type { Message } from '../../types/message';
import type { SocialUserWithRelationship } from '../../types/social';

interface ForwardMessageModalProps {
  message: Message | null;
  onClose: () => void;
}

// Forwarding re-sends the same type/content/metadata into a different
// (existing or brand-new) conversation via send_message() — attachments
// are referenced by their existing storage URL, not re-uploaded (the
// same "share by reference" posture this app already applies elsewhere,
// e.g. saved items reusing the original row rather than copying it).
export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({ message, onClose }) => {
  const { searchUsers } = useSocial();
  const { getOrCreateConversation, sendMessage } = useMessages();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SocialUserWithRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  const runSearch = (value: string) => {
    setQuery(value);
    if (!value.trim()) { setResults([]); return; }
    setLoading(true);
    searchUsers(value.trim()).then(rows => { setResults(rows); setLoading(false); });
  };

  const handleForward = async (targetUserId: string) => {
    if (!message) return;
    setSendingTo(targetUserId);
    const { error, conversationId } = await getOrCreateConversation(targetUserId);
    if (error || !conversationId) {
      showToast(error || 'Could not forward.', 'error');
      setSendingTo(null);
      return;
    }
    const attachments = message.attachments.map(a => ({
      bucket: a.bucket, storage_path: '', url: a.url, mime_type: a.mime_type || '', size_bytes: a.size_bytes || 0,
      width: a.width ?? undefined, height: a.height ?? undefined, duration_seconds: a.duration_seconds ?? undefined,
      waveform: a.waveform ?? undefined, thumbnail_url: a.thumbnail_url ?? undefined,
    }));
    const { error: sendError } = await sendMessage(conversationId, message.type, message.content, message.metadata, null, message.id, attachments);
    setSendingTo(null);
    if (sendError) { showToast(sendError, 'error'); return; }
    setSentTo(prev => new Set(prev).add(targetUserId));
  };

  return (
    <Modal isOpen={!!message} onClose={onClose} title="Forward message" size="md">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={e => runSearch(e.target.value)}
            placeholder="Search people"
            autoFocus
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          />
        </div>

        <div className="flex flex-col max-h-80 overflow-y-auto -mx-1">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-400" aria-hidden="true" /></div>
          ) : (
            results.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleForward(u.id)}
                disabled={sendingTo === u.id || sentTo.has(u.id)}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left disabled:opacity-70"
              >
                <Avatar src={u.profile_photo_url} name={u.display_name || u.username} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{u.display_name || u.username}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{u.username}</p>
                </div>
                {sendingTo === u.id && <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" aria-hidden="true" />}
                {sentTo.has(u.id) && <Check size={16} className="text-green-500 flex-shrink-0" aria-hidden="true" />}
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};
