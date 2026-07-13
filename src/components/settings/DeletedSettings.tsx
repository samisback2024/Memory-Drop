import React, { useEffect, useState } from 'react';
import { RotateCcw, Trash2, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { useDrops } from '../../hooks/useDrops';
import { useToast } from '../../hooks/useToast';
import { SettingsSection } from './SettingsSection';
import { SettingsCard } from './SettingsCard';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { formatRelativeTime } from '../../utils/date';
import type { DeletedDrop } from '../../types/feed';

const TYPE_ICON: Record<DeletedDrop['post_type'], typeof ImageIcon> = {
  photo: ImageIcon,
  video: Video,
  audio: FileText,
  text: FileText,
};

// Deleting a drop moves it here for 30 days instead of erasing it right
// away (supabase/phase14s_soft_delete_drops.sql) — restorable any time
// in that window, then automatically purged. Drops only: Capsules and
// Moments still delete immediately, this wasn't asked for there.
export const DeletedSettings: React.FC = () => {
  const { getDeletedDrops, restoreDrop } = useDrops();
  const { showToast } = useToast();
  const [drops, setDrops] = useState<DeletedDrop[] | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => { getDeletedDrops().then(setDrops); }, [getDeletedDrops]);

  const handleRestore = async (drop: DeletedDrop) => {
    setRestoring(drop.id);
    const { error } = await restoreDrop(drop.id);
    setRestoring(null);
    if (error) { showToast(error, 'error'); return; }
    setDrops(prev => (prev ? prev.filter(d => d.id !== drop.id) : prev));
    showToast('Drop restored — back in your Feed.');
  };

  return (
    <SettingsSection title="Deleted" description="Deleted drops stay here for 30 days before they're gone for good.">
      <SettingsCard>
        {drops === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-50 dark:bg-gray-800 animate-pulse" />)}
          </div>
        ) : drops.length === 0 ? (
          <EmptyState icon={Trash2} title="Nothing deleted" description="Drops you delete will show up here for 30 days before they're gone for good." />
        ) : (
          <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
            {drops.map(drop => {
              const Icon = TYPE_ICON[drop.post_type];
              const thumb = drop.images[0]?.url ?? null;
              return (
                <div key={drop.id} className="flex items-center gap-3 py-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Icon size={18} className="text-gray-400" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{drop.caption || 'Untitled drop'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Deleted {formatRelativeTime(drop.deleted_at)} · {drop.days_remaining === 0 ? 'purging soon' : `${drop.days_remaining} day${drop.days_remaining === 1 ? '' : 's'} left`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={restoring === drop.id}
                    onClick={() => handleRestore(drop)}
                    className="flex-shrink-0"
                  >
                    <RotateCcw size={13} aria-hidden="true" /> Restore
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>
    </SettingsSection>
  );
};
