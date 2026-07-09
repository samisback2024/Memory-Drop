import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateMomentModal } from '../components/moments/CreateMomentModal';

// A directly-linkable version of the same composer the tray's "Add
// Moment" bubble opens inline — useful for a deep link or a bookmark,
// not a separate flow.
export const MomentCreatePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <CreateMomentModal
      isOpen
      onClose={() => navigate('/feed')}
      onCreated={() => navigate('/moments')}
    />
  );
};
