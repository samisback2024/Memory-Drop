import React from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { LegalLayout, LegalSection } from '../components/legal/LegalLayout';
import { useAuth } from '../hooks/useAuth';

const SUPPORT_EMAIL = 'support@memorydrop.app';

// Public — reachable logged out (unlike Settings → Help, which is
// behind AuthProtectedRoute) so a link from a marketing page, an app
// store listing, or a support email signature always resolves to
// something real. Logged-in visitors get pointed at the fuller Help &
// Support section in Settings (FAQ + the actual feedback/bug-report
// forms) rather than duplicating that content here.
export const SupportPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <LegalLayout title="Support" updated="July 8, 2026">
      <LegalSection heading="Get in touch">
        <p>
          Questions, feedback, or something not working right? Email us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-purple-600 dark:text-purple-400 font-medium inline-flex items-center gap-1">
            <Mail size={14} aria-hidden="true" /> {SUPPORT_EMAIL}
          </a>{' '}
          and we'll get back to you.
        </p>
        {user && (
          <p>
            Signed in already? <Link to="/settings/help" className="text-purple-600 dark:text-purple-400 font-medium">Settings → Help &amp; Support</Link> has
            a searchable FAQ plus dedicated forms for bug reports and feedback.
          </p>
        )}
      </LegalSection>

      <LegalSection heading="Common questions">
        <p><strong className="text-gray-800 dark:text-gray-200">When can I see a locked Time Capsule?</strong><br />Exactly when its unlock date arrives — not before, not even for you.</p>
        <p><strong className="text-gray-800 dark:text-gray-200">What happens to a Moment after it expires?</strong><br />It disappears from the tray and everyone else's view, but stays in your own Memories archive forever.</p>
        <p><strong className="text-gray-800 dark:text-gray-200">Who can see my private account's content?</strong><br />Only accepted Orbit members, unless a specific Drop, Moment, or Capsule is set to Only Me or Orbit.</p>
      </LegalSection>

      <LegalSection heading="Get the app">
        <p>Memory Drop is currently available as a web app. Native app store listings are on the way.</p>
        <div className="flex flex-wrap gap-2 mt-1">
          <button type="button" disabled className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed">
            Coming to the App Store
          </button>
          <button type="button" disabled className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed">
            Coming to Google Play
          </button>
        </div>
      </LegalSection>

      <LegalSection heading="Legal">
        <p>
          <Link to="/terms" className="text-purple-600 dark:text-purple-400 font-medium">Terms of Service</Link>
          {' · '}
          <Link to="/privacy" className="text-purple-600 dark:text-purple-400 font-medium">Privacy Policy</Link>
        </p>
      </LegalSection>
    </LegalLayout>
  );
};
