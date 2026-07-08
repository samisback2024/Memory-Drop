import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'outline';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  outline: 'bg-white border border-gray-200 text-gray-600',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  dot = false,
}) => {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 font-medium rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${variant === 'success' ? 'bg-green-500' : variant === 'danger' ? 'bg-red-500' : 'bg-current'}`} />}
      {children}
    </span>
  );
};

export const BADGE_LABELS: Record<string, { label: string; variant: BadgeVariant }> = {
  early_adopter: { label: '🌱 Early Adopter', variant: 'success' },
  memory_maker: { label: '📦 Memory Maker', variant: 'purple' },
  social_butterfly: { label: '🦋 Social', variant: 'info' },
  photographer: { label: '📷 Photographer', variant: 'default' },
  music_lover: { label: '🎵 Music Lover', variant: 'info' },
  writer: { label: '✍️ Writer', variant: 'default' },
  streak_master: { label: '🔥 Streak Master', variant: 'warning' },
  designer: { label: '🎨 Designer', variant: 'purple' },
};
