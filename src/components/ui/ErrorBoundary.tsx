import React from 'react';
import { ErrorState } from './ErrorState';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Wraps AppShell's routed content (see App.tsx) so a render crash in
// one page shows a calm, on-brand fallback — reusing the same
// ErrorState every other failure path in this app already uses —
// rather than a blank white screen or React's raw error overlay
// reaching a real user. "Try again" reloads the page rather than
// attempting to re-render the same broken tree, since a render-phase
// error's cause (bad data, a null ref, etc.) usually isn't cleared by
// simply retrying render.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('Unhandled error in routed content:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <ErrorState
            title="Something went wrong"
            description="This page ran into a problem. Reloading usually fixes it."
            onRetry={() => window.location.reload()}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
