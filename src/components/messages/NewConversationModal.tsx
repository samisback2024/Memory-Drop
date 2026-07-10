import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { useSocial } from '../../hooks/useSocial';
import { useMessages } from '../../hooks/useMessages';
import type { SocialUserWithRelationship } from '../../types/social';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Reuses the same search_users() RPC (via useSocial's searchUsers) Search
// and @mention autocomplete already use — one query type, not a new one
// just for "who can I message." can_message()'s gate (allowed/request/
// blocked) is only actually evaluated once a user is picked, inside
// getOrCreateConversation() — the search results themselves don't need
// to pre-filter by messaging privacy, the same way Search doesn't
// pre-filter by Drop visibility before you tap into someone's profile.
export const NewConversationModal: React.FC<NewConversationModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { searchUsers } = useSocial();
  const { getOrCreateConversation } = useMessages();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SocialUserWithRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = (value: string) => {
    setQuery(value);
    setError(null);
    if (!value.trim()) { setResults([]); return; }
    setLoading(true);
    searchUsers(value.trim()).then(rows => { setResults(rows); setLoading(false); });
  };

  const handlePick = async (userId: string) => {
    setStarting(userId);
    setError(null);
    const { error: startError, conversationId } = await getOrCreateConversation(userId);
    setStarting(null);
    if (startError || !conversationId) {
      setError(startError || 'Could not start a conversation.');
      return;
    }
    onClose();
    setQuery('');
    setResults([]);
    navigate(`/messages/${conversationId}`);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New message" size="md">
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

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex flex-col max-h-80 overflow-y-auto -mx-1">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-400" aria-hidden="true" /></div>
          ) : results.length === 0 ? (
            query.trim() && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No one found.</p>
            )
          ) : (
            results.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => handlePick(u.id)}
                disabled={starting === u.id}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left disabled:opacity-60"
              >
                <Avatar src={u.profile_photo_url} name={u.display_name || u.username} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{u.display_name || u.username}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{u.username}</p>
                </div>
                {starting === u.id && <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" aria-hidden="true" />}
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};
