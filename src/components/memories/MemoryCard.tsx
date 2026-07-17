import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Image as ImageIcon, Video, Music, Mic, PenLine } from 'lucide-react';
import { FavoriteButton } from './FavoriteButton';
import { MOOD_META } from '../../types/feed';
import { formatDate, formatRelativeTime } from '../../utils/date';
import type { Memory } from '../../types/memory';
import type { CapsuleMemoryType } from '../../types/capsule';

const TYPE_ICONS: Record<CapsuleMemoryType, typeof ImageIcon> = {
  text: PenLine, photo: ImageIcon, video: Video, audio: Music, voice: Mic,
};

interface MemoryCardProps {
  memory: Memory;
  variant?: 'timeline' | 'journal' | 'grid' | 'list';
}

// One shared preview unit behind all four layouts — a thumbnail/cover
// (or a mood-gradient placeholder when there's no photo/video, or the
// memory is still sealed), a title/snippet, and a date. Tapping any of
// them opens the full Memory Details page — this card never tries to
// replicate the unlock ritual or engagement UI inline.
const MemoryCardImpl: React.FC<MemoryCardProps> = ({ memory, variant = 'timeline' }) => {
  const moodMeta = memory.mood ? MOOD_META[memory.mood] : null;
  const cover = memory.media.find(m => m.type === 'photo' || m.type === 'video');
  const primaryType = memory.memory_types[0] ?? 'text';
  const TypeIcon = TYPE_ICONS[primaryType];
  const href = `/memories/${memory.memory_type}/${memory.id}`;

  const snippet = memory.title || memory.caption || (memory.is_unlocked ? 'A memory without words' : 'Sealed until it unlocks');

  if (variant === 'grid') {
    return (
      <Link to={href} className="relative aspect-square rounded-xl overflow-hidden bg-purple-50 dark:bg-purple-950/30 block group">
        {cover && memory.is_unlocked ? (
          cover.type === 'video' ? (
            <video src={cover.url} className="w-full h-full object-cover" muted />
          ) : (
            <img src={cover.url} alt={snippet} loading="lazy" className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 text-center">
            {!memory.is_unlocked ? <Lock size={18} className="text-purple-400" aria-hidden="true" /> : <TypeIcon size={18} className="text-purple-400" aria-hidden="true" />}
            {moodMeta && <span className="text-sm">{moodMeta.emoji}</span>}
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        <div className="absolute top-1.5 right-1.5">
          <FavoriteButton memoryType={memory.memory_type} memoryId={memory.id} isFavorited={memory.is_favorited} size={12} />
        </div>
        {!memory.is_unlocked && (
          <span className="absolute bottom-1.5 left-1.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
            <Lock size={10} className="text-white" aria-hidden="true" />
          </span>
        )}
      </Link>
    );
  }

  if (variant === 'list') {
    return (
      <Link to={href} className="flex items-center gap-3 py-2.5 px-1 hover:bg-white/60 dark:hover:bg-gray-800/60 rounded-xl transition-colors">
        <div className="w-11 h-11 rounded-lg overflow-hidden bg-purple-50 dark:bg-purple-950/30 flex-shrink-0 flex items-center justify-center">
          {cover && memory.is_unlocked ? (
            <img src={cover.url} alt={snippet} loading="lazy" className="w-full h-full object-cover" />
          ) : !memory.is_unlocked ? (
            <Lock size={15} className="text-purple-400" aria-hidden="true" />
          ) : (
            <TypeIcon size={15} className="text-purple-400" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{snippet}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{formatRelativeTime(memory.created_at)}</p>
        </div>
        {moodMeta && <span className="text-sm flex-shrink-0">{moodMeta.emoji}</span>}
      </Link>
    );
  }

  const isJournal = variant === 'journal';

  return (
    <Link
      to={href}
      className={[
        'block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(124,58,237,0.12)] overflow-hidden hover:shadow-md transition-shadow',
        isJournal ? 'p-6' : '',
      ].join(' ')}
    >
      {!isJournal && cover && memory.is_unlocked && (
        cover.type === 'video' ? (
          <video src={cover.url} className="w-full max-h-72 object-cover bg-black" muted />
        ) : (
          <img src={cover.url} alt={snippet} loading="lazy" className="w-full max-h-72 object-cover" />
        )
      )}
      <div className={isJournal ? 'flex flex-col gap-3' : 'p-4 flex flex-col gap-2'}>
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            {!memory.is_unlocked ? <Lock size={11} aria-hidden="true" /> : <TypeIcon size={11} aria-hidden="true" />}
            {memory.memory_type === 'capsule' ? 'Capsule' : memory.memory_type === 'drop' ? 'Drop' : 'Moment'}
          </span>
          <span>·</span>
          <span>{formatDate(memory.created_at)}</span>
          {moodMeta && <span aria-label={moodMeta.label}>{moodMeta.emoji}</span>}
          <FavoriteButton memoryType={memory.memory_type} memoryId={memory.id} isFavorited={memory.is_favorited} size={13} />
        </div>

        {isJournal && cover && memory.is_unlocked && (
          cover.type === 'video' ? (
            <video src={cover.url} className="w-full max-h-96 object-cover rounded-xl bg-black" muted />
          ) : (
            <img src={cover.url} alt={snippet} loading="lazy" className="w-full max-h-96 object-cover rounded-xl" />
          )
        )}

        {memory.title && <h3 className={isJournal ? 'text-lg font-semibold text-gray-900 dark:text-gray-100' : 'text-sm font-semibold text-gray-900 dark:text-gray-100'}>{memory.title}</h3>}
        <p className={['text-gray-700 dark:text-gray-300 whitespace-pre-wrap', isJournal ? 'text-[15px] leading-relaxed italic' : 'text-sm line-clamp-3'].join(' ')}>
          {memory.is_unlocked ? (memory.caption || (!memory.title ? 'A memory without words' : '')) : 'Sealed until it unlocks.'}
        </p>
      </div>
    </Link>
  );
};

// Memoized — this renders in every Grid/List/Timeline/Journal view
// across Search, Explore, Memories, Profile, and Saved. Each of those
// pages patches individual items in an array (creating a new array but
// reusing unchanged item object references), so memoizing here means an
// update to one memory doesn't force every sibling card to re-render.
export const MemoryCard = React.memo(MemoryCardImpl);
