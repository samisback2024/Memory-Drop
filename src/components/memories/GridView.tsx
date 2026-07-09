import React from 'react';
import { MemoryCard } from './MemoryCard';
import type { Memory } from '../../types/memory';

export const GridView: React.FC<{ memories: Memory[] }> = ({ memories }) => (
  <div className="grid grid-cols-3 gap-1.5">
    {memories.map(m => <MemoryCard key={`${m.memory_type}-${m.id}`} memory={m} variant="grid" />)}
  </div>
);
