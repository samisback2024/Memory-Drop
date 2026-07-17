import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon, Video, Music, Mic, PenLine, StickyNote, BookmarkX } from 'lucide-react';
import { useSaved } from '../../hooks/useSaved';
import { MOOD_META } from '../../types/feed';
import { formatRelativeTime } from '../../utils/date';
import type { SavedMemory } from '../../types/memory';
import type { CapsuleMemoryType } from '../../types/capsule';

const TYPE_ICONS: Record<CapsuleMemoryType, typeof ImageIcon> = {
  text: PenLine, photo: ImageIcon, video: Video, audio: Music, voice: Mic,
};

interface SavedMemoryRowProps {
  memory: SavedMemory;
  onUnsave: () => void;
}

export const SavedMemoryRow: React.FC<SavedMemoryRowProps> = ({ memory, onUnsave }) => {
  const { updateSavedNote } = useSaved();
  const [note, setNote] = useState(memory.note ?? '');
  const [editingNote, setEditingNote] = useState(false);

  const moodMeta = memory.mood ? MOOD_META[memory.mood] : null;
  const cover = memory.media.find(m => m.type === 'photo' || m.type === 'video');
  const primaryType = memory.memory_types[0] ?? 'text';
  const TypeIcon = TYPE_ICONS[primaryType];
  const href = `/memories/${memory.memory_type}/${memory.id}`;
  const snippet = memory.title || memory.caption || 'A memory without words';

  const saveNote = () => {
    setEditingNote(false);
    updateSavedNote(memory.memory_type, memory.id, note);
  };

  return (
    <div className="flex flex-col gap-2 py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <Link to={href} className="w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100 flex-shrink-0 flex items-center justify-center">
          {cover ? <img src={cover.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <TypeIcon size={18} className="text-purple-400" aria-hidden="true" />}
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
    </div>
  );
};
