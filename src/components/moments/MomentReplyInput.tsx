import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useMoments } from '../../hooks/useMoments';
import { validateMomentReply } from '../../lib/validators';

interface MomentReplyInputProps {
  momentId: string;
  onSent?: () => void;
}

export const MomentReplyInput: React.FC<MomentReplyInputProps> = ({ momentId, onSent }) => {
  const { replyToMoment } = useMoments();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    const validationError = validateMomentReply(content);
    if (validationError) { setError(validationError); return; }
    setSending(true);
    setError(null);
    const { error: sendError } = await replyToMoment(momentId, content);
    setSending(false);
    if (sendError) { setError(sendError); return; }
    setContent('');
    setSent(true);
    onSent?.();
    setTimeout(() => setSent(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col gap-1">
      <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full pl-4 pr-1.5 py-1.5 border border-white/20">
        <input
          type="text"
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Reply to this memory"
          maxLength={500}
          className="flex-1 bg-transparent border-0 text-sm text-white placeholder-white/60 focus:outline-none focus:ring-0 min-w-0"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !content.trim()}
          aria-label="Send reply"
          className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors disabled:opacity-40 flex-shrink-0"
        >
          <Send size={15} aria-hidden="true" />
        </button>
      </div>
      {error && <p className="text-xs text-red-300 px-2">{error}</p>}
      {sent && <p className="text-xs text-white/70 px-2">Sent.</p>}
    </div>
  );
};
