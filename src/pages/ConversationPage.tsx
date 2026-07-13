import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MoreVertical, Pin, BellOff, Archive, ShieldOff, Images, Check, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../hooks/useMessages';
import { useSocial } from '../hooks/useSocial';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/ui/Avatar';
import { PresenceDot, formatLastSeen } from '../components/messages/PresenceDot';
import { TypingIndicator } from '../components/messages/TypingIndicator';
import { MessageBubble } from '../components/messages/MessageBubble';
import { MessageComposer } from '../components/messages/MessageComposer';
import { MessageActionsSheet } from '../components/messages/MessageActionsSheet';
import { ForwardMessageModal } from '../components/messages/ForwardMessageModal';
import { ConversationMediaPanel } from '../components/messages/ConversationMediaPanel';
import type { ConversationHeader, Message } from '../types/message';

const PAGE_SIZE = 50;
const MAX_IN_MEMORY = 150;
const TYPING_STALE_MS = 6000;

const dateHeading = (iso: string): string => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};

// The chat screen — full-bleed, own chrome, same "outside AppShell"
// treatment as /drop/:dropId and /moments/:momentId (see App.tsx).
// Message history is upward-paginated (get_messages' before-cursor) with
// scroll-height preserved across a prepend; the live tail is capped at
// MAX_IN_MEMORY so a long-lived open session doesn't grow the DOM
// unbounded — windowed pagination, not a virtualization library (see
// the SQL migration's header comment on why).
export const ConversationPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { blockUser } = useSocial();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const {
    getMessages, getConversationHeader, markConversationRead, markMessagesDelivered, setConversationActive,
    setMessagePinned, starMessage, unstarMessage, reactToMessage, removeMessageReaction, deleteMessageForMe,
    unsendMessage, setConversationPinned, setConversationMuted, setConversationArchived,
    acceptMessageRequest, declineMessageRequest,
  } = useMessages();

  const [header, setHeader] = useState<ConversationHeader | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [otherTyping, setOtherTyping] = useState(false);
  const [actionsMessage, setActionsMessage] = useState<Message | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLastIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    const [hdr, msgs] = await Promise.all([
      getConversationHeader(conversationId),
      getMessages(conversationId, null, PAGE_SIZE),
    ]);
    setHeader(hdr);
    setMessages([...msgs].reverse());
    setHasMore(msgs.length === PAGE_SIZE);
    setLoading(false);
  }, [conversationId, getConversationHeader, getMessages]);

  useEffect(() => { load(); }, [load]);

  const refreshRecent = useCallback(async () => {
    if (!conversationId) return;
    const fresh = await getMessages(conversationId, null, PAGE_SIZE);
    const freshMap = new Map(fresh.map(m => [m.id, m]));
    setMessages(prev => {
      const merged = prev.map(m => freshMap.get(m.id) ?? m);
      const existingIds = new Set(prev.map(m => m.id));
      const newlyArrived = [...fresh].reverse().filter(m => !existingIds.has(m.id));
      const combined = [...merged, ...newlyArrived];
      return combined.length > MAX_IN_MEMORY ? combined.slice(combined.length - MAX_IN_MEMORY) : combined;
    });
  }, [conversationId, getMessages]);

  useEffect(() => {
    if (!conversationId || !user) return;
    void setConversationActive(conversationId, true);
    void markMessagesDelivered(conversationId);
    void markConversationRead(conversationId);
    return () => { void setConversationActive(conversationId, false); };
  }, [conversationId, user, setConversationActive, markMessagesDelivered, markConversationRead]);

  useEffect(() => {
    if (!conversationId || !user) return;
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () => {
        void refreshRecent();
        void markMessagesDelivered(conversationId);
        void markConversationRead(conversationId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => { void refreshRecent(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' }, () => { void refreshRecent(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_status', filter: `conversation_id=eq.${conversationId}` }, payload => {
        const row = (payload.new ?? payload.old) as { user_id: string; is_typing: boolean; updated_at: string } | null;
        if (!row || row.user_id === user.id) return;
        const stale = Date.now() - new Date(row.updated_at).getTime() > TYPING_STALE_MS;
        setOtherTyping(row.is_typing && !stale);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user, refreshRecent, markMessagesDelivered, markConversationRead]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.id !== prevLastIdRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: prevLastIdRef.current ? 'smooth' : 'auto' });
    }
    prevLastIdRef.current = last?.id ?? null;
  }, [messages]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || messages.length === 0 || !conversationId) return;
    setLoadingMore(true);
    const container = scrollRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    const older = await getMessages(conversationId, messages[0].id, PAGE_SIZE);
    setMessages(prev => [...[...older].reverse(), ...prev]);
    setHasMore(older.length === PAGE_SIZE);
    setLoadingMore(false);
    requestAnimationFrame(() => {
      if (container) container.scrollTop = container.scrollHeight - prevHeight;
    });
  };

  const isMine = useCallback((m: Message) => m.sender_id === user?.id, [user]);

  const grouped = useMemo(() => {
    const out: Array<{ kind: 'date'; label: string; key: string } | { kind: 'message'; message: Message; showAvatar: boolean }> = [];
    let lastDate = '';
    messages.forEach((m, i) => {
      const day = new Date(m.created_at).toDateString();
      if (day !== lastDate) {
        out.push({ kind: 'date', label: dateHeading(m.created_at), key: `date-${m.id}` });
        lastDate = day;
      }
      const next = messages[i + 1];
      const showAvatar = !next || next.sender_id !== m.sender_id || new Date(next.created_at).toDateString() !== day;
      out.push({ kind: 'message', message: m, showAvatar });
    });
    return out;
  }, [messages]);

  const handleReply = (m: Message) => { setReplyingTo(m); setEditingMessage(null); };
  const handleEdit = (m: Message) => { setEditingMessage(m); setReplyingTo(null); };
  const handleCopy = (m: Message) => { if (m.content) { void navigator.clipboard.writeText(m.content); showToast('Copied.', 'success'); } };
  const handleTogglePin = async (m: Message) => { const { error } = await setMessagePinned(m.id, !m.is_pinned); if (error) showToast(error, 'error'); else void refreshRecent(); };
  const handleToggleStar = async (m: Message) => { if (m.is_starred_by_me) await unstarMessage(m.id); else await starMessage(m.id); void refreshRecent(); };
  const handleReact = async (m: Message, emoji: string) => {
    const mine = m.reactions.find(r => r.user_id === user?.id);
    if (mine?.emoji === emoji) await removeMessageReaction(m.id);
    else await reactToMessage(m.id, emoji);
    void refreshRecent();
  };
  const handleUnsend = async (m: Message) => {
    const ok = await confirm({ title: 'Unsend this message?', description: 'It will be removed for everyone in this conversation.', confirmLabel: 'Unsend' });
    if (!ok) return;
    const { error } = await unsendMessage(m.id);
    if (error) showToast(error, 'error'); else void refreshRecent();
  };
  const handleDeleteForMe = async (m: Message) => {
    const ok = await confirm({ title: 'Delete this message?', description: 'It stays visible to everyone else — only your copy is removed.', confirmLabel: 'Delete' });
    if (!ok) return;
    await deleteMessageForMe(m.id);
    setMessages(prev => prev.filter(x => x.id !== m.id));
    showToast('Deleted for you.', 'success');
  };

  const handleAccept = async () => {
    if (!conversationId) return;
    await acceptMessageRequest(conversationId);
    void load();
  };
  const handleDecline = async () => {
    if (!conversationId) return;
    await declineMessageRequest(conversationId);
    navigate('/messages');
  };

  const otherName = header?.other_display_name || header?.other_username || 'Unknown';
  const isPendingForMe = header?.request_status === 'pending' && header.request_initiator_id !== user?.id;
  const isPendingForOther = header?.request_status === 'pending' && header?.request_initiator_id === user?.id;

  if (header === undefined || loading) {
    return (
      <div className="fixed inset-0 z-40 bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-purple-500 rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!header) {
    return (
      <div className="fixed inset-0 z-40 bg-white dark:bg-gray-950 flex flex-col items-center justify-center gap-3 text-gray-500 text-sm">
        <p>This conversation isn't available.</p>
        <button type="button" onClick={() => navigate('/messages')} className="text-purple-600 underline">Back to messages</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-white dark:bg-gray-950 flex flex-col">
      <header className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <button type="button" onClick={() => navigate('/messages')} aria-label="Back" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <div className="relative flex-shrink-0">
          <Avatar src={header.other_profile_photo_url} name={otherName} size="md" />
          <PresenceDot isOnline={header.is_online} className="absolute bottom-0 right-0" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{otherName}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
            {otherTyping ? 'Typing…' : formatLastSeen(header.last_seen_at, header.is_online)}
          </p>
        </div>
        <div className="relative flex-shrink-0">
          <button type="button" onClick={() => setMenuOpen(p => !p)} aria-label="Conversation options" aria-expanded={menuOpen} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <MoreVertical size={18} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-10 w-52 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
              <button type="button" onClick={() => { setMediaOpen(true); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                <Images size={15} aria-hidden="true" /> Shared media
              </button>
              <button type="button" onClick={async () => { await setConversationPinned(conversationId!, true); setMenuOpen(false); showToast('Pinned.', 'success'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                <Pin size={15} aria-hidden="true" /> Pin conversation
              </button>
              <button type="button" onClick={async () => { await setConversationMuted(conversationId!, true); setMenuOpen(false); showToast('Muted.', 'success'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                <BellOff size={15} aria-hidden="true" /> Mute
              </button>
              <button type="button" onClick={async () => { await setConversationArchived(conversationId!, true); setMenuOpen(false); navigate('/messages'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                <Archive size={15} aria-hidden="true" /> Archive
              </button>
              <div className="border-t border-gray-100 dark:border-gray-800" />
              <button type="button" onClick={async () => { await blockUser(header.other_user_id); setMenuOpen(false); navigate('/messages'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                <ShieldOff size={15} aria-hidden="true" /> Block
              </button>
            </div>
          )}
        </div>
      </header>

      {isPendingForMe && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-100 dark:border-purple-900/50 flex-shrink-0">
          <p className="text-xs text-purple-800 dark:text-purple-200">{otherName} wants to send you a message.</p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button type="button" onClick={handleAccept} aria-label="Accept" className="p-1.5 rounded-lg text-green-600 hover:bg-green-100 dark:hover:bg-green-950/40"><Check size={15} aria-hidden="true" /></button>
            <button type="button" onClick={handleDecline} aria-label="Decline" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"><X size={15} aria-hidden="true" /></button>
          </div>
        </div>
      )}
      {isPendingForOther && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">Message request sent — {otherName} needs to accept before you can keep chatting freely.</p>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {hasMore && (
          <button type="button" onClick={loadMore} disabled={loadingMore} className="self-center text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50 py-2">
            {loadingMore ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
            <Avatar src={header.other_profile_photo_url} name={otherName} size="2xl" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mt-2">{otherName}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Say hello 👋</p>
          </div>
        ) : (
          grouped.map(item =>
            item.kind === 'date' ? (
              <div key={item.key} className="flex justify-center py-1">
                <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full px-2.5 py-1">{item.label}</span>
              </div>
            ) : (
              <MessageBubble
                key={item.message.id}
                message={item.message}
                isMine={isMine(item.message)}
                showAvatar={item.showAvatar}
                showSenderName={false}
                otherName={otherName}
                otherPhotoUrl={header.other_profile_photo_url}
                onLongPress={() => setActionsMessage(item.message)}
              />
            )
          )
        )}
        {otherTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <MessageComposer
        conversationId={conversationId!}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        onSent={() => { void refreshRecent(); }}
        disabled={header.request_status === 'declined'}
      />

      <MessageActionsSheet
        message={actionsMessage}
        isMine={actionsMessage ? isMine(actionsMessage) : false}
        onClose={() => setActionsMessage(null)}
        onReply={() => actionsMessage && handleReply(actionsMessage)}
        onForward={() => { setForwardMessage(actionsMessage); }}
        onCopy={() => actionsMessage && handleCopy(actionsMessage)}
        onReact={emoji => actionsMessage && handleReact(actionsMessage, emoji)}
        onTogglePin={() => actionsMessage && handleTogglePin(actionsMessage)}
        onToggleStar={() => actionsMessage && handleToggleStar(actionsMessage)}
        onEdit={() => actionsMessage && handleEdit(actionsMessage)}
        onUnsend={() => actionsMessage && handleUnsend(actionsMessage)}
        onDeleteForMe={() => actionsMessage && handleDeleteForMe(actionsMessage)}
      />

      <ForwardMessageModal message={forwardMessage} onClose={() => setForwardMessage(null)} />

      {mediaOpen && conversationId && (
        <ConversationMediaPanel conversationId={conversationId} onClose={() => setMediaOpen(false)} />
      )}
    </div>
  );
};
