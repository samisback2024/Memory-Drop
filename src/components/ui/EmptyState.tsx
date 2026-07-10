import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center text-center gap-2 py-6">
    <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
      <Icon size={18} className="text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</p>
    {description && <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[220px]">{description}</p>}
  </div>
);
