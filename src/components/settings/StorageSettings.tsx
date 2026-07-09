import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, FolderOpen } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { SettingsSection } from './SettingsSection';
import { SettingsCard } from './SettingsCard';
import { StorageUsageCard } from './StorageUsageCard';
import { Button } from '../ui/Button';

export const StorageSettings: React.FC = () => {
  const { clearLocalDrafts } = useSettings();
  const [clearedCount, setClearedCount] = useState<number | null>(null);

  const handleClearCache = () => setClearedCount(clearLocalDrafts());

  return (
    <SettingsSection title="Storage" description="What you're using, and how to manage it.">
      <SettingsCard title="Storage usage">
        <StorageUsageCard />
      </SettingsCard>

      <SettingsCard title="Clear cached files" description="Removes locally-saved drafts (unposted captions) from this browser. Doesn't touch anything already saved to your account.">
        <Button variant="outline" size="sm" onClick={handleClearCache} className="self-start">
          <Trash2 size={13} aria-hidden="true" /> Clear cache
        </Button>
        {clearedCount !== null && (
          <p className="text-xs text-gray-400">{clearedCount > 0 ? `Cleared ${clearedCount} local draft${clearedCount === 1 ? '' : 's'}.` : 'Nothing to clear.'}</p>
        )}
      </SettingsCard>

      <SettingsCard title="Manage uploaded media" description="Delete individual photos, videos, and audio by deleting the drop, moment, or capsule they belong to.">
        <div className="flex gap-2">
          <Link to="/capsules"><Button variant="outline" size="sm"><FolderOpen size={13} aria-hidden="true" /> Capsules</Button></Link>
          <Link to="/memories"><Button variant="outline" size="sm"><FolderOpen size={13} aria-hidden="true" /> Memories</Button></Link>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
};
