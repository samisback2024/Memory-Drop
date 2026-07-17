import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { MomentArchive } from '../components/moments/MomentArchive';
import { MomentViewer } from '../components/moments/MomentViewer';
import { useAuth } from '../hooks/useAuth';

// The archive — every moment you've ever dropped, active or expired.
// Nobody but you can ever land here for anyone but yourself; the tray on
// Feed is where you view other people's live moments.
export const MomentsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [openMomentId, setOpenMomentId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Your Moments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Active and expired — this view is only ever yours.</p>
        </div>
        <Button variant="accent" size="sm" onClick={() => navigate('/moments/create')}>
          <Plus size={15} aria-hidden="true" />
          Add Moment
        </Button>
      </div>

      <MomentArchive onOpenMoment={setOpenMomentId} refreshKey={refreshKey} />

      {openMomentId && user && (
        <MomentViewer
          authorUserId={user.id}
          includeExpired
          startAtMomentId={openMomentId}
          onClose={() => { setOpenMomentId(null); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
};
