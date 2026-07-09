import React from 'react';
import { Mic, Music } from 'lucide-react';
import { MOOD_META } from '../../types/feed';
import type { Capsule } from '../../types/capsule';

interface CapsuleUnlockedCardProps {
  capsule: Capsule;
}

// The reveal — what was worth the wait. Photos grid like a small gallery,
// video and audio/voice each get their own player, title and memory text
// read like the letter this always was.
export const CapsuleUnlockedCard: React.FC<CapsuleUnlockedCardProps> = ({ capsule }) => {
  const moodMeta = capsule.mood ? MOOD_META[capsule.mood] : null;
  const photos = capsule.media.filter(m => m.type === 'photo');
  const videos = capsule.media.filter(m => m.type === 'video');
  const audioClips = capsule.media.filter(m => m.type === 'audio');
  const voiceClips = capsule.media.filter(m => m.type === 'voice');

  return (
    <div className="flex flex-col gap-4">
      {(capsule.title || moodMeta) && (
        <div className="flex items-center gap-2">
          {capsule.title && <h3 className="text-base font-semibold text-gray-900">{capsule.title}</h3>}
          {moodMeta && <span aria-label={moodMeta.label} className="text-sm">{moodMeta.emoji}</span>}
        </div>
      )}

      {capsule.memory_text && (
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{capsule.memory_text}</p>
      )}

      {photos.length > 0 && (
        <div className={`grid gap-1.5 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {photos.map(p => (
            <img key={p.url} src={p.url} alt="" loading="lazy" className="w-full rounded-xl object-cover max-h-96" />
          ))}
        </div>
      )}

      {videos.map(v => (
        <video key={v.url} src={v.url} controls className="w-full rounded-xl max-h-96 bg-black" />
      ))}

      {audioClips.map(a => (
        <div key={a.url} className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-2xl p-3">
          <Music size={18} className="text-purple-500 flex-shrink-0" aria-hidden="true" />
          <audio src={a.url} controls className="flex-1 h-9" />
        </div>
      ))}

      {voiceClips.map(v => (
        <div key={v.url} className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-3">
          <Mic size={18} className="text-blue-500 flex-shrink-0" aria-hidden="true" />
          <audio src={v.url} controls className="flex-1 h-9" />
        </div>
      ))}
    </div>
  );
};
