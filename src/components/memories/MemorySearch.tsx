import React from 'react';
import { Search } from 'lucide-react';

interface MemorySearchProps {
  value: string;
  onChange: (value: string) => void;
}

// Search only ever matches your own memories (title/caption) — the RPC
// itself restricts it that way, same as Capsules' archive search.
export const MemorySearch: React.FC<MemorySearchProps> = ({ value, onChange }) => (
  <div className="relative">
    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Search your memories…"
      className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
    />
  </div>
);
