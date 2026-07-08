import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../hooks/useAuth';

const AVATAR_SEEDS = [
  'cosmic', 'stellar', 'aurora', 'nebula', 'pixel',
  'prism', 'zenith', 'radiant', 'lumina', 'quantum',
];

const AVATAR_STYLES = [
  'avataaars', 'bottts', 'identicon', 'micah', 'notionists',
];

interface AvatarGeneratorProps {
  onSelect: (url: string) => void;
  onCancel: () => void;
}

export const AvatarGenerator: React.FC<AvatarGeneratorProps> = ({ onSelect, onCancel }) => {
  const { profile } = useAuth();
  const baseSeed = profile?.username ?? 'user';
  const [selected, setSelected] = useState<string | null>(null);
  const [style, setStyle] = useState(AVATAR_STYLES[0]);

  const avatarOptions = AVATAR_SEEDS.map(
    seed => `https://api.dicebear.com/7.x/${style}/svg?seed=${baseSeed}-${seed}&backgroundColor=b6e3f4,ffd5dc,c0aede,d1f0d1`,
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600 text-center">
        Choose from 10 generated avatar styles for your profile picture.
      </p>

      {/* Style selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {AVATAR_STYLES.map(s => (
          <button
            key={s}
            onClick={() => setStyle(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors capitalize ${
              style === s ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Avatar grid */}
      <div className="grid grid-cols-5 gap-3">
        {avatarOptions.map((url, i) => (
          <button
            key={i}
            onClick={() => setSelected(url)}
            className={`relative rounded-xl overflow-hidden border-2 transition-all ${
              selected === url ? 'border-purple-600 scale-105' : 'border-transparent hover:border-gray-300'
            }`}
          >
            <Avatar src={url} name={`Option ${i + 1}`} size="2xl" className="w-full h-full" />
            {selected === url && (
              <div className="absolute inset-0 bg-purple-600/20 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mt-2">
        <Button variant="outline" fullWidth onClick={onCancel}>Cancel</Button>
        <Button
          variant="gradient"
          fullWidth
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
        >
          Use This Avatar
        </Button>
      </div>
    </div>
  );
};
