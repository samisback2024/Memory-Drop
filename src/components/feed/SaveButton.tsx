import React, { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useFeed } from '../../hooks/useFeed';

interface SaveButtonProps {
  postId: string;
  isSaved: boolean;
  onChange?: (isSaved: boolean) => void;
}

export const SaveButton: React.FC<SaveButtonProps> = ({ postId, isSaved, onChange }) => {
  const { savePost, unsavePost } = useFeed();
  const [saved, setSaved] = useState(isSaved);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setSaved(isSaved); }, [isSaved]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next);
    onChange?.(next);

    const { error } = next ? await savePost(postId) : await unsavePost(postId);
    if (error) {
      setSaved(saved);
      onChange?.(saved);
    }
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? 'Unsave' : 'Save'}
      className="text-gray-600 hover:text-purple-600 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg p-1"
    >
      <Bookmark size={19} className={saved ? 'fill-purple-600 text-purple-600' : ''} aria-hidden="true" />
    </button>
  );
};
