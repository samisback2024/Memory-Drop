import React, { useState } from 'react';
import { Send, CheckCircle2, Bug, Sparkles, LifeBuoy } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import type { FeedbackType } from '../../types/settings';

interface FeedbackFormProps {
  type: FeedbackType;
  title: string;
  description: string;
  placeholder: string;
  submitLabel: string;
}

// Each mailbox gets its own quiet identity — a tone, an icon, a glow —
// so "report a bug" doesn't visually read as "send feedback" at a
// glance. `support` rides the app's own theme-driven purple token (see
// index.css); the other two are deliberately fixed hues so they read
// consistently regardless of which theme the user has picked.
const TONE = {
  support: {
    icon: LifeBuoy,
    chip: 'bg-purple-600',
    glow: 'bg-purple-400/25 dark:bg-purple-500/20',
    ring: 'focus:ring-purple-400/70 dark:focus:ring-purple-500/50',
    button: 'bg-purple-600 hover:bg-purple-700 hover:shadow-purple-500/30',
    badge: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40',
  },
  bug: {
    icon: Bug,
    chip: 'bg-amber-500',
    glow: 'bg-amber-400/25 dark:bg-amber-500/20',
    ring: 'focus:ring-amber-400/70 dark:focus:ring-amber-500/50',
    button: 'bg-amber-500 hover:bg-amber-600 hover:shadow-amber-500/30',
    badge: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40',
  },
  feedback: {
    icon: Sparkles,
    chip: 'bg-emerald-500',
    glow: 'bg-emerald-400/25 dark:bg-emerald-500/20',
    ring: 'focus:ring-emerald-400/70 dark:focus:ring-emerald-500/50',
    button: 'bg-emerald-500 hover:bg-emerald-600 hover:shadow-emerald-500/30',
    badge: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40',
  },
} as const;

// One form, reused for Report a bug / Send feedback / Contact support —
// they're the same shape (a message, optionally a subject) landing in
// the same one-way `feedback_reports` mailbox, distinguished only by
// `type` (and, here, by the tone/icon that gives each its own identity).
export const FeedbackForm: React.FC<FeedbackFormProps> = ({ type, title, description, placeholder, submitLabel }) => {
  const { submitFeedback } = useSettings();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const tone = TONE[type];
  const Icon = tone.icon;

  const handleSubmit = async () => {
    setError(null);
    setStatus('sending');
    const { error: submitError } = await submitFeedback(type, subject, message);
    if (submitError) { setError(submitError); setStatus('idle'); return; }
    setStatus('sent');
    setSubject('');
    setMessage('');
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm transition-colors">
      <div className={`pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl ${tone.glow}`} aria-hidden="true" />

      <div className="relative p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm ${tone.chip}`}>
            <Icon size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>

        {status === 'sent' ? (
          <div className="flex items-center gap-2.5 py-2 animate-unlock-reveal">
            <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${tone.badge}`}>
              <CheckCircle2 size={16} aria-hidden="true" />
            </span>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Sent — thanks. We read every one of these.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {type !== 'bug' && (
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Subject (optional)"
                className={`bg-gray-50 dark:bg-gray-800/60 border-0 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-gray-800 transition-all ${tone.ring}`}
              />
            )}
            <div className="relative">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                rows={4}
                maxLength={2000}
                placeholder={placeholder}
                aria-label={placeholder}
                className={`w-full bg-gray-50 dark:bg-gray-800/60 border-0 rounded-xl px-3.5 py-2.5 pb-6 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-gray-800 transition-all ${tone.ring}`}
              />
              <span className={`absolute bottom-2 right-3 text-[10px] tabular-nums text-gray-400 dark:text-gray-500 transition-opacity ${focused || message ? 'opacity-100' : 'opacity-0'}`}>
                {message.length}/2000
              </span>
            </div>

            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={status === 'sending' || !message.trim()}
              className={`self-end inline-flex items-center gap-1.5 text-sm font-medium text-white rounded-full pl-4 pr-4 py-2 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:shadow-sm disabled:hover:translate-y-0 disabled:cursor-not-allowed ${tone.button}`}
            >
              {status === 'sending' ? (
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Send size={13} aria-hidden="true" />
              )}
              {submitLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
