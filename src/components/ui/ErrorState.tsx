import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

// Distinct from EmptyState: this is for "something failed," not "nothing's
// here yet" — a network error retrying makes sense, a genuinely empty list
// retrying doesn't. See PublicProfilePage for the case that tells them apart.
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  description = 'Check your connection and try again.',
  onRetry,
}) => (
  <div className="flex flex-col items-center text-center gap-3 py-8">
    <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center">
      <AlertTriangle size={18} className="text-red-500" aria-hidden="true" />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-xs text-gray-400 max-w-[240px] mt-0.5">{description}</p>
    </div>
    {onRetry && (
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    )}
  </div>
);
