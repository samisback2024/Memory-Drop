import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, MapPin, Tag, X, Lock, Globe, Users, Eye, UserCheck } from 'lucide-react';
import { useCapsules } from '../hooks/useCapsules';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { MediaUpload } from '../components/create/MediaUpload';
import { minUnlockDate } from '../utils/date';
import type { VisibilityType } from '../types';

const VISIBILITY_OPTIONS: { value: VisibilityType; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'public', label: 'Public', desc: 'Anyone can see this', icon: Globe },
  { value: 'friends', label: 'Friends', desc: 'Only people you follow', icon: Users },
  { value: 'private', label: 'Only Me', desc: 'Just for you', icon: Eye },
  { value: 'specific', label: 'Specific People', desc: 'Choose who can see', icon: UserCheck },
];

const AI_SUGGESTIONS = [
  "Five years from now, I hope I'm still...",
  "The thing I'm most proud of today is...",
  "A message to my future self: don't forget that...",
  "Right now I'm feeling grateful for...",
  "The most important thing I've learned this year is...",
];

export const CreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { createCapsule } = useCapsules();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [unlockDate, setUnlockDate] = useState('');
  const [visibility, setVisibility] = useState<VisibilityType>('public');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags(prev => [...prev, tag]);
      setTagInput('');
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const handleAISuggest = async () => {
    setAiLoading(true);
    await new Promise(r => setTimeout(r, 800));
    const suggestion = AI_SUGGESTIONS[Math.floor(Math.random() * AI_SUGGESTIONS.length)];
    setMessage(prev => prev ? `${prev}\n\n${suggestion}` : suggestion);
    setAiLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!unlockDate) { setError('Please set an unlock date.'); return; }
    if (new Date(unlockDate) <= new Date()) { setError('Unlock date must be in the future.'); return; }

    setError(null);
    setLoading(true);
    const { error: err } = await createCapsule({
      title: title.trim(),
      message: message.trim(),
      unlock_date: new Date(unlockDate).toISOString(),
      visibility,
      tags,
      location: location.trim(),
      media_files: mediaFiles,
    });
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      navigate('/profile');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create Capsule</h1>
        <p className="text-sm text-gray-500">Drop a moment in time to unlock later.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Title */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <Input
            label="Title *"
            type="text"
            placeholder="Give your capsule a memorable name..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
          />
        </div>

        {/* Media */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <MediaUpload files={mediaFiles} onChange={setMediaFiles} />
        </div>

        {/* Message */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700">Message</label>
            <button
              type="button"
              onClick={handleAISuggest}
              disabled={aiLoading}
              className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {aiLoading ? (
                <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              AI Suggest
            </button>
          </div>
          <Textarea
            placeholder="Write a message to your future self or friends..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={5}
            maxLength={2000}
          />
          <p className="text-xs text-gray-400 text-right mt-1">{message.length}/2000</p>
        </div>

        {/* Unlock date */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <Input
            label="Unlock Date & Time *"
            type="datetime-local"
            value={unlockDate}
            onChange={e => setUnlockDate(e.target.value)}
            min={minUnlockDate()}
            hint="Choose when this capsule becomes available"
          />
        </div>

        {/* Visibility */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="text-sm font-medium text-gray-700 block mb-3">Visibility</label>
          <div className="grid grid-cols-2 gap-2">
            {VISIBILITY_OPTIONS.map(({ value, label, desc, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setVisibility(value)}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                  visibility === value
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Icon size={16} className={visibility === value ? 'text-purple-600 mt-0.5' : 'text-gray-400 mt-0.5'} />
                <div>
                  <p className={`text-sm font-medium ${visibility === value ? 'text-purple-700' : 'text-gray-700'}`}>{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                {visibility === value && (
                  <Lock size={12} className="text-purple-500 ml-auto mt-0.5 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Tags</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag and press Enter..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                maxLength={30}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-full">
                    <Tag size={10} />
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <Input
            label="Location (optional)"
            type="text"
            placeholder="Where are you right now?"
            value={location}
            onChange={e => setLocation(e.target.value)}
            leftIcon={<MapPin size={16} />}
            maxLength={100}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Submit */}
        <Button type="submit" variant="gradient" fullWidth size="lg" loading={loading}>
          <Lock size={16} />
          Create Time Capsule
        </Button>
      </form>
    </div>
  );
};
