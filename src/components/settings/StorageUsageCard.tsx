import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Video, Music, Database } from 'lucide-react';
import { useSettings, type StorageUsage } from '../../hooks/useSettings';

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return '< 1 MB';
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
};

// Real numbers, not an estimate — lists every file this account owns
// across all five storage buckets (avatars, covers, post-media, moments,
// capsules) via the Storage API's own size metadata and sums them.
export const StorageUsageCard: React.FC = () => {
  const { getStorageUsage } = useSettings();
  const [usage, setUsage] = useState<StorageUsage | null>(null);

  useEffect(() => { getStorageUsage().then(setUsage); }, [getStorageUsage]);

  if (!usage) return <div className="h-28 rounded-xl bg-gray-50 dark:bg-gray-800 animate-pulse" />;

  const rows = [
    { label: 'Photos', value: usage.photos, icon: ImageIcon },
    { label: 'Videos', value: usage.videos, icon: Video },
    { label: 'Audio', value: usage.audio, icon: Music },
    { label: 'Other', value: usage.other, icon: Database },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatBytes(usage.total)}</span>
        <span className="text-xs text-gray-400">used in total</span>
      </div>
      <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
        {rows.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2.5 py-2">
            <Icon size={14} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{label}</span>
            <span className="text-xs text-gray-400">{formatBytes(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
