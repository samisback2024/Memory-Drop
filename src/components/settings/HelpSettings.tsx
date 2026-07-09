import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SettingsSection } from './SettingsSection';
import { SettingsCard } from './SettingsCard';
import { FeedbackForm } from './FeedbackForm';

const FAQ = [
  { q: 'When can I see a locked Time Capsule?', a: "Exactly when its unlock date arrives — not before, not even for you. Tap “Open Capsule” once it's due." },
  { q: 'What happens to a Moment after it expires?', a: 'It disappears from the tray and from everyone else’s view, but stays in your own Memories archive forever.' },
  { q: 'Who can see my private account’s content?', a: 'Only accounts you’ve accepted as followers, unless a specific drop, moment, or capsule is set to Only Me or Followers.' },
  { q: 'Can I get my username back after changing it?', a: 'Yes, as long as nobody else has taken it — but you can only change your username once every 30 days.' },
];

export const HelpSettings: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <SettingsSection title="Help & Support" description="Answers, and ways to reach us.">
      <SettingsCard title="FAQ">
        <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
          {FAQ.map((item, i) => (
            <div key={item.q}>
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between gap-2 py-3 text-left"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.q}</span>
                <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${openIndex === i ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {openIndex === i && <p className="text-sm text-gray-500 dark:text-gray-400 pb-3">{item.a}</p>}
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Contact support">
        <FeedbackForm type="support" placeholder="What do you need help with?" submitLabel="Send to support" />
      </SettingsCard>

      <SettingsCard title="Report a bug">
        <FeedbackForm type="bug" placeholder="What went wrong? Include what you were doing when it happened." submitLabel="Report bug" />
      </SettingsCard>

      <SettingsCard title="Send feedback">
        <FeedbackForm type="feedback" placeholder="What would make Memory Drop better?" submitLabel="Send feedback" />
      </SettingsCard>
    </SettingsSection>
  );
};
