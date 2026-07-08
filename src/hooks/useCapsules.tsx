import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { demoCapsules, DEMO_USER_ID } from '../lib/demo-data';
import { isUnlocked } from '../utils/date';
import type { Capsule, CreateCapsuleForm } from '../types';
import { useAuth } from './useAuth';
import { uploadFile, generateStoragePath } from '../utils/storage';

export const useCapsules = () => {
  const { isDemo, user, profile } = useAuth();
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCapsules = useCallback(async () => {
    setLoading(true);
    if (isDemo) {
      setCapsules(demoCapsules);
      setLoading(false);
      return;
    }
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('capsules')
      .select('*, profiles(*), capsule_media(*)')
      .order('created_at', { ascending: false });
    if (!error && data) setCapsules(data as Capsule[]);
    setLoading(false);
  }, [isDemo, user]);

  useEffect(() => { fetchCapsules(); }, [fetchCapsules]);

  const getUnlocked = useCallback((): Capsule[] =>
    capsules.filter(c => isUnlocked(c.unlock_date)), [capsules]);

  const getLocked = useCallback((): Capsule[] =>
    capsules.filter(c => !isUnlocked(c.unlock_date)), [capsules]);

  const getMyCapsules = useCallback((): Capsule[] => {
    const id = isDemo ? DEMO_USER_ID : user?.id;
    return capsules.filter(c => c.user_id === id);
  }, [capsules, isDemo, user]);

  const getFeedCapsules = useCallback((): Capsule[] =>
    capsules.filter(c => c.visibility === 'public'), [capsules]);

  const createCapsule = async (form: CreateCapsuleForm): Promise<{ error: string | null }> => {
    if (isDemo) {
      const newCapsule: Capsule = {
        id: `capsule-${Date.now()}`,
        user_id: DEMO_USER_ID,
        title: form.title,
        message: form.message,
        unlock_date: form.unlock_date,
        visibility: form.visibility,
        tags: form.tags,
        location: form.location || null,
        created_at: new Date().toISOString(),
        profiles: profile ?? undefined,
        capsule_media: [],
      };
      setCapsules(prev => [newCapsule, ...prev]);
      return { error: null };
    }
    if (!user) return { error: 'Not authenticated' };

    const { data: capsuleData, error } = await supabase
      .from('capsules')
      .insert({
        user_id: user.id,
        title: form.title,
        message: form.message,
        unlock_date: form.unlock_date,
        visibility: form.visibility,
        tags: form.tags,
        location: form.location || null,
      })
      .select()
      .single();

    if (error) return { error: error.message };
    if (capsuleData && form.media_files.length > 0) {
      for (const file of form.media_files) {
        const path = generateStoragePath(user.id, file.name);
        const url = await uploadFile('capsule-media', path, file);
        if (url) {
          const mimeType = file.type;
          const type = mimeType.startsWith('video') ? 'video' : mimeType.startsWith('audio') ? 'audio' : 'photo';
          await supabase.from('capsule_media').insert({
            capsule_id: capsuleData.id,
            type,
            url,
          });
        }
      }
    }
    await fetchCapsules();
    return { error: null };
  };

  const deleteCapsule = async (capsuleId: string): Promise<void> => {
    if (isDemo) {
      setCapsules(prev => prev.filter(c => c.id !== capsuleId));
      return;
    }
    await supabase.from('capsules').delete().eq('id', capsuleId);
    setCapsules(prev => prev.filter(c => c.id !== capsuleId));
  };

  return { capsules, loading, fetchCapsules, getUnlocked, getLocked, getMyCapsules, getFeedCapsules, createCapsule, deleteCapsule };
};
