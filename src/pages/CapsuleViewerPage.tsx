import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CapsuleViewer } from '../components/capsules/CapsuleViewer';

// A permalink to a single capsule, at /capsules/:capsuleId.
export const CapsuleViewerPage: React.FC = () => {
  const { capsuleId } = useParams<{ capsuleId: string }>();
  const navigate = useNavigate();

  if (!capsuleId) return null;

  return (
    <div className="max-w-lg mx-auto">
      <CapsuleViewer capsuleId={capsuleId} onDeleted={() => navigate('/capsules')} />
    </div>
  );
};
