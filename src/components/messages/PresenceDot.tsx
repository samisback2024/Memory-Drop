import React from 'react';

interface PresenceDotProps {
  isOnline: boolean;
  className?: string;
}

export const PresenceDot: React.FC<PresenceDotProps> = ({ isOnline, className = '' }) => {
  if (!isOnline) return null;
  return (
    <span
      aria-label="Online"
      className={`w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 ${className}`}
    />
  );
};

export const formatLastSeen = (lastSeenAt: string | null, isOnline: boolean): string => {
  if (isOnline) return 'Online';
  if (!lastSeenAt) return '';
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Last seen just now';
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Last seen ${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `Last seen ${diffDay}d ago`;
  return 'Last seen a while ago';
};
