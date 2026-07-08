import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useStories } from '../../hooks/useStories';
import type { Story, DurationHours } from '../../types';

interface StoryViewerProps {
  story: Story;
  onClose: () => void;
}

const StoryViewer: React.FC<StoryViewerProps> = ({ story, onClose }) => {
  return (
    <Modal isOpen onClose={onClose} hideClose size="sm">
      <div className="relative rounded-xl overflow-hidden bg-black min-h-64">
        {story.content_type === 'photo' && story.content_url && (
          <img src={story.content_url} alt="Story" className="w-full max-h-96 object-cover" />
        )}
        {story.content_type === 'text' && (
          <div className="flex items-center justify-center min-h-64 bg-gradient-to-br from-purple-600 to-blue-500 p-6">
            <p className="text-white text-xl font-medium text-center">{story.text_content}</p>
          </div>
        )}
        <div className="flex items-center gap-2 mt-3">
          <Avatar src={story.profiles?.avatar_url} name={story.profiles?.full_name ?? 'User'} size="sm" />
          <div>
            <p className="font-semibold text-sm text-gray-900">{story.profiles?.full_name}</p>
            <p className="text-xs text-gray-500">@{story.profiles?.username}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
};

interface AddStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddStoryModal: React.FC<AddStoryModalProps> = ({ isOpen, onClose }) => {
  const { createStory } = useStories();
  const [type, setType] = useState<'text' | 'photo'>('text');
  const [text, setText] = useState('');
  const [duration, setDuration] = useState<DurationHours>(24);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const handleSubmit = async () => {
    if (type === 'text' && !text.trim()) return;
    if (type === 'photo' && !file) return;
    setLoading(true);
    await createStory({
      content_type: type,
      text_content: type === 'text' ? text : undefined,
      media_file: type === 'photo' ? (file ?? undefined) : undefined,
      duration_hours: duration,
    });
    setLoading(false);
    onClose();
    setText('');
    setFile(null);
    setPreview(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add to Story" size="sm">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {(['text', 'photo'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${type === t ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {type === 'text' ? (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="What's on your mind?"
            maxLength={280}
            rows={4}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl h-40 cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden">
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <>
                <Plus size={24} className="text-gray-400" />
                <span className="text-sm text-gray-500">Upload photo</span>
              </>
            )}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
          </label>
        )}

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Story duration</label>
          <div className="flex gap-2">
            {([12, 24, 48] as DurationHours[]).map(h => (
              <button
                key={h}
                onClick={() => setDuration(h)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${duration === h ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        <Button variant="gradient" fullWidth loading={loading} onClick={handleSubmit}>
          Share Story
        </Button>
      </div>
    </Modal>
  );
};

export const StoriesRow: React.FC = () => {
  const { profile } = useAuth();
  const { stories } = useStories();
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [addStoryOpen, setAddStoryOpen] = useState(false);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {/* Add story button */}
        <button
          onClick={() => setAddStoryOpen(true)}
          className="flex flex-col items-center gap-1 flex-shrink-0"
        >
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-purple-300 flex items-center justify-center bg-purple-50 hover:bg-purple-100 transition-colors relative">
            <Avatar src={profile?.avatar_url} name={profile?.full_name ?? 'You'} size="lg" className="opacity-60" />
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center border-2 border-white">
              <Plus size={10} className="text-white" />
            </div>
          </div>
          <span className="text-xs text-gray-600 font-medium truncate max-w-[56px]">Your Story</span>
        </button>

        {/* Stories */}
        {stories.map(story => (
          <button
            key={story.id}
            onClick={() => setViewingStory(story)}
            className="flex flex-col items-center gap-1 flex-shrink-0"
          >
            <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-br from-purple-500 to-blue-500">
              <div className="w-full h-full rounded-full border-2 border-white overflow-hidden">
                {story.content_type === 'photo' && story.content_url ? (
                  <img src={story.content_url} alt="Story" className="w-full h-full object-cover" />
                ) : (
                  <Avatar src={story.profiles?.avatar_url} name={story.profiles?.full_name ?? 'User'} size="lg" className="w-full h-full" />
                )}
              </div>
            </div>
            <span className="text-xs text-gray-600 font-medium truncate max-w-[56px]">
              {story.profiles?.username ?? 'user'}
            </span>
          </button>
        ))}

        {stories.length === 0 && (
          <div className="flex items-center text-sm text-gray-400 py-2 pl-2">
            No stories yet — be the first!
          </div>
        )}
      </div>

      {viewingStory && <StoryViewer story={viewingStory} onClose={() => setViewingStory(null)} />}
      <AddStoryModal isOpen={addStoryOpen} onClose={() => setAddStoryOpen(false)} />
    </>
  );
};
