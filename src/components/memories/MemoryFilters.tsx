import React from 'react';
import { X } from 'lucide-react';
import { MOOD_META, type Mood } from '../../types/feed';
import { CAPSULE_VISIBILITY_META, MEMORY_TYPE_OPTIONS } from '../../types/capsule';
import { MONTH_NAMES, type MemoryFilters as MemoryFiltersType } from '../../types/memory';

interface MemoryFiltersProps {
  filters: MemoryFiltersType;
  onChange: (filters: MemoryFiltersType) => void;
  years: number[];
}

export const MemoryFilters: React.FC<MemoryFiltersProps> = ({ filters, onChange, years }) => {
  const hasActive = Boolean(
    filters.lockStatus || filters.year || filters.month || filters.mood ||
    filters.visibility || filters.mediaType,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        <select
          value={filters.lockStatus ?? ''}
          onChange={e => onChange({ ...filters, lockStatus: (e.target.value || null) as MemoryFiltersType['lockStatus'] })}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white flex-shrink-0"
        >
          <option value="">Locked & unlocked</option>
          <option value="unlocked">Unlocked</option>
          <option value="locked">Locked</option>
        </select>

        <select
          value={filters.year ?? ''}
          onChange={e => onChange({ ...filters, year: e.target.value ? Number(e.target.value) : null })}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white flex-shrink-0"
        >
          <option value="">Any year</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          value={filters.month ?? ''}
          onChange={e => onChange({ ...filters, month: e.target.value ? Number(e.target.value) : null })}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white flex-shrink-0"
        >
          <option value="">Any month</option>
          {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
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
          onChange={e => onChange({ ...filters, mediaType: (e.target.value || null) as MemoryFiltersType['mediaType'] })}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white flex-shrink-0"
        >
          <option value="">Any type</option>
          {MEMORY_TYPE_OPTIONS.map(o => <option key={o.type} value={o.type}>{o.label}</option>)}
        </select>

        <select
          value={filters.visibility ?? ''}
          onChange={e => onChange({ ...filters, visibility: (e.target.value || null) as MemoryFiltersType['visibility'] })}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white flex-shrink-0"
        >
          <option value="">Any visibility</option>
          {(Object.keys(CAPSULE_VISIBILITY_META) as (keyof typeof CAPSULE_VISIBILITY_META)[]).map(v => (
            <option key={v} value={v}>{CAPSULE_VISIBILITY_META[v].label}</option>
          ))}
        </select>

        {hasActive && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, lockStatus: null, year: null, month: null, mood: null, visibility: null, mediaType: null, favoritesOnly: false })}
            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 flex-shrink-0 px-1"
          >
            <X size={12} aria-hidden="true" /> Clear
          </button>
        )}
      </div>
    </div>
  );
};
