import React from 'react';

export const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-1 px-3.5 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm w-fit" aria-live="polite" aria-label="Typing">
    {[0, 1, 2].map(i => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce"
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </div>
);
