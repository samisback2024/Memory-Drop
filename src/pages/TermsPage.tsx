import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection } from '../components/legal/LegalLayout';

// Placeholder legal copy — replace with real, counsel-reviewed Terms of
// Service before this app accepts real users.
export const TermsPage: React.FC = () => (
  <LegalLayout title="Terms of Service" updated="July 8, 2026">
    <LegalSection heading="1. Acceptance of terms">
      <p>
        By creating a Memory Drop account, you agree to be bound by these Terms of Service. If you do not agree,
        do not create an account or use the service.
      </p>
    </LegalSection>
    <LegalSection heading="2. Eligibility">
      <p>
        You must be at least 13 years old to use Memory Drop. By registering, you confirm that the date of birth
        you provide is accurate and that you meet this minimum age requirement.
      </p>
    </LegalSection>
    <LegalSection heading="3. Your account">
      <p>
        You are responsible for maintaining the confidentiality of your password and for all activity that occurs
        under your account. Usernames must be unique and follow the format rules shown at sign-up. Notify us
        immediately if you suspect unauthorized use of your account.
      </p>
    </LegalSection>
    <LegalSection heading="4. Acceptable use">
      <p>
        Don&apos;t use Memory Drop to violate the law, infringe others&apos; rights, or upload content you don&apos;t
        have permission to share. We may suspend or terminate accounts that violate these terms.
      </p>
    </LegalSection>
    <LegalSection heading="5. Changes to these terms">
      <p>
        We may update these terms from time to time. Continued use of Memory Drop after changes take effect
        constitutes acceptance of the revised terms.
      </p>
    </LegalSection>
    <LegalSection heading="6. Contact">
      <p>
        Questions about these terms? Reach out at support@memorydrop.app, or visit our{' '}
        <Link to="/support" className="text-purple-600 dark:text-purple-400 font-medium">Support page</Link>.
      </p>
    </LegalSection>
  </LegalLayout>
);
