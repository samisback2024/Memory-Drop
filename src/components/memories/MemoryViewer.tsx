import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Tag, FolderPlus, EyeOff, ArchiveRestore, Trash2, X, Plus, Lock, Mic, Music } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCapsules } from '../../hooks/useCapsules';
import { useMoments } from '../../hooks/useMoments';
import { useDrops } from '../../hooks/useDrops';
import { useMemories } from '../../hooks/useMemories';
import { supabase } from '../../lib/supabase';
import { CapsuleCard } from '../capsules/CapsuleCard';
import { DropCard } from '../feed/DropCard';
import { Avatar } from '../ui/Avatar';
import { FavoriteButton } from './FavoriteButton';
import { MOOD_META } from '../../types/feed';
import { CAPSULE_VISIBILITY_META } from '../../types/capsule';
import { formatDate } from '../../utils/date';
import type { Capsule } from '../../types/capsule';
import type { Drop } from '../../types/feed';
import type { Memory, MemoryCollection, MemorySourceType } from '../../types/memory';

interface MemoryViewerProps {
  memoryType: MemorySourceType;
  memoryId: string;
}

const MomentMemoryBody: React.FC<{ memory: Memory }> = ({ memory }) => {
  const { getMomentReactions } = useMoments();
  const [reactions, setReactions] = useState<{ emoji: string; reaction_count: number }[]>([]);

  useEffect(() => {
    if (memory.is_own) getMomentReactions(memory.id).then(setReactions);
  }, [memory.id, memory.is_own, getMomentReactions]);

  const media = memory.media[0];

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Link to={`/u/${memory.username}`}><Avatar src={memory.profile_photo_url} name={memory.display_name || memory.username} size="md" /></Link>
        <div>
          <Link to={`/u/${memory.username}`} className="text-sm font-semibold text-gray-900 hover:underline">{memory.display_name || memory.username}</Link>
          <p className="text-xs text-gray-500">Moment · {formatDate(memory.created_at)}</p>
        </div>
      </div>
      <div className="px-4 pb-4 flex flex-col gap-3">
        {memory.caption && <p className="text-sm text-gray-800 whitespace-pre-wrap">{memory.caption}</p>}
        {media?.type === 'photo' && <img src={media.url} alt="" className="w-full rounded-xl object-cover max-h-96" />}
        {media?.type === 'video' && <video src={media.url} controls className="w-full rounded-xl max-h-96 bg-black" />}
        {(media?.type === 'audio' || media?.type === 'voice') && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-3">
            {media.type === 'voice' ? <Mic size={18} className="text-blue-500 flex-shrink-0" aria-hidden="true" /> : <Music size={18} className="text-blue-500 flex-shrink-0" aria-hidden="true" />}
            <audio src={media.url} controls className="flex-1 h-9" />
          </div>
        )}
        {memory.is_own && reactions.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
            <span className="text-xs text-gray-400">Reactions:</span>
            {reactions.map(r => <span key={r.emoji} className="text-sm">{r.emoji} <span className="text-xs text-gray-400">{r.reaction_count}</span></span>)}
          </div>
        )}
      </div>
    </div>
  );
};

// The Memory Details page: the type-specific content (a full CapsuleCard
// for capsules or DropCard for drops — complete reuse of their unlock
// ritual/reveal and engagement; a simpler read-oriented display for
// expired moments, since new reactions/replies aren't possible once
// expired) plus the metadata this phase adds on top: tags, location,
// collections, and the hide/restore/delete-permanently archive controls
// — the last of which works for all three types, the first three only
// for Capsules/Moments (Drops have no `tags`/`location_text`/`hidden_at`
// columns yet, see the README).
export const MemoryViewer: React.FC<MemoryViewerProps> = ({ memoryType, memoryId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getCapsule } = useCapsules();
  const { getDrop } = useDrops();
  const { getMemory, getCollections, addToCollection, removeFromCollection, updateTags, updateLocation, hideMemory, restoreMemory, deletePermanently } = useMemories();

  const [memory, setMemory] = useState<Memory | null | undefined>(undefined);
  const [capsule, setCapsule] = useState<Capsule | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [collections, setCollections] = useState<MemoryCollection[]>([]);
  const [memoryCollectionIds, setMemoryCollectionIds] = useState<Set<string>>(new Set());
  const [tagDraft, setTagDraft] = useState('');
  const [locationDraft, setLocationDraft] = useState('');
  const [editingLocation, setEditingLocation] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const supportsTagsAndLocation = memoryType !== 'drop';
  const supportsArchive = memoryType !== 'drop';
  const collectionColumn = memoryType === 'capsule' ? 'capsule_id' : memoryType === 'moment' ? 'moment_id' : 'drop_id';

  useEffect(() => {
    let cancelled = false;
    getMemory(memoryType, memoryId).then(async data => {
      if (cancelled) return;
      setMemory(data);
      if (data) setLocationDraft(data.location_text ?? '');
      if (data?.memory_type === 'capsule') setCapsule(await getCapsule(memoryId));
      if (data?.memory_type === 'drop') setDrop(await getDrop(memoryId));
    });
    getCollections().then(setCollections);
    supabase
      .from('collection_items')
      .select('collection_id')
      .eq(collectionColumn, memoryId)
      .then(({ data }) => setMemoryCollectionIds(new Set((data ?? []).map(row => row.collection_id as string))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoryType, memoryId]);

  if (memory === undefined) return <div className="h-64 rounded-2xl bg-white/60 animate-pulse" />;

  if (!memory) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm">
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <Lock size={28} className="text-gray-300" aria-hidden="true" />
          <p className="text-sm text-gray-500">This memory doesn't exist, or isn't visible to you.</p>
        </div>
      </div>
    );
  }

  const isOwn = memory.user_id === user?.id;
  const moodMeta = memory.mood ? MOOD_META[memory.mood] : null;

  const addTag = () => {
    const tag = tagDraft.trim().toLowerCase();
    if (!tag || memory.tags.includes(tag)) { setTagDraft(''); return; }
    const nextTags = [...memory.tags, tag];
    setMemory({ ...memory, tags: nextTags });
    setTagDraft('');
    updateTags(memoryType, memoryId, nextTags);
  };

  const removeTag = (tag: string) => {
    const nextTags = memory.tags.filter(t => t !== tag);
    setMemory({ ...memory, tags: nextTags });
    updateTags(memoryType, memoryId, nextTags);
  };

  const saveLocation = () => {
    setMemory({ ...memory, location_text: locationDraft.trim() || null });
    setEditingLocation(false);
    updateLocation(memoryType, memoryId, locationDraft);
  };

  const toggleCollection = async (collectionId: string) => {
    const inCollection = memoryCollectionIds.has(collectionId);
    const next = new Set(memoryCollectionIds);
    if (inCollection) next.delete(collectionId); else next.add(collectionId);
    setMemoryCollectionIds(next);
    if (inCollection) await removeFromCollection(collectionId, memoryType, memoryId);
    else await addToCollection(collectionId, memoryType, memoryId);
  };

  const handleHide = async () => { await hideMemory(memoryType, memoryId); setMemory({ ...memory, is_hidden: true }); };
  const handleRestore = async () => { await restoreMemory(memoryType, memoryId); setMemory({ ...memory, is_hidden: false }); };
  const handleDeletePermanently = async () => {
    if (!window.confirm('Delete this memory permanently? This cannot be undone.')) return;
    setDeleting(true);
    const { error } = await deletePermanently(memory);
    if (!error) navigate('/memories');
    else setDeleting(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {memory.memory_type === 'capsule' && capsule ? (
        <CapsuleCard capsule={capsule} onDeleted={() => navigate('/memories')} />
      ) : memory.memory_type === 'drop' && drop ? (
        <DropCard drop={drop} onDeleted={() => navigate('/memories')} />
      ) : memory.memory_type === 'moment' ? (
        <MomentMemoryBody memory={memory} />
      ) : null}

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Details</h2>
          <FavoriteButton memoryType={memoryType} memoryId={memoryId} isFavorited={memory.is_favorited} size={17} />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-gray-400">Visibility</dt>
            <dd className="text-gray-800">{CAPSULE_VISIBILITY_META[memory.visibility].label}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Mood</dt>
            <dd className="text-gray-800">{moodMeta ? `${moodMeta.emoji} ${moodMeta.label}` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Created</dt>
            <dd className="text-gray-800">{formatDate(memory.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">{memory.memory_type === 'capsule' ? 'Unlocked' : 'Expired'}</dt>
            <dd className="text-gray-800">{formatDate(memory.matured_at)}</dd>
          </div>
        </dl>

        {isOwn && supportsTagsAndLocation && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={12} aria-hidden="true" /> Location</p>
            {editingLocation ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={locationDraft}
                  onChange={e => setLocationDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveLocation(); }}
                  placeholder="Where was this?"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button type="button" onClick={saveLocation} className="text-xs font-medium text-purple-600">Save</button>
              </div>
            ) : (
              <button type="button" onClick={() => setEditingLocation(true)} className="text-sm text-gray-700 text-left hover:text-purple-600">
                {memory.location_text || <span className="text-gray-400">Add a location…</span>}
              </button>
            )}
          </div>
        )}

        {isOwn && supportsTagsAndLocation && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-gray-400 flex items-center gap-1"><Tag size={12} aria-hidden="true" /> Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {memory.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 rounded-full px-2.5 py-1">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove tag ${tag}`}><X size={10} aria-hidden="true" /></button>
                </span>
              ))}
              <input
                type="text"
                value={tagDraft}
                onChange={e => setTagDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTag(); }}
                placeholder="Add a tag…"
                className="text-xs border border-gray-200 rounded-full px-2.5 py-1 w-24 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        )}

        {isOwn && (
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => setCollectionsOpen(p => !p)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-600 w-fit">
              <FolderPlus size={12} aria-hidden="true" /> Add to collection
            </button>
            {collectionsOpen && (
              <div className="flex flex-wrap gap-1.5">
                {collections.map(c => {
                  const active = memoryCollectionIds.has(c.id);
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
        )}

        {isOwn && (
          <div className="flex items-center gap-4 pt-2 border-t border-gray-50">
            {!supportsArchive ? null : memory.is_hidden ? (
              <button type="button" onClick={handleRestore} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-purple-600">
                <ArchiveRestore size={13} aria-hidden="true" /> Restore
              </button>
            ) : (
              <button type="button" onClick={handleHide} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-purple-600">
                <EyeOff size={13} aria-hidden="true" /> Hide
              </button>
            )}
            <button type="button" onClick={handleDeletePermanently} disabled={deleting} className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50">
              <Trash2 size={13} aria-hidden="true" /> Delete permanently
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
