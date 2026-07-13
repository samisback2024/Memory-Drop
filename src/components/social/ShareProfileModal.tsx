import React, { useState } from 'react';
import { Search, Loader2, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { useSocial } from '../../hooks/useSocial';
import { useMessages } from '../../hooks/useMessages';
import type { SocialUserWithRelationship } from '../../types/social';

interface ShareProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  displayName: string;
}

// Sends a plain text message containing the profile's /u/:username link —
// no new message type or backend needed. MessageBubble already detects an
// internal /u/:username link inside any text message (findInternalLink)
// and renders a live RichLinkPreview card (avatar, name, @username),
// exactly the same mechanism drop/capsule links already use. Contact
// picking mirrors ForwardMessageModal's search-and-send pattern.
export const ShareProfileModal: React.FC<ShareProfileModalProps> = ({ isOpen, onClose, username, displayName }) => {
  const { searchUsers } = useSocial();
  const { getOrCreateConversation, sendMessage } = useMessages();
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

  const handleClose = () => {
    setQuery('');
    setResults([]);
    setSentTo(new Set());
    onClose();
  };

  const handleSend = async (targetUserId: string) => {
    setSendingTo(targetUserId);
    const { error, conversationId } = await getOrCreateConversation(targetUserId);
    if (error || !conversationId) {
      setSendingTo(null);
      return;
    }
    const shareUrl = `${window.location.origin}/u/${username}`;
    await sendMessage(conversationId, 'text', `Check out ${displayName}'s profile: ${shareUrl}`);
    setSendingTo(null);
    setSentTo(prev => new Set(prev).add(targetUserId));
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Share @${username}'s profile`} size="md">
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
          ) : query.trim() && results.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No one found.</p>
          ) : (
            results.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSend(u.id)}
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
