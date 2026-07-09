import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

// The shell every settings section page renders inside — a back link to
// the section list plus a heading, so every section feels like one
// consistent drill-down rather than 10 differently-shaped pages.
export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, description, children }) => (
  <div className="flex flex-col gap-4">
    <div>
      <Link to="/settings" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-purple-600 mb-2 transition-colors">
        <ChevronLeft size={12} aria-hidden="true" /> Settings
      </Link>
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h1>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
    </div>
    <div className="flex flex-col gap-4">{children}</div>
  </div>
);
