import React from 'react';
import { Search, MessageSquare } from 'lucide-react';
import type { Conversation } from '../../types';
import { Avatar } from '../ui/Avatar';
import { formatRelativeTime } from '../../utils/date';
import { useAuth } from '../../hooks/useAuth';
import { DEMO_USER_ID } from '../../lib/demo-data';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (conv: Conversation) => void;
  search: string;
  onSearchChange: (v: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeId,
  onSelect,
  search,
  onSearchChange,
}) => {
  const { user, isDemo } = useAuth();
  const myId = isDemo ? DEMO_USER_ID : user?.id;

  const filtered = conversations.filter(c =>
    !search ||
    c.other_user?.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.other_user?.username.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
              <MessageSquare size={20} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 text-center">No conversations yet</p>
          </div>
        ) : (
          filtered.map(conv => {
            const isActive = conv.id === activeId;
            const lastMsg = conv.last_message;
            const isLastMine = lastMsg?.sender_id === myId;

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 ${
                  isActive ? 'bg-purple-50 border-l-2 border-l-purple-600' : ''
                }`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar
                    src={conv.other_user?.avatar_url}
                    name={conv.other_user?.full_name ?? 'User'}
                    size="md"
                  />
                  {(conv.unread_count ?? 0) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-semibold leading-none">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900 truncate">
                      {conv.other_user?.full_name}
                    </span>
                    {lastMsg && (
                      <span className="text-xs text-gray-400 ml-1 flex-shrink-0">
                        {formatRelativeTime(lastMsg.created_at)}
                      </span>
                    )}
                  </div>
                  {lastMsg && (
                    <p className={`text-xs truncate mt-0.5 ${
                      (conv.unread_count ?? 0) > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'
                    }`}>
                      {isLastMine ? 'You: ' : ''}{lastMsg.content}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
