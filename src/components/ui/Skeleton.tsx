import React from 'react';

interface SkeletonProps {
  className?: string;
  rounded?: 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const roundedClasses: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

// A single pulsing block — pages compose these into whatever shape they
// need (see ProfilePage / PublicProfilePage for the profile-header,
// stats-row, and badges skeletons) rather than each screen shipping its
// own bespoke skeleton component.
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', rounded = 'md' }) => (
  <div className={['animate-pulse bg-gray-200', roundedClasses[rounded], className].join(' ')} aria-hidden="true" />
);
