import React from 'react';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'square';
  ring?: boolean;
  ringColor?: string;
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-24 h-24 text-2xl',
};

const ringClasses = {
  xs: 'ring-1',
  sm: 'ring-2',
  md: 'ring-2',
  lg: 'ring-2',
  xl: 'ring-3',
  '2xl': 'ring-4',
};

const FALLBACK_COLORS = [
  'bg-purple-400',
  'bg-blue-400',
  'bg-teal-400',
  'bg-orange-500',
  'bg-red-400',
  'bg-indigo-400',
];

const getFallbackColor = (name: string): string => {
  const code = name.charCodeAt(0) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[code];
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = 'User',
  size = 'md',
  shape = 'circle',
  ring = false,
  ringColor = 'ring-purple-500',
  className = '',
  onClick,
}) => {
  const [imgError, setImgError] = React.useState(false);
  const showFallback = !src || imgError;

  return (
    <div
      onClick={onClick}
      className={[
        shape === 'square' ? 'rounded-2xl' : 'rounded-full',
        'overflow-hidden flex-shrink-0 flex items-center justify-center',
        sizeClasses[size],
        ring ? `${ringClasses[size]} ring-offset-1 ${ringColor}` : '',
        onClick ? 'cursor-pointer' : '',
        showFallback ? getFallbackColor(name) : 'bg-gray-200 dark:bg-gray-700',
        className,
      ].join(' ')}
    >
      {!showFallback ? (
        <img
          src={src!}
          alt={name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="font-semibold text-white select-none">
          {getInitials(name)}
        </span>
      )}
    </div>
  );
};
