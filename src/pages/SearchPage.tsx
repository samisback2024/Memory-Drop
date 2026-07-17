import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { useSocial } from '../hooks/useSocial';
import { useSearch } from '../hooks/useSearch';
import { UserSearchResults } from '../components/social/UserSearchResults';
import { SuggestedFriends } from '../components/social/SuggestedFriends';
import { GridView } from '../components/memories/GridView';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { SocialUserWithRelationship } from '../types/social';
import type { Memory, RecentSearch, SearchSuggestion, TrendingSearch } from '../types/memory';

type ResultType = 'all' | 'user' | 'drop' | 'capsule' | 'moment';

const TYPE_CHIPS: { id: ResultType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'user', label: 'Users' },
  { id: 'drop', label: 'Drops' },
  { id: 'capsule', label: 'Capsules' },
  { id: 'moment', label: 'Moments' },
];

const DEBOUNCE_MS = 350;

// Unified search — Phase 10a. Users search reuses Phase 3's search_users()
// unchanged (via useSocial); Drops/Capsules/Moments/tags/locations all go
// through search_memories() (Phase 10a), which returns the exact Memory
// shape get_memories() does, so results render with the same GridView/
// MemoryCard used everywhere else in the app.
export const SearchPage: React.FC = () => {
  const { searchUsers } = useSocial();
  const { searchMemories, recordSearch, getRecentSearches, clearSearchHistory, getTrendingSearches, getSearchSuggestions } = useSearch();
  const isOnline = useOnlineStatus();

  const [inputValue, setInputValue] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [activeType, setActiveType] = useState<ResultType>('all');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [users, setUsers] = useState<SocialUserWithRelationship[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);

  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearch[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refreshRecent = useCallback(() => {
    getRecentSearches(8).then(setRecentSearches);
  }, [getRecentSearches]);

  useEffect(() => {
    refreshRecent();
    getTrendingSearches(8).then(setTrendingSearches);
  }, [refreshRecent, getTrendingSearches]);

  // Suggestions while typing, before a search is committed.
  useEffect(() => {
    if (!inputValue.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      getSearchSuggestions(inputValue.trim(), 8).then(setSuggestions);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue, getSearchSuggestions]);

  const runSearch = useCallback((query: string, type: ResultType) => {
    if (!query) {
      setUsers([]);
      setMemories([]);
      return;
    }
    setLoading(true);
    setShowSuggestions(false);
    recordSearch(query).then(refreshRecent);

    const contentTypes = type === 'drop' || type === 'capsule' || type === 'moment' ? [type] : null;
    const wantUsers = type === 'all' || type === 'user';
    const wantMemories = type === 'all' || contentTypes !== null;

    Promise.all([
      wantUsers ? searchUsers(query) : Promise.resolve([]),
      wantMemories ? searchMemories(query, contentTypes, 'newest', 30, 0) : Promise.resolve([]),
    ]).then(([userResults, memoryResults]) => {
      setUsers(userResults);
      setMemories(memoryResults);
      setLoading(false);
    });
  }, [recordSearch, refreshRecent, searchUsers, searchMemories]);

  // Debounced auto-search as the user types (in addition to explicit
  // submit/suggestion-click, which commit immediately without waiting).
  useEffect(() => {
    const trimmed = inputValue.trim();
    const timer = setTimeout(() => setCommittedQuery(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    runSearch(committedQuery, activeType);
  }, [committedQuery, activeType, runSearch]);

  const submitQuery = (q: string) => {
    setInputValue(q);
    setCommittedQuery(q);
  };

  const clear = () => {
    setInputValue('');
    setCommittedQuery('');
    setUsers([]);
    setMemories([]);
    inputRef.current?.focus();
  };

  const showResults = committedQuery.length > 0;
  const showUsers = activeType === 'all' || activeType === 'user';
  const showMemories = activeType === 'all' || activeType === 'drop' || activeType === 'capsule' || activeType === 'moment';
  const nothingFound = !loading && users.length === 0 && memories.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Search</h1>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => { blurTimer.current = setTimeout(() => setShowSuggestions(false), 150); }}
          onKeyDown={e => { if (e.key === 'Enter') submitQuery(inputValue.trim()); }}
          placeholder="Search users, drops, capsules, moments, tags, locations..."
          aria-label="Search Memory Drop"
          className="w-full border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 pl-10 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-150"
        />
        {inputValue && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div role="listbox" className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-30 overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={`${s.suggestion_type}-${s.suggestion}-${i}`}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={() => submitQuery(s.suggestion)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {s.suggestion_type === 'user' ? <Search size={13} className="text-gray-400" aria-hidden="true" /> : <TrendingUp size={13} className="text-gray-400" aria-hidden="true" />}
                {s.suggestion_type === 'user' ? `@${s.suggestion}` : s.suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {showResults && (
        <div role="tablist" aria-label="Result type" className="flex gap-1.5 overflow-x-auto pb-0.5">
          {TYPE_CHIPS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeType === id}
              onClick={() => setActiveType(id)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
                activeType === id ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!showResults && (
        <div className="flex flex-col gap-4">
          {recentSearches.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <Clock size={14} className="text-purple-500" aria-hidden="true" />
                  Recent searches
                </h2>
                <button
                  type="button"
                  onClick={() => clearSearchHistory().then(refreshRecent)}
                  className="text-xs font-medium text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map(r => (
                  <button
                    key={r.query}
                    type="button"
                    onClick={() => submitQuery(r.query)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    {r.query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {trendingSearches.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 mb-2">
                <TrendingUp size={14} className="text-purple-500" aria-hidden="true" />
                Trending searches
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {trendingSearches.map(t => (
                  <button
                    key={t.query}
                    type="button"
                    onClick={() => submitQuery(t.query)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    {t.query}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Suggested for you</h2>
            <SuggestedFriends />
          </div>
        </div>
      )}

      {showResults && loading && (
        <div className="grid grid-cols-3 gap-1.5">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="aspect-square rounded-xl bg-gray-50 animate-pulse" />)}</div>
      )}

      {showResults && !loading && nothingFound && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          {!isOnline ? (
            <ErrorState title="You're offline" description="Reconnect and try again." onRetry={() => runSearch(committedQuery, activeType)} />
          ) : (
            <EmptyState icon={Search} title="No results" description={`Nothing matched "${committedQuery}" yet.`} />
          )}
        </div>
      )}

      {showResults && !loading && !nothingFound && (
        <div className="flex flex-col gap-4">
          {showUsers && users.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Users</h2>
              <UserSearchResults users={users} loading={false} />
            </div>
          )}

          {showMemories && memories.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Memories</h2>
              <GridView memories={memories} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
