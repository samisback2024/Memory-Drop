import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon, Video, Music, Mic, PenLine, FolderPlus, X, Plus, StickyNote, BookmarkX } from 'lucide-react';
import { useSaved } from '../../hooks/useSaved';
import { useMemories } from '../../hooks/useMemories';
import { supabase } from '../../lib/supabase';
import { MOOD_META } from '../../types/feed';
import { formatRelativeTime } from '../../utils/date';
import type { MemoryCollection, SavedMemory } from '../../types/memory';
import type { CapsuleMemoryType } from '../../types/capsule';

const TYPE_ICONS: Record<CapsuleMemoryType, typeof ImageIcon> = {
  text: PenLine, photo: ImageIcon, video: Video, audio: Music, voice: Mic,
};

interface SavedMemoryRowProps {
  memory: SavedMemory;
  collections: MemoryCollection[];
  onUnsave: () => void;
}

export const SavedMemoryRow: React.FC<SavedMemoryRowProps> = ({ memory, collections, onUnsave }) => {
  const { updateSavedNote } = useSaved();
  const { addToCollection, removeFromCollection } = useMemories();
  const [note, setNote] = useState(memory.note ?? '');
  const [editingNote, setEditingNote] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());

  const moodMeta = memory.mood ? MOOD_META[memory.mood] : null;
  const cover = memory.media.find(m => m.type === 'photo' || m.type === 'video');
  const primaryType = memory.memory_types[0] ?? 'text';
  const TypeIcon = TYPE_ICONS[primaryType];
  const href = `/memories/${memory.memory_type}/${memory.id}`;
  const snippet = memory.title || memory.caption || 'A memory without words';
  const collectionColumn = memory.memory_type === 'capsule' ? 'capsule_id' : 'drop_id';

  useEffect(() => {
    if (!collectionsOpen) return;
    supabase
      .from('collection_items')
      .select('collection_id')
      .eq(collectionColumn, memory.id)
      .then(({ data }) => setMemberIds(new Set((data ?? []).map(row => row.collection_id as string))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionsOpen]);

  const saveNote = () => {
    setEditingNote(false);
    updateSavedNote(memory.memory_type, memory.id, note);
  };

  const toggleCollection = async (collectionId: string) => {
    const inCollection = memberIds.has(collectionId);
    const next = new Set(memberIds);
    if (inCollection) next.delete(collectionId); else next.add(collectionId);
    setMemberIds(next);
    if (inCollection) await removeFromCollection(collectionId, memory.memory_type, memory.id);
    else await addToCollection(collectionId, memory.memory_type, memory.id);
  };

  return (
    <div className="flex flex-col gap-2 py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <Link to={href} className="w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100 flex-shrink-0 flex items-center justify-center">
          {cover ? <img src={cover.url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <TypeIcon size={18} className="text-purple-400" aria-hidden="true" />}
        </Link>
        <Link to={href} className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{snippet}</p>
          <p className="text-xs text-gray-400">
            {memory.memory_type === 'drop' ? 'Drop' : 'Capsule'} · Saved {formatRelativeTime(memory.saved_at)}
            {moodMeta ? ` · ${moodMeta.emoji}` : ''}
          </p>
        </Link>
        <button
          type="button"
          onClick={() => setEditingNote(p => !p)}
          aria-label="Edit note"
          aria-pressed={editingNote}
          className={`p-1.5 rounded-full flex-shrink-0 ${memory.note ? 'text-purple-600' : 'text-gray-300 hover:text-gray-500'}`}
        >
          <StickyNote size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setCollectionsOpen(p => !p)}
          aria-label="Add to collection"
          aria-pressed={collectionsOpen}
          className="p-1.5 rounded-full text-gray-400 hover:text-purple-600 flex-shrink-0"
        >
          <FolderPlus size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={onUnsave} aria-label="Remove from saved" className="p-1.5 rounded-full text-gray-400 hover:text-red-500 flex-shrink-0">
          <BookmarkX size={16} aria-hidden="true" />
        </button>
      </div>

      {editingNote && (
        <div className="flex gap-2 pl-[68px]">
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveNote(); }}
            placeholder="Add a note to yourself…"
            maxLength={280}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button type="button" onClick={saveNote} className="text-xs font-medium text-purple-600">Save</button>
        </div>
      )}
      {!editingNote && memory.note && (
        <p className="text-xs text-gray-500 pl-[68px] italic truncate">"{memory.note}"</p>
      )}

      {collectionsOpen && (
        <div className="flex flex-wrap gap-1.5 pl-[68px]">
          {collections.map(c => {
            const active = memberIds.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCollection(c.id)}
                className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition-colors ${active ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}
              >
                {active ? <X size={10} aria-hidden="true" /> : <Plus size={10} aria-hidden="true" />}
                {c.icon} {c.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
