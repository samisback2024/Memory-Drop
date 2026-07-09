import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { Button } from '../ui/Button';
import type { FeedbackType } from '../../types/settings';

interface FeedbackFormProps {
  type: FeedbackType;
  placeholder: string;
  submitLabel: string;
}

// One form, reused for Report a bug / Send feedback / Contact support —
// they're the same shape (a message, optionally a subject) landing in
// the same one-way `feedback_reports` mailbox, distinguished only by
// `type`.
export const FeedbackForm: React.FC<FeedbackFormProps> = ({ type, placeholder, submitLabel }) => {
  const { submitFeedback } = useSettings();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setStatus('sending');
    const { error: submitError } = await submitFeedback(type, subject, message);
    if (submitError) { setError(submitError); setStatus('idle'); return; }
    setStatus('sent');
    setSubject('');
    setMessage('');
  };

  if (status === 'sent') {
    return <p className="text-sm text-green-600">Thanks — we received it.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {type !== 'bug' && (
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      )}
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder={placeholder}
        className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button variant="outline" size="sm" onClick={handleSubmit} loading={status === 'sending'} className="self-start">
        <Send size={13} aria-hidden="true" /> {submitLabel}
      </Button>
    </div>
  );
};
