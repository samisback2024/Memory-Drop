import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CapsuleWizard } from '../components/capsules/CapsuleWizard';

// A directly-linkable version of the same wizard the archive's "New
// Capsule" button opens inline.
export const CapsuleCreatePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <CapsuleWizard
      isOpen
      onClose={() => navigate('/capsules')}
      onCreated={() => navigate('/capsules')}
    />
  );
};
