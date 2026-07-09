import React from 'react';

interface SettingsCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

// The one card shape every settings section is built from — soft,
// rounded, generously spaced, dark-mode aware.
export const SettingsCard: React.FC<SettingsCardProps> = ({ title, description, children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 flex flex-col gap-4 transition-colors ${className}`}>
    {(title || description) && (
      <div>
        {title && <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
        {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
      </div>
    )}
    {children}
  </div>
);
