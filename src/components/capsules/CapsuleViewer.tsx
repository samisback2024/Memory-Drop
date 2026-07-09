import React, { useEffect, useState } from 'react';
import { useCapsules } from '../../hooks/useCapsules';
import { CapsuleCard } from './CapsuleCard';
import { EmptyState } from '../ui/EmptyState';
import { Lock } from 'lucide-react';
import type { Capsule } from '../../types/capsule';

interface CapsuleViewerProps {
  capsuleId: string;
  onDeleted?: () => void;
}

// The single-capsule permalink surface — fetches by id and renders the
// same CapsuleCard used everywhere else, so a shared link looks and
// behaves exactly like the one in someone's archive.
export const CapsuleViewer: React.FC<CapsuleViewerProps> = ({ capsuleId, onDeleted }) => {
  const { getCapsule } = useCapsules();
  const [capsule, setCapsule] = useState<Capsule | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getCapsule(capsuleId).then(data => { if (!cancelled) setCapsule(data); });
    return () => { cancelled = true; };
  }, [capsuleId, getCapsule]);

  if (capsule === undefined) {
    return <div className="h-40 rounded-2xl bg-white/60 animate-pulse" />;
  }

  if (!capsule) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm">
        <EmptyState icon={Lock} title="Capsule not found" description="This capsule doesn't exist, or you don't have permission to see it." />
      </div>
    );
  }

  return <CapsuleCard capsule={capsule} onDeleted={onDeleted} />;
};
