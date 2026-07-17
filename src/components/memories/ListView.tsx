import React from 'react';
import { MemoryCard } from './MemoryCard';
import type { Memory } from '../../types/memory';

export const ListView: React.FC<{ memories: Memory[] }> = ({ memories }) => (
  <div className="flex flex-col divide-y divide-gray-100 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm px-3">
    {memories.map(m => <MemoryCard key={`${m.memory_type}-${m.id}`} memory={m} variant="list" />)}
  </div>
);
