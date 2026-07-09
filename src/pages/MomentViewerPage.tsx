import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMoments } from '../hooks/useMoments';
import { MomentViewer } from '../components/moments/MomentViewer';
import type { Moment } from '../types/moment';

// A permalink to a single moment — resolves it first to find its author
// (the viewer plays through that author's whole stack, starting here),
// same "read-only single row" job DropPage does for /drop/:dropId.
export const MomentViewerPage: React.FC = () => {
  const { momentId } = useParams<{ momentId: string }>();
  const navigate = useNavigate();
  const { getMoment } = useMoments();
  const [moment, setMoment] = useState<Moment | null | undefined>(undefined);

  useEffect(() => {
    if (!momentId) return;
    getMoment(momentId).then(setMoment);
  }, [momentId, getMoment]);

  const handleClose = () => navigate('/feed');

  if (moment === undefined) {
    return (
      <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!moment || !momentId) {
    return (
      <div className="fixed inset-0 z-[70] bg-black flex flex-col items-center justify-center gap-3 text-white/70 text-sm">
        <p>This moment isn't available anymore.</p>
        <button type="button" onClick={handleClose} className="text-white underline">Back to feed</button>
      </div>
    );
  }

  return (
    <MomentViewer
      authorUserId={moment.user_id}
      includeExpired={moment.is_owner}
      startAtMomentId={momentId}
      onClose={handleClose}
    />
  );
};
