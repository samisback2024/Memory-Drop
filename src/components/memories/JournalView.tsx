import React from 'react';
import { MemoryCard } from './MemoryCard';
import type { Memory } from '../../types/memory';

// Large, spacious, one entry at a time — reads like flipping through a
// journal rather than scanning a feed.
export const JournalView: React.FC<{ memories: Memory[] }> = ({ memories }) => (
  <div className="flex flex-col gap-6">
    {memories.map(m => <MemoryCard key={`${m.memory_type}-${m.id}`} memory={m} variant="journal" />)}
  </div>
);
