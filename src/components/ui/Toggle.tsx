import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  id?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, description, id }) => (
  <div className="flex items-center justify-between gap-4">
    <div>
      <label htmlFor={id} className="text-sm font-medium text-gray-900 cursor-pointer">
        {label}
      </label>
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative w-11 h-6 rounded-full flex-shrink-0 transition-colors',
        checked ? 'bg-black' : 'bg-gray-200',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  </div>
);
