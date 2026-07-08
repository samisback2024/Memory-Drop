import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft } from 'lucide-react';
import type { Message, Conversation } from '../../types';
import { Avatar } from '../ui/Avatar';
import { formatRelativeTime } from '../../utils/date';
import { useAuth } from '../../hooks/useAuth';
import { DEMO_USER_ID } from '../../lib/demo-data';

interface ChatWindowProps {
  conversation: Conversation;
  messages: Message[];
  onSend: (content: string) => Promise<void>;
  onBack?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  messages,
  onSend,
  onBack,
}) => {
  const { user, isDemo } = useAuth();
  const myId = isDemo ? DEMO_USER_ID : user?.id;
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    setSending(true);
    await onSend(content);
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const other = conversation.other_user;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors md:hidden">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
        )}
        <Avatar src={other?.avatar_url} name={other?.full_name ?? 'User'} size="md" />
        <div>
          <p className="font-semibold text-gray-900 text-sm">{other?.full_name}</p>
          <p className="text-xs text-gray-500">@{other?.username}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === myId;
          const showAvatar = !isMe && (i === 0 || messages[i - 1].sender_id !== msg.sender_id);
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isMe && (
                showAvatar
                  ? <Avatar src={other?.avatar_url} name={other?.full_name ?? 'User'} size="xs" className="flex-shrink-0" />
                  : <div className="w-6 flex-shrink-0" />
              )}
              <div className={`max-w-xs lg:max-w-sm`}>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-black text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-900 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
                <p className={`text-xs text-gray-400 mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                  {formatRelativeTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[42px] max-h-28 bg-white"
            style={{ height: 'auto' }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 112) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-2.5 rounded-xl bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
