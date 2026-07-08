import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { demoConversations, demoMessages, DEMO_USER_ID } from '../lib/demo-data';
import type { Conversation, Message } from '../types';
import { useAuth } from './useAuth';

export const useMessages = () => {
  const { isDemo, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    if (isDemo) {
      setConversations(demoConversations);
      setLoading(false);
      return;
    }
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('conversations')
      .select('*, messages(*, profiles(*))')
      .order('updated_at', { ascending: false });
    if (!error && data) setConversations(data as Conversation[]);
    setLoading(false);
  }, [isDemo, user]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const fetchMessages = useCallback(async (convId: string) => {
    setActiveConvId(convId);
    if (isDemo) {
      setMessages(demoMessages[convId] ?? []);
      return;
    }
    if (!user) return;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    if (!error && data) setMessages(data as Message[]);
  }, [isDemo, user]);

  const sendMessage = async (convId: string, content: string): Promise<{ error: string | null }> => {
    if (!content.trim()) return { error: null };
    if (isDemo) {
      const newMsg: Message = {
        id: `msg-${Date.now()}`,
        conversation_id: convId,
        sender_id: DEMO_USER_ID,
        content: content.trim(),
        created_at: new Date().toISOString(),
        read_at: null,
      };
      setMessages(prev => [...prev, newMsg]);
      setConversations(prev =>
        prev.map(c =>
          c.id === convId
            ? { ...c, last_message: newMsg, updated_at: newMsg.created_at }
            : c,
        ),
      );
      return { error: null };
    }
    if (!user) return { error: 'Not authenticated' };
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: convId, sender_id: user.id, content: content.trim() })
      .select()
      .single();
    if (error) return { error: error.message };
    if (data) setMessages(prev => [...prev, data as Message]);
    return { error: null };
  };

  const startConversation = async (otherUserId: string): Promise<string | null> => {
    if (isDemo) return 'conv-001';
    if (!user) return null;
    const { data, error } = await supabase
      .rpc('get_or_create_conversation', { user1: user.id, user2: otherUserId });
    if (error) return null;
    await fetchConversations();
    return data as string;
  };

  return {
    conversations,
    messages,
    activeConvId,
    loading,
    fetchConversations,
    fetchMessages,
    sendMessage,
    startConversation,
  };
};
