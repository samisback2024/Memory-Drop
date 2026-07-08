import React, { useState } from 'react';
import { useMessages } from '../hooks/useMessages';
import { ConversationList } from '../components/messages/ConversationList';
import { ChatWindow } from '../components/messages/ChatWindow';
import type { Conversation } from '../types';

export const MessagesPage: React.FC = () => {
  const { conversations, messages, activeConvId, fetchMessages, sendMessage, loading } = useMessages();
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const activeConversation = conversations.find(c => c.id === activeConvId) ?? null;

  const handleSelect = (conv: Conversation) => {
    fetchMessages(conv.id);
    setMobileView('chat');
  };

  const handleSend = async (content: string) => {
    if (!activeConvId) return;
    await sendMessage(activeConvId, content);
  };

  const handleBack = () => {
    setMobileView('list');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 10rem)' }}>
      <div className="flex h-full">
        {/* Conversation list — always visible on md+, toggle on mobile */}
        <div className={`w-full md:w-80 border-r border-gray-100 flex-shrink-0 ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'} flex-col`}>
          <ConversationList
            conversations={conversations}
            activeId={activeConvId}
            onSelect={handleSelect}
            search={search}
            onSearchChange={setSearch}
          />
        </div>

        {/* Chat window */}
        <div className={`flex-1 ${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-col`}>
          {activeConversation ? (
            <ChatWindow
              conversation={activeConversation}
              messages={messages}
              onSend={handleSend}
              onBack={handleBack}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">Select a conversation</p>
              <p className="text-xs text-gray-400">Choose from the list to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
