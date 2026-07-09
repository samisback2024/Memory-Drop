import React from 'react';
import { useParams } from 'react-router-dom';
import { MemoryViewer } from '../components/memories/MemoryViewer';
import type { MemorySourceType } from '../types/memory';

// A permalink to a single memory, at /memories/:memoryType/:memoryId.
export const MemoryDetailPage: React.FC = () => {
  const { memoryType, memoryId } = useParams<{ memoryType: string; memoryId: string }>();

  if (!memoryId || (memoryType !== 'capsule' && memoryType !== 'moment' && memoryType !== 'drop')) return null;

  return (
    <div className="max-w-lg mx-auto">
      <MemoryViewer memoryType={memoryType as MemorySourceType} memoryId={memoryId} />
    </div>
  );
};
