import React from 'react';

interface MomentProgressBarProps {
  count: number;
  activeIndex: number;
  progress: number;
}

export const MomentProgressBar: React.FC<MomentProgressBarProps> = ({ count, activeIndex, progress }) => (
  <div
    className="flex gap-1 px-3 pt-3"
    role="progressbar"
    aria-valuenow={Math.round(((activeIndex + progress) / count) * 100)}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
        <div
          className="h-full bg-white rounded-full"
          style={{ width: i < activeIndex ? '100%' : i === activeIndex ? `${progress * 100}%` : '0%' }}
        />
      </div>
    ))}
  </div>
);
