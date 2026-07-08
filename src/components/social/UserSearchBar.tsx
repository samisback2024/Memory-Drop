import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

interface UserSearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 350;

export const UserSearchBar: React.FC<UserSearchBarProps> = ({ onSearch, placeholder = 'Search by username or name...' }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => onSearch(value.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, onSearch]);

  const clear = () => {
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search users"
        className="w-full border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 pl-10 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-150"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
