import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Scale, Code2, Heart } from 'lucide-react';
import { SettingsSection } from './SettingsSection';
import { SettingsCard } from './SettingsCard';

const APP_VERSION = '1.0.0';

export const AboutSettings: React.FC = () => (
  <SettingsSection title="About" description="The fine print.">
    <SettingsCard title="Version">
      <p className="text-sm text-gray-700 dark:text-gray-300">Memory Drop {APP_VERSION}</p>
    </SettingsCard>

    <SettingsCard>
      <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
        <Link to="/privacy" className="flex items-center gap-2.5 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:text-purple-600">
          <FileText size={14} aria-hidden="true" /> Privacy Policy
        </Link>
        <Link to="/terms" className="flex items-center gap-2.5 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:text-purple-600">
          <Scale size={14} aria-hidden="true" /> Terms of Service
        </Link>
      </div>
    </SettingsCard>

    <SettingsCard title="Open-source licenses">
      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
        <Code2 size={13} aria-hidden="true" /> Built with React, Vite, Tailwind CSS, and Supabase. A full third-party license list will live here in a later pass.
      </p>
    </SettingsCard>

    <SettingsCard title="Credits">
      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
        <Heart size={13} className="text-pink-400" aria-hidden="true" /> Made for anyone with a memory worth saving for later.
      </p>
    </SettingsCard>
  </SettingsSection>
);
