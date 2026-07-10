import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { AuthResult } from '../types/auth';
import type {
  Conversation, ConversationFilter, ConversationHeader, ConversationMediaItem, ConversationSearchResult,
  Message, MessageGate, MessageRequest, MessageSearchResult, MessageType,
} from '../types/message';

// Reads go through SECURITY DEFINER RPCs (get_conversations/get_messages/
// ...), same reason as every other cross-user read in this app — they
// join `profiles` and, for get_messages(), the other member's read-
// receipt rows, none of which base RLS would let a client join directly.
// Writes are a mix: send_message() is an RPC (it has real side effects —
// stamping the conversation preview, notifying, accepting a pending
// request), while edit/unsend/pin/star/react/delete-for-me are direct
// table calls, same "RLS + a rules trigger is the real enforcement"
// pattern useComments.ts already established for comment editing.
export const useMessages = () => {
  const { user } = useAuth();

  const canMessage = useCallback(async (otherUserId: string): Promise<MessageGate> => {
    const { data, error } = await supabase.rpc('can_message', { p_recipient_id: otherUserId });
    if (error || !data) return 'blocked';
    return data as MessageGate;
  }, []);

  const getOrCreateConversation = useCallback(async (otherUserId: string): Promise<{ error: string | null; conversationId: string | null }> => {
    const { data, error } = await supabase.rpc('get_or_create_direct_conversation', { p_other_id: otherUserId });
    if (error || !data) return { error: error?.message ?? 'Could not start a conversation.', conversationId: null };
    return { error: null, conversationId: data as string };
  }, []);

  const getConversations = useCallback(async (filter: ConversationFilter = 'all'): Promise<Conversation[]> => {
    const { data, error } = await supabase.rpc('get_conversations', { p_filter: filter });
    if (error || !data) return [];
    return data as Conversation[];
  }, []);

  const getConversationHeader = useCallback(async (conversationId: string): Promise<ConversationHeader | null> => {
    const { data, error } = await supabase.rpc('get_conversation_header', { p_conversation_id: conversationId });
    if (error || !data || data.length === 0) return null;
    return data[0] as ConversationHeader;
  }, []);

  const getMessageRequests = useCallback(async (): Promise<MessageRequest[]> => {
    const { data, error } = await supabase.rpc('get_message_requests');
    if (error || !data) return [];
    return data as MessageRequest[];
  }, []);

  const acceptMessageRequest = useCallback(async (conversationId: string): Promise<AuthResult> => {
    const { error } = await supabase.rpc('accept_message_request', { p_conversation_id: conversationId });
    return { error: error?.message ?? null };
  }, []);

  const declineMessageRequest = useCallback(async (conversationId: string): Promise<AuthResult> => {
    const { error } = await supabase.rpc('decline_message_request', { p_conversation_id: conversationId });
    return { error: error?.message ?? null };
  }, []);

  const getMessages = useCallback(async (conversationId: string, beforeMessageId: string | null = null, limit = 50): Promise<Message[]> => {
    const { data, error } = await supabase.rpc('get_messages', {
      p_conversation_id: conversationId, p_before_message_id: beforeMessageId, p_limit: limit,
    });
    if (error || !data) return [];
    return data as Message[];
  }, []);

  interface AttachmentInput {
    bucket: string;
    storage_path: string;
    url: string;
    mime_type: string;
    size_bytes: number;
    width?: number;
    height?: number;
    duration_seconds?: number;
    waveform?: number[];
    thumbnail_url?: string;
  }

  const sendMessage = useCallback(async (
    conversationId: string,
    type: MessageType,
    content: string | null = null,
    metadata: Record<string, unknown> = {},
    replyToMessageId: string | null = null,
    forwardedFromMessageId: string | null = null,
    attachments: AttachmentInput[] = [],
  ): Promise<{ error: string | null; messageId: string | null }> => {
    if (!user) return { error: 'Not authenticated', messageId: null };
    const { data, error } = await supabase.rpc('send_message', {
      p_conversation_id: conversationId,
      p_type: type,
      p_content: content,
      p_metadata: metadata,
      p_reply_to_message_id: replyToMessageId,
      p_forwarded_from_message_id: forwardedFromMessageId,
      p_attachments: attachments,
    });
    if (error || !data) return { error: error?.message ?? 'Could not send message.', messageId: null };
    return { error: null, messageId: data as string };
  }, [user]);

  const editMessage = useCallback(async (messageId: string, content: string): Promise<AuthResult> => {
    const trimmed = content.trim();
    if (!trimmed) return { error: 'Message cannot be empty.' };
    const { error } = await supabase.from('messages').update({ content: trimmed }).eq('id', messageId);
    return { error: error?.message ?? null };
  }, []);

  const unsendMessage = useCallback(async (messageId: string): Promise<AuthResult> => {
    const { error } = await supabase.from('messages').update({ is_unsent: true }).eq('id', messageId);
    return { error: error?.message ?? null };
  }, []);

  const setMessagePinned = useCallback(async (messageId: string, pinned: boolean): Promise<AuthResult> => {
    const { error } = await supabase.from('messages').update({ is_pinned: pinned }).eq('id', messageId);
    return { error: error?.message ?? null };
  }, []);

  const starMessage = useCallback(async (messageId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('message_stars').insert({ message_id: messageId, user_id: user.id });
    return { error: error?.message ?? null };
  }, [user]);

  const unstarMessage = useCallback(async (messageId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('message_stars').delete().eq('message_id', messageId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const reactToMessage = useCallback(async (messageId: string, emoji: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('message_reactions')
      .upsert({ message_id: messageId, user_id: user.id, emoji }, { onConflict: 'message_id,user_id' });
    return { error: error?.message ?? null };
  }, [user]);

  const removeMessageReaction = useCallback(async (messageId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const deleteMessageForMe = useCallback(async (messageId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('message_deletes').insert({ message_id: messageId, user_id: user.id });
    return { error: error?.message ?? null };
  }, [user]);

  const markConversationRead = useCallback(async (conversationId: string): Promise<void> => {
    await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
  }, []);

  const markMessagesDelivered = useCallback(async (conversationId: string): Promise<void> => {
    await supabase.rpc('mark_messages_delivered', { p_conversation_id: conversationId });
  }, []);

  const setTyping = useCallback(async (conversationId: string, isTyping: boolean): Promise<void> => {
    await supabase.rpc('set_typing', { p_conversation_id: conversationId, p_is_typing: isTyping });
  }, []);

  const setConversationActive = useCallback(async (conversationId: string, isActive: boolean): Promise<void> => {
    await supabase.rpc('set_conversation_active', { p_conversation_id: conversationId, p_is_active: isActive });
  }, []);

  const setConversationPinned = useCallback(async (conversationId: string, pinned: boolean): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('conversation_members').update({ is_pinned: pinned }).eq('conversation_id', conversationId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const setConversationMuted = useCallback(async (conversationId: string, muted: boolean): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('conversation_members').update({ is_muted: muted }).eq('conversation_id', conversationId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const setConversationArchived = useCallback(async (conversationId: string, archived: boolean): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('conversation_members').update({ is_archived: archived }).eq('conversation_id', conversationId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const searchConversations = useCallback(async (query: string): Promise<ConversationSearchResult[]> => {
    if (!query.trim()) return [];
    const { data, error } = await supabase.rpc('search_conversations', { p_query: query.trim() });
    if (error || !data) return [];
    return data as ConversationSearchResult[];
  }, []);

  const searchMessages = useCallback(async (query: string): Promise<MessageSearchResult[]> => {
    if (!query.trim()) return [];
    const { data, error } = await supabase.rpc('search_messages', { p_query: query.trim() });
    if (error || !data) return [];
    return data as MessageSearchResult[];
  }, []);

  const getConversationMedia = useCallback(async (conversationId: string): Promise<ConversationMediaItem[]> => {
    const { data, error } = await supabase.rpc('get_conversation_media', { p_conversation_id: conversationId });
    if (error || !data) return [];
    return data as ConversationMediaItem[];
  }, []);

  return {
    canMessage,
    getOrCreateConversation,
    getConversations,
    getConversationHeader,
    getMessageRequests,
    acceptMessageRequest,
    declineMessageRequest,
    getMessages,
    sendMessage,
    editMessage,
    unsendMessage,
    setMessagePinned,
    starMessage,
    unstarMessage,
    reactToMessage,
    removeMessageReaction,
    deleteMessageForMe,
    markConversationRead,
    markMessagesDelivered,
    setTyping,
    setConversationActive,
    setConversationPinned,
    setConversationMuted,
    setConversationArchived,
    searchConversations,
    searchMessages,
    getConversationMedia,
  };
};
