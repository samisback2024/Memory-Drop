import React from 'react';
import { Search, X } from 'lucide-react';
import { MOOD_META, type Mood } from '../../types/feed';
import { MEMORY_TYPE_OPTIONS, CAPSULE_VISIBILITY_META, type CapsuleArchiveFilters, type CapsuleLockStatus } from '../../types/capsule';

interface CapsuleFiltersProps {
  filters: CapsuleArchiveFilters;
  onChange: (filters: CapsuleArchiveFilters) => void;
  years: number[];
  showSearch?: boolean;
}

const LOCK_STATUS_OPTIONS: { value: CapsuleLockStatus | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'locked', label: 'Locked' },
  { value: 'unlocked', label: 'Unlocked' },
];

export const CapsuleFilters: React.FC<CapsuleFiltersProps> = ({ filters, onChange, years, showSearch = true }) => {
  const hasActiveFilters = Boolean(filters.search || filters.lockStatus || filters.year || filters.mood || filters.mediaType || filters.visibility);

  return (
    <div className="flex flex-col gap-3">
      {showSearch && (
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={filters.search}
            onChange={e => onChange({ ...filters, search: e.target.value })}
            placeholder="Search your archive…"
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      )}

      <div className="flex bg-white/70 backdrop-blur-xl rounded-xl p-1 gap-1 border border-white/60 shadow-sm w-fit">
        {LOCK_STATUS_OPTIONS.map(opt => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange({ ...filters, lockStatus: opt.value })}
            className={[
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filters.lockStatus === opt.value ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300' : 'text-gray-500 hover:text-gray-800',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-0.5">
        <select
          value={filters.year ?? ''}
          onChange={e => onChange({ ...filters, year: e.target.value ? Number(e.target.value) : null })}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white flex-shrink-0"
        >
          <option value="">Any year</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          value={filters.mood ?? ''}
          onChange={e => onChange({ ...filters, mood: (e.target.value || null) as Mood | null })}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white flex-shrink-0"
        >
          <option value="">Any mood</option>
          {(Object.keys(MOOD_META) as Mood[]).map(m => <option key={m} value={m}>{MOOD_META[m].emoji} {MOOD_META[m].label}</option>)}
        </select>

        <select
          value={filters.mediaType ?? ''}
          onChange={e => onChange({ ...filters, mediaType: (e.target.value || null) as CapsuleArchiveFilters['mediaType'] })}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white flex-shrink-0"
        >
          <option value="">Any type</option>
          {MEMORY_TYPE_OPTIONS.map(o => <option key={o.type} value={o.type}>{o.label}</option>)}
        </select>

        <select
          value={filters.visibility ?? ''}
          onChange={e => onChange({ ...filters, visibility: (e.target.value || null) as CapsuleArchiveFilters['visibility'] })}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white flex-shrink-0"
        >
          <option value="">Any visibility</option>
          {(Object.keys(CAPSULE_VISIBILITY_META) as (keyof typeof CAPSULE_VISIBILITY_META)[]).map(v => (
            <option key={v} value={v}>{CAPSULE_VISIBILITY_META[v].label}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => onChange({ search: '', lockStatus: null, year: null, mood: null, mediaType: null, visibility: null })}
            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 flex-shrink-0 px-1"
          >
            <X size={12} aria-hidden="true" /> Clear
          </button>
        )}
      </div>
    </div>
  );
};
