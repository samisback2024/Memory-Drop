import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { SettingsSection } from './SettingsSection';
import { FeedbackForm } from './FeedbackForm';

const FAQ = [
  { q: 'When can I see a locked Time Capsule?', a: "Exactly when its unlock date arrives — not before, not even for you. Tap “Open Capsule” once it's due." },
  { q: 'What happens to a Moment after it expires?', a: 'It disappears from the tray and from everyone else’s view, but stays in your own Memories archive forever.' },
  { q: 'Who can see my private account’s content?', a: 'Only accounts you’ve accepted into your Orbit, unless a specific drop, moment, or capsule is set to Only Me or Orbit.' },
  { q: 'Can I get my username back after changing it?', a: 'Yes, as long as nobody else has taken it — but you can only change your username once every 30 days.' },
];

export const HelpSettings: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <SettingsSection title="Help & Support" description="Answers, and ways to reach us.">
      <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-5 sm:p-6 flex flex-col gap-1 transition-colors">
        <div className="flex items-center gap-2.5 pb-3">
          <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <HelpCircle size={15} aria-hidden="true" />
          </span>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Frequently asked</h3>
        </div>
        <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
          {FAQ.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-3 py-3.5 text-left group"
                >
                  <span className={`text-sm font-medium transition-colors ${isOpen ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-400'}`}>
                    {item.q}
                  </span>
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${isOpen ? 'bg-purple-100 dark:bg-purple-950/50 rotate-180' : 'bg-gray-50 dark:bg-gray-800'}`}>
                    <ChevronDown size={12} className={isOpen ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'} aria-hidden="true" />
                  </span>
                </button>
                {isOpen && (
                  <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400 pb-4 pr-8 animate-fade-in">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <FeedbackForm
        type="support"
        title="Contact support"
        description="Stuck on something? We'll get back to you."
        placeholder="What do you need help with?"
        submitLabel="Send to support"
      />

      <FeedbackForm
        type="bug"
        title="Report a bug"
        description="Something broken? Tell us exactly what happened."
        placeholder="What went wrong? Include what you were doing when it happened."
        submitLabel="Report bug"
      />

      <FeedbackForm
        type="feedback"
        title="Send feedback"
        description="Ideas, requests, anything on your mind."
        placeholder="What would make Memory Drop better?"
        submitLabel="Send feedback"
      />
    </SettingsSection>
  );
};
