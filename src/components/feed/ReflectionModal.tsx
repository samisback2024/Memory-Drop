import React, { useEffect, useState } from 'react';
import { Feather } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { Skeleton } from '../ui/Skeleton';
import { useDrops } from '../../hooks/useDrops';
import { formatRelativeTime } from '../../utils/date';
import type { Reflection } from '../../types/feed';

interface ReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  dropId: string;
}

// A private journal, not a public comment thread — nobody else, including
// the drop's own author if this isn't your drop, ever sees what's written
// here. Distinct modal (rather than reusing CommentSection) so it reads as
// unmistakably personal, not another social feature.
export const ReflectionModal: React.FC<ReflectionModalProps> = ({ isOpen, onClose, dropId }) => {
  const { getMyReflections, addReflection } = useDrops();
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getMyReflections(dropId).then(data => {
      setReflections(data);
      setLoading(false);
    });
  }, [isOpen, dropId, getMyReflections]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    const { error: saveError, reflection } = await addReflection(dropId, text);
    setSaving(false);
    if (saveError || !reflection) {
      setError(saveError ?? 'Could not save reflection.');
      return;
    }
    setReflections(prev => [reflection, ...prev]);
    setText('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Your private reflection" size="sm">
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
        <Feather size={12} aria-hidden="true" />
        Only you can see this — a personal note about this memory.
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-4">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="How does this memory make you feel?"
          aria-label="Write a reflection"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" variant="primary" size="sm" loading={saving} disabled={!text.trim()}>
          Save reflection
        </Button>
      </form>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" rounded="xl" />
          <Skeleton className="h-14 w-full" rounded="xl" />
        </div>
      ) : reflections.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No reflections yet.</p>
      ) : (
        <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
          {reflections.map(r => (
            <div key={r.id} className="bg-purple-50/60 rounded-xl p-3">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.content}</p>
              <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(r.created_at)} ago</p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};
