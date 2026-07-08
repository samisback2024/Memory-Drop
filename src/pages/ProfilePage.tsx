import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCapsules } from '../hooks/useCapsules';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { AvatarGenerator } from '../components/profile/AvatarGenerator';
import { CapsuleCard } from '../components/feed/CapsuleCard';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { isUnlocked } from '../utils/date';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, signOut, updateProfile } = useAuth();
  const { getMyCapsules, loading } = useCapsules();
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const myCapsules = getMyCapsules();
  const unlockedCapsules = myCapsules.filter(c => isUnlocked(c.unlock_date));
  const lockedCapsules = myCapsules.filter(c => !isUnlocked(c.unlock_date));

  const handleAvatarSelect = async (url: string) => {
    await updateProfile({ avatar_url: url });
    setShowAvatarModal(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-4">
      <ProfileHeader
        profile={profile}
        isOwnProfile
        capsuleCount={myCapsules.length}
        unlockedCount={unlockedCapsules.length}
        lockedCount={lockedCapsules.length}
        onEditAvatar={() => setShowAvatarModal(true)}
      />

      {/* Recent capsules */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">My Capsules</h2>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
          </div>
        ) : myCapsules.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-3">No capsules yet.</p>
            <Button size="sm" onClick={() => navigate('/create')}>Create your first capsule</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {myCapsules.slice(0, 5).map(capsule => (
              <CapsuleCard key={capsule.id} capsule={capsule} />
            ))}
          </div>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 font-medium px-1 py-2 transition-colors"
      >
        <LogOut size={16} />
        Sign out
      </button>

      <Modal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        title="Choose Avatar"
      >
        <AvatarGenerator
          onSelect={handleAvatarSelect}
          onCancel={() => setShowAvatarModal(false)}
        />
      </Modal>
    </div>
  );
};
