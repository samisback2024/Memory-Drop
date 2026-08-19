import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'info' | 'purple' | 'outline';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400',
  outline: 'bg-white border border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', icon, className = '' }) => (
  <span
    className={[
      'inline-flex items-center gap-1 font-medium rounded-full px-2.5 py-1 text-xs',
      variantClasses[variant],
      className,
    ].join(' ')}
  >
    {icon}
    {children}
  </span>
);
