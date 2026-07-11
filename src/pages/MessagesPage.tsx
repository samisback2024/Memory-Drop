import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, SquarePen, Search, X, Loader2, Inbox } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../hooks/useMessages';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { supabase } from '../lib/supabase';
import { ConversationListItem } from '../components/messages/ConversationListItem';
import { NewConversationModal } from '../components/messages/NewConversationModal';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Avatar } from '../components/ui/Avatar';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { CONVERSATION_FILTERS, type Conversation, type ConversationFilter, type ConversationSearchResult } from '../types/message';

const SEARCH_DEBOUNCE_MS = 300;

// The conversation list — tabs (Recent/Unread/Pinned/Muted/Archived) map
// 1:1 onto get_conversations()'s p_filter. A search query switches the
// list to search_conversations() results instead of the tab-filtered
// list, same "search replaces the tab view" pattern SearchPage already
// uses. Realtime here just nudges a refetch on any conversation change
// visible to this user (RLS scopes what "visible" means — same posture
// Supabase's own docs describe for postgres_changes) rather than trying
// to patch individual rows in place, since a new message can reorder,
// re-preview, and change the unread count all at once.
export const MessagesPage: React.FC = () => {
  const { profile } = useAuth();
  const { getConversations, getMessageRequests, searchConversations } = useMessages();
  const isOnline = useOnlineStatus();
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requestCount, setRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ConversationSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getConversations(filter), getMessageRequests()]).then(([convos, requests]) => {
      setConversations(convos);
      setRequestCount(requests.length);
      setLoading(false);
    });
  }, [filter, getConversations, getMessageRequests]);

  useEffect(() => { load(); }, [load]);

  const { pulling, distance, refreshing } = usePullToRefresh(load, true);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`messages-list:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, load]);

  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const timeout = setTimeout(() => {
      searchConversations(query).then(rows => { setSearchResults(rows); setSearching(false); });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query, searchConversations]);

  const showingSearch = query.trim().length > 0;
  const emptyLabel = useMemo(() => {
    switch (filter) {
      case 'unread': return { title: 'All caught up', description: 'No unread conversations.' };
      case 'pinned': return { title: 'Nothing pinned', description: 'Pin a conversation to keep it at the top.' };
      case 'muted': return { title: 'Nothing muted', description: 'Muted conversations show up here.' };
      case 'archived': return { title: 'Nothing archived', description: 'Archived conversations show up here.' };
      default: return { title: 'No messages yet', description: 'Start a conversation with someone you follow or know.' };
    }
  }, [filter]);

  return (
    <div className="flex flex-col gap-4">
      {(pulling || refreshing) && (
        <div className="flex justify-center items-center overflow-hidden transition-[height]" style={{ height: refreshing ? 36 : distance }}>
          <Loader2 size={20} className={refreshing ? 'text-purple-500 animate-spin' : 'text-purple-400'} style={{ opacity: refreshing ? 1 : Math.min(distance / 70, 1) }} aria-hidden="true" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <MessageCircle size={18} className="text-purple-500" aria-hidden="true" />
          Messages
        </h1>
        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          aria-label="New message"
          className="p-2 rounded-xl text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
        >
          <SquarePen size={20} aria-hidden="true" />
        </button>
      </div>

      {requestCount > 0 && (
        <Link
          to="/messages/requests"
          className="flex items-center gap-3 px-4 py-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/60 flex items-center justify-center flex-shrink-0">
            <Inbox size={16} className="text-purple-600 dark:text-purple-300" aria-hidden="true" />
          </div>
          <span className="flex-1 text-sm font-medium text-purple-900 dark:text-purple-200">
            {requestCount} message request{requestCount === 1 ? '' : 's'}
          </span>
        </Link>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search conversations"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      {!showingSearch && (
        <div role="tablist" aria-label="Conversation filters" className="flex bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-xl p-1 gap-1 border border-white/60 dark:border-gray-800/60 shadow-sm overflow-x-auto">
          {CONVERSATION_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className={[
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                'focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
                filter === id ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {showingSearch ? (
          searching ? (
            <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-gray-400" aria-hidden="true" /></div>
          ) : searchResults.length === 0 ? (
            <EmptyState icon={Search} title="No conversations found" description="Try a different name or username." />
          ) : (
            <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
              {searchResults.map(r => (
                <Link key={r.id} to={`/messages/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                  <Avatar src={r.other_profile_photo_url} name={r.other_display_name || r.other_username || ''} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.other_display_name || r.other_username}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{r.last_message_preview}</p>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse bg-gray-50 dark:bg-gray-800" />)}
          </div>
        ) : conversations.length === 0 ? (
          !isOnline ? (
            <ErrorState title="You're offline" description="Reconnect and try again." onRetry={load} />
          ) : (
            <EmptyState icon={MessageCircle} title={emptyLabel.title} description={emptyLabel.description} />
          )
        ) : (
          <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
            {conversations.map(c => <ConversationListItem key={c.id} conversation={c} />)}
          </div>
        )}
      </div>

      <NewConversationModal isOpen={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
};
