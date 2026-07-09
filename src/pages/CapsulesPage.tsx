import React, { useState } from 'react';
import { Plus, Clock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { CapsuleArchive } from '../components/capsules/CapsuleArchive';
import { CapsuleWizard } from '../components/capsules/CapsuleWizard';

// "My Archive" — every capsule you've ever sealed, searchable and
// filterable, the primary home for Time Capsules rather than a live
// feed tab. Creating one is a ritual, not a quick post, so it opens its
// own guided wizard instead of an inline composer.
export const CapsulesPage: React.FC = () => {
  const { user } = useAuth();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 -mx-4 px-4 -mt-6 pt-6 pb-6 bg-gradient-to-b from-purple-50/60 via-transparent to-transparent min-h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Clock size={20} className="text-purple-500" aria-hidden="true" />
            Time Capsules
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Memories you've sent into the future.</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setWizardOpen(true)}>
          <Plus size={15} aria-hidden="true" />
          New Capsule
        </Button>
      </div>

      <CapsuleArchive key={refreshKey} userId={user.id} isOwnArchive />

      <CapsuleWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
};
