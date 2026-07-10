import React from 'react';
import { Link } from 'react-router-dom';
import type { ProfileCompletion } from '../../lib/profile';

interface ProfileCompletionBarProps {
  completion: ProfileCompletion;
}

export const ProfileCompletionBar: React.FC<ProfileCompletionBarProps> = ({ completion }) => {
  if (completion.percentage >= 100) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Profile completion</p>
        <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">{completion.percentage}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-300"
          style={{ width: `${completion.percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Add {completion.missing.join(', ').toLowerCase()} to finish your profile.{' '}
        <Link to="/profile/edit" className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium">
          Edit profile
        </Link>
      </p>
    </div>
  );
};
