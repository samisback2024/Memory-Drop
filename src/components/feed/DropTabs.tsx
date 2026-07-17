import React, { useLayoutEffect, useRef, useState } from 'react';
import type { DropTab } from '../../types/feed';

interface DropTabsProps {
  active: DropTab;
  onChange: (tab: DropTab) => void;
}

const TABS: Array<{ key: DropTab; label: string }> = [
  { key: 'my_drops', label: 'My Drops' },
  { key: 'in_orbit', label: 'In Orbit' },
  { key: 'public_drops', label: 'Public Drops' },
  { key: 'saved_to_unlock', label: 'Saved to Unlock' },
];

// A real sliding indicator (one absolutely-positioned pill that animates
// its transform/width to the active button's own measured position) in
// place of the old "swap background classes" segmented control — the
// selection visibly travels between tabs instead of teleporting.
export const DropTabs: React.FC<DropTabsProps> = ({ active, onChange }) => {
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeIndex = TABS.findIndex(t => t.key === active);
  const [rect, setRect] = useState<{ left: number; width: number } | null>(null);

  // Refs are only populated after the first commit, and the indicator
  // also needs to re-measure whenever the active tab (or a layout-
  // affecting resize) changes — a plain render-time read would show a
  // stale or missing position on mount.
  useLayoutEffect(() => {
    const measure = () => {
      const btn = btnRefs.current[active];
      if (btn) setRect({ left: btn.offsetLeft, width: btn.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active]);

  const indicatorStyle: React.CSSProperties = rect
    ? { transform: `translateX(${rect.left}px)`, width: rect.width }
    : { opacity: 0 };

  return (
    <div role="tablist" aria-label="Memory Drop feed" className="relative flex bg-white dark:bg-gray-900 rounded-2xl p-1 gap-1 border border-gray-100 dark:border-gray-800 shadow-sm overflow-x-auto">
      <div
        className="absolute top-1 bottom-1 left-0 rounded-xl bg-purple-50 dark:bg-purple-950/30 transition-[transform,width] duration-300 ease-spring"
        style={indicatorStyle}
        aria-hidden="true"
      />
      {TABS.map((tab, i) => (
        <button
          key={tab.key}
          ref={el => { btnRefs.current[tab.key] = el; }}
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={[
            'relative z-10 flex-1 py-2 px-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-200',
            'focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
            active === tab.key ? 'text-purple-700 dark:text-purple-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
          ].join(' ')}
        >
          {tab.label}
          {i === activeIndex && <span className="sr-only"> (current)</span>}
        </button>
      ))}
    </div>
  );
};
