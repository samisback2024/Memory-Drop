import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  error?: string;
  id?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, label, error, id }) => {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-start gap-2.5 cursor-pointer select-none">
        <button
          type="button"
          id={id}
          role="checkbox"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={[
            'mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors',
            checked ? 'bg-black border-black' : 'bg-white border-gray-300 hover:border-gray-400',
            error ? 'border-red-400' : '',
          ].join(' ')}
        >
          {checked && <Check size={13} className="text-white" strokeWidth={3} />}
        </button>
        <span className="text-sm text-gray-600 leading-snug">{label}</span>
      </label>
      {error && <p className="text-sm text-red-500 pl-7">{error}</p>}
    </div>
  );
};
