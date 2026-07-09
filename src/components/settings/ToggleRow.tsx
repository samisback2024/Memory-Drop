import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Toggle } from '../ui/Toggle';

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => Promise<void> | void;
}

// A settings-flavored wrapper around the shared ui/Toggle — optimistic
// flip plus a small saving indicator and automatic revert on failure,
// the same pattern every toggle across this app already follows.
export const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onChange }) => {
  const [value, setValue] = useState(checked);
  const [saving, setSaving] = useState(false);

  const handleChange = async (next: boolean) => {
    setValue(next);
    setSaving(true);
    try {
      await onChange(next);
    } catch {
      setValue(!next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Toggle checked={value} onChange={handleChange} label={label} description={description} />
      </div>
      {saving && <Loader2 size={13} className="text-gray-300 animate-spin flex-shrink-0" aria-hidden="true" />}
    </div>
  );
};
