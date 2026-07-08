import React, { useCallback, useState } from 'react';
import { useSocial } from '../hooks/useSocial';
import { UserSearchBar } from '../components/social/UserSearchBar';
import { UserSearchResults } from '../components/social/UserSearchResults';
import { SuggestedFriends } from '../components/social/SuggestedFriends';
import type { SocialUserWithRelationship } from '../types/social';

export const SearchPage: React.FC = () => {
  const { searchUsers } = useSocial();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SocialUserWithRelationship[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchUsers(q).then(data => {
      setResults(data);
      setLoading(false);
    });
  }, [searchUsers]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-gray-900">Search</h1>
      <UserSearchBar onSearch={handleSearch} />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        {query ? (
          <UserSearchResults users={results} loading={loading} />
        ) : (
          <>
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Suggested for you</h2>
            <SuggestedFriends />
          </>
        )}
      </div>
    </div>
  );
};
