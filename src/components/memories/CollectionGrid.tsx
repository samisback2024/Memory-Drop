import React, { useState } from 'react';
import { Plus, X, FolderHeart } from 'lucide-react';
import { useMemories } from '../../hooks/useMemories';
import { TimelineView } from './TimelineView';
import { EmptyState } from '../ui/EmptyState';
import { EMPTY_MEMORY_FILTERS, type Memory, type MemoryCollection } from '../../types/memory';

interface CollectionGridProps {
  collections: MemoryCollection[];
  onCollectionsChanged: () => void;
}

// Collections are always folders you fill yourself — "automatically
// generated" only means the starter set (Travel, Birthday, ...) shows
// up on its own; there's no content analysis deciding what belongs in
// them. Adding a memory to one happens from the Memory Details page.
export const CollectionGrid: React.FC<CollectionGridProps> = ({ collections, onCollectionsChanged }) => {
  const { getMemories, createCollection, deleteCollection } = useMemories();
  const [openId, setOpenId] = useState<string | null>(null);
  const [openMemories, setOpenMemories] = useState<Memory[]>([]);
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const openCollection = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    setLoadingOpen(true);
    const data = await getMemories({ ...EMPTY_MEMORY_FILTERS, collectionId: id }, 'newest', 100, 0);
    setOpenMemories(data);
    setLoadingOpen(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const { error: createError } = await createCollection(newName, '📁');
    if (createError) { setError(createError); return; }
    setNewName('');
    setCreating(false);
    setError(null);
    onCollectionsChanged();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this collection? Memories inside it are not deleted.')) return;
    await deleteCollection(id);
    if (openId === id) setOpenId(null);
    onCollectionsChanged();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {collections.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => openCollection(c.id)}
            className={[
              'relative flex flex-col items-start gap-1.5 p-4 rounded-2xl border text-left transition-colors',
              openId === c.id ? 'bg-purple-50 border-purple-300' : 'bg-white/80 backdrop-blur-xl border-white/60 hover:border-purple-200',
            ].join(' ')}
          >
            <span className="text-xl">{c.icon || '📁'}</span>
            <span className="text-sm font-medium text-gray-900">{c.name}</span>
            <span className="text-xs text-gray-400">{c.item_count} {c.item_count === 1 ? 'memory' : 'memories'}</span>
            {!c.is_default && (
              <span
                role="button"
                tabIndex={0}
                onClick={e => handleDelete(c.id, e)}
                aria-label={`Delete ${c.name}`}
                className="absolute top-2 right-2 p-1 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X size={12} aria-hidden="true" />
              </span>
            )}
          </button>
        ))}

        {creating ? (
          <div className="flex flex-col gap-2 p-4 rounded-2xl border border-dashed border-purple-300 bg-purple-50/40">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="Collection name"
              autoFocus
              maxLength={60}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex gap-2">
              <button type="button" onClick={handleCreate} className="text-xs font-medium text-white bg-purple-600 rounded-lg px-3 py-1.5">Create</button>
              <button type="button" onClick={() => { setCreating(false); setError(null); }} className="text-xs font-medium text-gray-500 px-2 py-1.5">Cancel</button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-purple-300 hover:text-purple-500 transition-colors"
          >
            <Plus size={18} aria-hidden="true" />
            <span className="text-xs font-medium">New collection</span>
          </button>
        )}
      </div>

      {openId && (
        loadingOpen ? (
          <div className="h-32 rounded-2xl bg-white/60 animate-pulse" />
        ) : openMemories.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm">
            <EmptyState icon={FolderHeart} title="Nothing here yet" description="Add memories to this collection from their Memory Details page." />
          </div>
        ) : (
          <TimelineView memories={openMemories} />
        )
      )}
    </div>
  );
};
