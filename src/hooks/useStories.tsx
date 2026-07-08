import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { demoStories, DEMO_USER_ID } from '../lib/demo-data';
import { isStoryExpired } from '../utils/date';
import type { Story, CreateStoryForm } from '../types';
import { useAuth } from './useAuth';
import { uploadFile, generateStoragePath } from '../utils/storage';

export const useStories = () => {
  const { isDemo, user, profile } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStories = useCallback(async () => {
    setLoading(true);
    if (isDemo) {
      setStories(demoStories.filter(s => !isStoryExpired(s.expires_at)));
      setLoading(false);
      return;
    }
    if (!user) { setLoading(false); return; }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('stories')
      .select('*, profiles(*)')
      .gt('expires_at', now)
      .order('created_at', { ascending: false });
    if (!error && data) setStories(data as Story[]);
    setLoading(false);
  }, [isDemo, user]);

  useEffect(() => { fetchStories(); }, [fetchStories]);

  const createStory = async (form: CreateStoryForm): Promise<{ error: string | null }> => {
    if (isDemo) {
      const expiresAt = new Date(Date.now() + form.duration_hours * 3600000).toISOString();
      const newStory: Story = {
        id: `story-${Date.now()}`,
        user_id: DEMO_USER_ID,
        content_url: null,
        content_type: form.content_type,
        text_content: form.text_content,
        duration_hours: form.duration_hours,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        profiles: profile ?? undefined,
      };
      setStories(prev => [newStory, ...prev]);
      return { error: null };
    }
    if (!user) return { error: 'Not authenticated' };

    let content_url: string | null = null;
    if (form.media_file) {
      const path = generateStoragePath(user.id, form.media_file.name);
      content_url = await uploadFile('stories', path, form.media_file);
    }

    const expiresAt = new Date(Date.now() + form.duration_hours * 3600000).toISOString();
    const { error } = await supabase.from('stories').insert({
      user_id: user.id,
      content_url,
      content_type: form.content_type,
      text_content: form.text_content ?? null,
      duration_hours: form.duration_hours,
      expires_at: expiresAt,
    });
    if (error) return { error: error.message };
    await fetchStories();
    return { error: null };
  };

  const deleteStory = async (storyId: string): Promise<void> => {
    if (isDemo) {
      setStories(prev => prev.filter(s => s.id !== storyId));
      return;
    }
    await supabase.from('stories').delete().eq('id', storyId);
    setStories(prev => prev.filter(s => s.id !== storyId));
  };

  return { stories, loading, fetchStories, createStory, deleteStory };
};
