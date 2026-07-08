import React from 'react';
import { LegalLayout, LegalSection } from '../components/legal/LegalLayout';

// Placeholder legal copy — replace with real, counsel-reviewed Privacy
// Policy before this app accepts real users.
export const PrivacyPage: React.FC = () => (
  <LegalLayout title="Privacy Policy" updated="July 8, 2026">
    <LegalSection heading="1. What we collect">
      <p>
        When you create an account we collect your email address, username, display name, and date of birth
        (used only to verify you meet the minimum age requirement). If you sign in with Google, we receive your
        name and email from your Google account.
      </p>
    </LegalSection>
    <LegalSection heading="2. How we use it">
      <p>
        We use this information to create and secure your account, show your profile to other users, and
        communicate with you about your account (such as email verification and password reset links).
      </p>
    </LegalSection>
    <LegalSection heading="3. Who can see your data">
      <p>
        Your username, display name, and avatar are visible to other Memory Drop users. Your email address and
        date of birth are never shown publicly.
      </p>
    </LegalSection>
    <LegalSection heading="4. Data storage">
      <p>
        Account data is stored with Supabase, our authentication and database provider, and protected by
        row-level security so that only you can modify your own profile.
      </p>
    </LegalSection>
    <LegalSection heading="5. Your choices">
      <p>
        You can update your profile at any time. To request deletion of your account and associated data, contact
        us at the address below.
      </p>
    </LegalSection>
    <LegalSection heading="6. Contact">
      <p>Questions about this policy? Reach out at privacy@memorydrop.app.</p>
    </LegalSection>
  </LegalLayout>
);
