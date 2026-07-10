import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import type {
  CollectionSearchResult, ExploreTab, Memory, RecentSearch, SearchSuggestion, TrendingSearch,
} from '../types/memory';

// Phase 10a — Search + Explore. Every read here goes through a SECURITY
// DEFINER RPC, same reason as useSocial/useMemories: cross-user reads
// need a function that applies the real visibility rule (can_view_drop/
// can_view_capsule/can_view_moment) itself, since RLS alone only lets a
// user read their own rows. search_users() (Phase 3, in useSocial) is
// reused unchanged for the Users category.
export const useSearch = () => {
  const searchMemories = useCallback(async (
    query: string,
    contentTypes: string[] | null = null,
    sort: 'newest' | 'oldest' | 'trending' | 'popular' = 'newest',
    limit = 20,
    offset = 0,
  ): Promise<Memory[]> => {
    const { data, error } = await supabase.rpc('search_memories', {
      p_query: query || null,
      p_tag: null,
      p_content_types: contentTypes,
      p_sort: sort,
      p_today_only: false,
      p_limit: limit,
      p_offset: offset,
    });
    if (error || !data) return [];
    return data as Memory[];
  }, []);

  const searchCollections = useCallback(async (query: string, limit = 20): Promise<CollectionSearchResult[]> => {
    const { data, error } = await supabase.rpc('search_collections', { p_query: query || null, p_limit: limit });
    if (error || !data) return [];
    return data as CollectionSearchResult[];
  }, []);

  const getExploreFeed = useCallback(async (tab: ExploreTab, limit = 20, offset = 0): Promise<Memory[]> => {
    const { data, error } = await supabase.rpc('get_explore_feed', { p_tab: tab, p_limit: limit, p_offset: offset });
    if (error || !data) return [];
    return data as Memory[];
  }, []);

  const recordSearch = useCallback(async (query: string): Promise<void> => {
    if (!query.trim()) return;
    await supabase.rpc('record_search', { p_query: query });
    void track('search_performed', {});
  }, []);

  const getRecentSearches = useCallback(async (limit = 10): Promise<RecentSearch[]> => {
    const { data, error } = await supabase.rpc('get_recent_searches', { p_limit: limit });
    if (error || !data) return [];
    return data as RecentSearch[];
  }, []);

  const clearSearchHistory = useCallback(async (): Promise<void> => {
    await supabase.rpc('clear_search_history');
  }, []);

  const getTrendingSearches = useCallback(async (limit = 10): Promise<TrendingSearch[]> => {
    const { data, error } = await supabase.rpc('get_trending_searches', { p_limit: limit });
    if (error || !data) return [];
    return data as TrendingSearch[];
  }, []);

  const getSearchSuggestions = useCallback(async (prefix: string, limit = 8): Promise<SearchSuggestion[]> => {
    if (!prefix.trim()) return [];
    const { data, error } = await supabase.rpc('get_search_suggestions', { p_prefix: prefix, p_limit: limit });
    if (error || !data) return [];
    return data as SearchSuggestion[];
  }, []);

  return {
    searchMemories,
    searchCollections,
    getExploreFeed,
    recordSearch,
    getRecentSearches,
    clearSearchHistory,
    getTrendingSearches,
    getSearchSuggestions,
  };
};
