import React from 'react';
import { MemoryCard } from './MemoryCard';
import type { Memory } from '../../types/memory';

export const ListView: React.FC<{ memories: Memory[] }> = ({ memories }) => (
  <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800 bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-gray-800/60 shadow-sm px-3">
    {memories.map(m => <MemoryCard key={`${m.memory_type}-${m.id}`} memory={m} variant="list" />)}
  </div>
);
