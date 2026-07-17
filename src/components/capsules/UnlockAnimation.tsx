import React, { useEffect, useState } from 'react';
import { Sparkles, LockOpen } from 'lucide-react';

interface UnlockAnimationProps {
  onComplete: () => void;
}

// Plays once, the moment "Open Capsule" is tapped — a short ritual
// before the real content appears, not an instant swap. ~1.4s total.
export const UnlockAnimation: React.FC<UnlockAnimationProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'opening' | 'burst'>('opening');

  useEffect(() => {
    const t1 = setTimeout(() => setStage('burst'), 450);
    const t2 = setTimeout(onComplete, 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-800 via-fuchsia-800 to-blue-800 px-6 py-16 flex flex-col items-center justify-center gap-4 min-h-[280px]">
      <div className="relative w-24 h-24 flex items-center justify-center">
        {stage === 'burst' && (
          <>
            <span className="absolute inset-0 rounded-full bg-white/40 animate-ping" style={{ animationDuration: '0.9s' }} aria-hidden="true" />
            {[0, 1, 2, 3, 4, 5].map(i => (
              <Sparkles
                key={i}
                size={14}
                className="absolute text-white animate-ping"
                style={{ animationDuration: '0.8s', transform: `rotate(${i * 60}deg) translateY(-40px)` }}
                aria-hidden="true"
              />
            ))}
          </>
        )}
        <span
          className={[
            'relative w-16 h-16 rounded-full bg-white shadow-2xl flex items-center justify-center transition-transform duration-700',
            stage === 'burst' ? 'scale-110' : 'scale-100',
          ].join(' ')}
        >
          <LockOpen size={26} className="text-purple-600" aria-hidden="true" />
        </span>
      </div>
      <p className="text-white text-sm font-medium tracking-wide animate-pulse">Opening your memory…</p>
    </div>
  );
};
