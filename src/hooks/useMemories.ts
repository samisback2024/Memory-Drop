import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useCapsules } from './useCapsules';
import { useMoments } from './useMoments';
import { useDrops } from './useDrops';
import type { AuthResult } from '../types/auth';
import type {
  Memory, MemoryFilters, MemoryCollection, Flashback, HighlightCandidate, HighlightType, MemoryStreak,
  MemoryStats, PublicStats, MemorySort, MemorySourceType,
} from '../types/memory';

// Reads all go through get_memories()/get_memory() and friends — the one
// UNION-at-read-time layer over Drops + Capsules + expired Moments
// described in phase7_memories.sql/phase9_unified_memory_wiring.sql.
// Writes that touch drops/capsules/moments directly (hide/restore/
// delete/tags) delegate to useDrops/useCapsules/useMoments so storage
// cleanup on delete stays in one place rather than being reimplemented
// here. Drops don't have `hidden_at`/`tags` columns (Phase 7 only added
// those to capsules/moments) — hide/restore/updateTags on a Drop return
// an explicit error rather than silently no-op-ing.
export const useMemories = () => {
  const { user } = useAuth();
  const { deleteCapsule, getCapsule } = useCapsules();
  const { deleteMoment, getUserMoments } = useMoments();
  const { deleteDrop, getDrop } = useDrops();

  const getMemories = useCallback(async (
    filters: Partial<MemoryFilters> = {},
    sort: MemorySort = 'newest',
    limit = 20,
    offset = 0,
    targetUserId?: string,
  ): Promise<Memory[]> => {
    const { data, error } = await supabase.rpc('get_memories', {
      p_user_id: targetUserId ?? null,
      p_search: filters.search || null,
      p_lock_status: filters.lockStatus ?? null,
      p_year: filters.year ?? null,
      p_month: filters.month ?? null,
      p_mood: filters.mood ?? null,
      p_visibility: filters.visibility ?? null,
      p_media_type: filters.mediaType ?? null,
      p_favorites_only: filters.favoritesOnly ?? false,
      p_collection_id: filters.collectionId ?? null,
      p_include_hidden: false,
      p_sort: sort,
      p_limit: limit,
      p_offset: offset,
    });
    if (error || !data) return [];
    return data as Memory[];
  }, []);

  const getArchivedMemories = useCallback(async (limit = 20, offset = 0): Promise<Memory[]> => {
    const { data, error } = await supabase.rpc('get_memories', {
      p_user_id: null, p_search: null, p_lock_status: null, p_year: null, p_month: null,
      p_mood: null, p_visibility: null, p_media_type: null, p_favorites_only: false,
      p_collection_id: null, p_include_hidden: true, p_archived_only: true,
      p_sort: 'newest', p_limit: limit, p_offset: offset,
    });
    if (error || !data) return [];
    return data as Memory[];
  }, []);

  const getMemory = useCallback(async (memoryType: MemorySourceType, memoryId: string): Promise<Memory | null> => {
    const { data, error } = await supabase.rpc('get_memory', { p_memory_type: memoryType, p_memory_id: memoryId });
    if (error || !data || data.length === 0) return null;
    return data[0] as Memory;
  }, []);

  const getMemoryCalendar = useCallback(async (year: number, month: number): Promise<Record<number, number>> => {
    const { data, error } = await supabase.rpc('get_memory_calendar', { p_year: year, p_month: month });
    if (error || !data) return {};
    const map: Record<number, number> = {};
    for (const row of data as { day: number; memory_count: number }[]) map[row.day] = row.memory_count;
    return map;
  }, []);

  const getMemoryYearCounts = useCallback(async (): Promise<{ year: number; memory_count: number }[]> => {
    const { data, error } = await supabase.rpc('get_memory_year_counts');
    if (error || !data) return [];
    return data as { year: number; memory_count: number }[];
  }, []);

  const getFlashbacks = useCallback(async (): Promise<Flashback[]> => {
    const { data, error } = await supabase.rpc('get_flashbacks');
    if (error || !data) return [];
    return data as Flashback[];
  }, []);

  const dismissFlashback = useCallback(async (memoryType: MemorySourceType, memoryId: string): Promise<void> => {
    await supabase.rpc('dismiss_flashback', { p_memory_type: memoryType, p_memory_id: memoryId });
  }, []);

  const getHighlightCandidates = useCallback(async (type: HighlightType, limit = 10): Promise<HighlightCandidate[]> => {
    const { data, error } = await supabase.rpc('get_highlight_candidates', { p_type: type, p_limit: limit });
    if (error || !data) return [];
    return data as HighlightCandidate[];
  }, []);

  const getMemoryStreak = useCallback(async (): Promise<MemoryStreak> => {
    const { data, error } = await supabase.rpc('get_memory_streak');
    if (error || !data || data.length === 0) return { current_streak: 0, longest_streak: 0 };
    return data[0] as MemoryStreak;
  }, []);

  const saveHighlight = useCallback(async (title: string, type: HighlightType, candidates: HighlightCandidate[]): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const capsuleIds = candidates.filter(c => c.memory_type === 'capsule').map(c => c.id);
    const momentIds = candidates.filter(c => c.memory_type === 'moment').map(c => c.id);
    const { error } = await supabase
      .from('memory_highlights')
      .insert({ user_id: user.id, title, highlight_type: type, capsule_ids: capsuleIds, moment_ids: momentIds });
    return { error: error?.message ?? null };
  }, [user]);

  const getCollections = useCallback(async (): Promise<MemoryCollection[]> => {
    await supabase.rpc('seed_default_collections');
    const { data, error } = await supabase.rpc('get_collections');
    if (error || !data) return [];
    return data as MemoryCollection[];
  }, []);

  const createCollection = useCallback(async (name: string, icon: string | null): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('memory_collections').insert({ user_id: user.id, name: name.trim(), icon });
    if (error) {
      if (/unique/i.test(error.message)) return { error: 'You already have a collection with that name.' };
      return { error: error.message };
    }
    return { error: null };
  }, [user]);

  const deleteCollection = useCallback(async (collectionId: string): Promise<AuthResult> => {
    const { error } = await supabase.from('memory_collections').delete().eq('id', collectionId);
    return { error: error?.message ?? null };
  }, []);

  const addToCollection = useCallback(async (collectionId: string, memoryType: MemorySourceType, memoryId: string): Promise<AuthResult> => {
    const payload: Record<string, string> = memoryType === 'capsule'
      ? { collection_id: collectionId, capsule_id: memoryId }
      : memoryType === 'moment'
      ? { collection_id: collectionId, moment_id: memoryId }
      : { collection_id: collectionId, drop_id: memoryId };
    const { error } = await supabase.from('collection_items').insert(payload);
    if (error && !/unique/i.test(error.message)) return { error: error.message };
    return { error: null };
  }, []);

  const removeFromCollection = useCallback(async (collectionId: string, memoryType: MemorySourceType, memoryId: string): Promise<AuthResult> => {
    let query = supabase.from('collection_items').delete().eq('collection_id', collectionId);
    query = memoryType === 'capsule' ? query.eq('capsule_id', memoryId) : memoryType === 'moment' ? query.eq('moment_id', memoryId) : query.eq('drop_id', memoryId);
    const { error } = await query;
    return { error: error?.message ?? null };
  }, []);

  const favoriteMemory = useCallback(async (memoryType: MemorySourceType, memoryId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const payload: Record<string, string> = memoryType === 'capsule'
      ? { user_id: user.id, capsule_id: memoryId }
      : memoryType === 'moment'
      ? { user_id: user.id, moment_id: memoryId }
      : { user_id: user.id, drop_id: memoryId };
    const { error } = await supabase.from('favorites').insert(payload);
    if (error && !/unique/i.test(error.message)) return { error: error.message };
    return { error: null };
  }, [user]);

  const unfavoriteMemory = useCallback(async (memoryType: MemorySourceType, memoryId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    let query = supabase.from('favorites').delete().eq('user_id', user.id);
    query = memoryType === 'capsule' ? query.eq('capsule_id', memoryId) : memoryType === 'moment' ? query.eq('moment_id', memoryId) : query.eq('drop_id', memoryId);
    const { error } = await query;
    return { error: error?.message ?? null };
  }, [user]);

  const hideMemory = useCallback(async (memoryType: MemorySourceType, memoryId: string): Promise<AuthResult> => {
    if (memoryType === 'drop') return { error: 'Drops can’t be hidden yet — only Capsules and Moments support archiving.' };
    const table = memoryType === 'capsule' ? 'capsules' : 'moments';
    const { error } = await supabase.from(table).update({ hidden_at: new Date().toISOString() }).eq('id', memoryId);
    return { error: error?.message ?? null };
  }, []);

  const restoreMemory = useCallback(async (memoryType: MemorySourceType, memoryId: string): Promise<AuthResult> => {
    if (memoryType === 'drop') return { error: 'Drops can’t be hidden yet — only Capsules and Moments support archiving.' };
    const table = memoryType === 'capsule' ? 'capsules' : 'moments';
    const { error } = await supabase.from(table).update({ hidden_at: null }).eq('id', memoryId);
    return { error: error?.message ?? null };
  }, []);

  // Delegates to useDrops/useCapsules/useMoments so storage cleanup on
  // delete (removing the media files, not just the row) stays defined in
  // one place rather than being reimplemented here.
  const deletePermanently = useCallback(async (memory: Memory): Promise<AuthResult> => {
    if (memory.memory_type === 'capsule') {
      const full = await getCapsule(memory.id);
      if (!full) return { error: 'Could not find this memory.' };
      return deleteCapsule(full);
    }
    if (memory.memory_type === 'drop') {
      const full = await getDrop(memory.id);
      if (!full) return { error: 'Could not find this memory.' };
      return deleteDrop(full);
    }
    if (!user) return { error: 'Not authenticated' };
    const stack = await getUserMoments(user.id, true);
    const full = stack.find(m => m.id === memory.id);
    if (!full) return { error: 'Could not find this memory.' };
    return deleteMoment(full);
  }, [getCapsule, deleteCapsule, getDrop, deleteDrop, getUserMoments, deleteMoment, user]);

  const updateTags = useCallback(async (memoryType: MemorySourceType, memoryId: string, tags: string[]): Promise<AuthResult> => {
    if (memoryType === 'drop') return { error: 'Tags aren’t available on Drops yet.' };
    const table = memoryType === 'capsule' ? 'capsules' : 'moments';
    const { error } = await supabase.from(table).update({ tags }).eq('id', memoryId);
    return { error: error?.message ?? null };
  }, []);

  const updateLocation = useCallback(async (memoryType: MemorySourceType, memoryId: string, location: string): Promise<AuthResult> => {
    if (memoryType !== 'capsule') return { error: 'Location can only be edited on capsules right now.' };
    const { error } = await supabase.from('capsules').update({ location_text: location.trim() || null }).eq('id', memoryId);
    return { error: error?.message ?? null };
  }, []);

  // The caller's own accurate counts (Profile's stats card) — a single
  // live-aggregated RPC rather than several separate queries the
  // frontend would have to keep in sync itself.
  const getMemoryStats = useCallback(async (): Promise<MemoryStats | null> => {
    const { data, error } = await supabase.rpc('get_memory_stats');
    if (error || !data || data.length === 0) return null;
    return data[0] as MemoryStats;
  }, []);

  // What's safe to show on someone else's profile — public memory count
  // plus social counts, nothing that could leak locked or private data.
  const getPublicStats = useCallback(async (targetUserId: string): Promise<PublicStats | null> => {
    const { data, error } = await supabase.rpc('get_public_stats', { p_user_id: targetUserId });
    if (error || !data || data.length === 0) return null;
    return data[0] as PublicStats;
  }, []);

  return {
    getMemories,
    getArchivedMemories,
    getMemory,
    getMemoryCalendar,
    getMemoryYearCounts,
    getFlashbacks,
    dismissFlashback,
    getHighlightCandidates,
    getMemoryStreak,
    saveHighlight,
    getCollections,
    createCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection,
    favoriteMemory,
    unfavoriteMemory,
    hideMemory,
    restoreMemory,
    deletePermanently,
    updateTags,
    updateLocation,
    getMemoryStats,
    getPublicStats,
  };
};
