import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, Flame } from 'lucide-react';
import { useMemories } from '../../hooks/useMemories';
import { HIGHLIGHT_META, type HighlightCandidate, type HighlightType } from '../../types/memory';

interface HighlightCardProps {
  type: HighlightType;
}

// A reel: a title, why it was picked, and a small strip of thumbnails —
// with an explicit "Save this reel" action, since memory_highlights only
// ever stores what a user chose to keep, not an automatic cache.
export const HighlightCard: React.FC<HighlightCardProps> = ({ type }) => {
  const { getHighlightCandidates, saveHighlight } = useMemories();
  const [candidates, setCandidates] = useState<HighlightCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getHighlightCandidates(type, 8).then(data => { setCandidates(data); setLoading(false); });
  }, [type, getHighlightCandidates]);

  const meta = HIGHLIGHT_META[type];

  const handleSave = async () => {
    const { error } = await saveHighlight(meta.label, type, candidates);
    if (!error) setSaved(true);
  };

  if (loading) return <div className="h-32 rounded-2xl bg-white/60 animate-pulse" />;
  if (candidates.length === 0) return null;

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{meta.label}</h3>
          <p className="text-xs text-gray-400">{meta.description}</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saved}
          className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 disabled:text-gray-300 flex-shrink-0"
        >
          <Save size={13} aria-hidden="true" /> {saved ? 'Saved' : 'Save this reel'}
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {candidates.map(c => {
          const cover = c.media.find(m => m.type === 'photo' || m.type === 'video');
          return (
            <Link
              key={`${c.memory_type}-${c.id}`}
              to={`/memories/${c.memory_type}/${c.id}`}
              className="relative w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100 flex-shrink-0 flex items-center justify-center"
            >
              {cover ? (
                <img src={cover.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Flame size={16} className="text-purple-400" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
