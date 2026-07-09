import React, { useEffect, useRef, useState } from 'react';
import { useSocial } from '../../hooks/useSocial';
import { Avatar } from '../ui/Avatar';
import type { SocialUserWithRelationship } from '../../types/social';

interface CommentComposerProps {
  avatarUrl?: string | null;
  avatarName: string;
  placeholder?: string;
  onSubmit: (text: string) => Promise<void> | void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

const DEBOUNCE_MS = 250;

// Shared by the top-level "Add a comment" form and inline replies.
// @mention support is intentionally simple: it looks at the token after
// the LAST "@" in the whole value (not true cursor-position tracking,
// which would need a richer text-input component) — a reasonable
// simplification for a single-line comment box, documented in the
// README. Selecting a suggestion or matching an existing @username is
// purely a rendering/autocomplete convenience — there's no mentions
// table and no notification hookup (Phase 10 explicitly excludes
// Notifications), so this never needs to be "tracked," only typed and
// displayed.
export const CommentComposer: React.FC<CommentComposerProps> = ({ avatarUrl, avatarName, placeholder = 'Add a comment...', onSubmit, onCancel, autoFocus }) => {
  const { searchUsers } = useSocial();
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [suggestions, setSuggestions] = useState<SocialUserWithRelationship[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const at = text.lastIndexOf('@');
    if (at === -1 || /\s/.test(text.slice(at + 1))) {
      setSuggestions([]);
      return;
    }
    const query = text.slice(at + 1);
    if (!query) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => { searchUsers(query).then(r => setSuggestions(r.slice(0, 5))); }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, searchUsers]);

  const pickSuggestion = (username: string) => {
    const at = text.lastIndexOf('@');
    setText(`${text.slice(0, at)}@${username} `);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || posting) return;
    setPosting(true);
    await onSubmit(text);
    setPosting(false);
    setText('');
  };

  return (
    <div className="relative">
      <form onSubmit={submit} className="flex items-center gap-2">
        <Avatar src={avatarUrl} name={avatarName} size="xs" />
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={1000}
          autoFocus={autoFocus}
          aria-label={placeholder}
          className="flex-1 text-sm border border-gray-200 rounded-full px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <button type="submit" disabled={!text.trim() || posting} className="text-sm font-semibold text-purple-600 disabled:text-gray-300 transition-colors flex-shrink-0">
          Post
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">
            Cancel
          </button>
        )}
      </form>
      {suggestions.length > 0 && (
        <div role="listbox" className="absolute left-8 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-30 overflow-hidden">
          {suggestions.map(s => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={() => pickSuggestion(s.username)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Avatar src={s.profile_photo_url} name={s.display_name || s.username} size="xs" />
              <span className="font-medium">@{s.username}</span>
              {s.display_name && <span className="text-xs text-gray-400">{s.display_name}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
