import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MemorySourceType, SavedMemory } from '../types/memory';

// Phase 10c — unifies saved_posts (Drops) + capsule_saves (Capsules)
// behind get_saved_memories(); unsaving still delegates to useDrops/
// useCapsules (unsaveDrop/unsaveCapsule) rather than a new direct-table
// call here, so the existing per-card "Saved" toggle state and this
// page never disagree about which function removes a save row.
export const useSaved = () => {
  const getSavedMemories = useCallback(async (
    query: string,
    contentTypes: string[] | null,
    collectionId: string | null,
    sort: 'newest' | 'oldest',
    limit = 20,
    offset = 0,
  ): Promise<SavedMemory[]> => {
    const { data, error } = await supabase.rpc('get_saved_memories', {
      p_query: query || null,
      p_content_types: contentTypes,
      p_collection_id: collectionId,
      p_sort: sort,
      p_limit: limit,
      p_offset: offset,
    });
    if (error || !data) return [];
    return data as SavedMemory[];
  }, []);

  const updateSavedNote = useCallback(async (memoryType: MemorySourceType, memoryId: string, note: string): Promise<void> => {
    await supabase.rpc('update_saved_note', { p_memory_type: memoryType, p_memory_id: memoryId, p_note: note });
  }, []);

  return { getSavedMemories, updateSavedNote };
};
