import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { OnboardingArt, type OnboardingArtKind } from '../components/onboarding/OnboardingArt';

interface Slide {
  art: OnboardingArtKind;
  title: string;
  body: string;
}

// Shown exactly once, right after signup or a first-time Google sign-in —
// see needsOnboarding in useAuth and AuthProtectedRoute. Full-screen rather
// than AuthLayout's centered card: this is a tour, not a form.
const SLIDES: Slide[] = [
  {
    art: 'welcome',
    title: 'Welcome to Memory Drop',
    body: "Capture today. Unlock tomorrow. Here's a quick look at what you can do.",
  },
  {
    art: 'drop',
    title: 'Drop a memory',
    body: 'Share a photo, video, or note right now — or seal it to unlock later. You choose who sees it: everyone, followers, or just you.',
  },
  {
    art: 'capsule',
    title: 'Send memories into the future',
    body: 'Time Capsules hold what you add today and open themselves on a date you pick — days, months, even years from now.',
  },
  {
    art: 'moment',
    title: 'Moments come and go',
    body: 'Share quick, in-the-moment updates with close connections. They disappear after 24 hours.',
  },
  {
    art: 'memories',
    title: 'Everything you unlock, forever',
    body: 'Every memory you open lives in Memories, browsable by timeline, calendar, or year. Add friends to start sharing yours.',
  },
];

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { completeOnboarding } = useAuth();
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    setError(null);
    const { error: completeError } = await completeOnboarding();
    setFinishing(false);
    if (completeError) {
      setError(completeError);
      return;
    }
    navigate('/feed', { replace: true });
  };

  const handleNext = () => {
    if (isLast) {
      void finish();
      return;
    }
    setIndex(i => Math.min(i + 1, SLIDES.length - 1));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-purple-600 via-purple-500 to-blue-500">
      <OnboardingArt kind={slide.art} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-purple-950/80 via-purple-900/40 to-transparent" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="flex justify-end p-4">
          <button
            type="button"
            onClick={() => void finish()}
            disabled={finishing}
            className="text-sm font-medium text-white/80 hover:text-white transition-colors px-3 py-1.5 disabled:opacity-50"
          >
            Skip
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex flex-col items-center gap-6 px-6 pb-10">
          <div className="text-center max-w-sm">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 text-balance">{slide.title}</h1>
            <p className="text-white/85 text-base leading-relaxed">{slide.body}</p>
          </div>

          {error && (
            <div className="w-full max-w-sm bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl p-3">
              <p className="text-sm text-white text-center">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-2" role="tablist" aria-label="Onboarding progress">
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1} of ${SLIDES.length}`}
                onClick={() => setIndex(i)}
                className={[
                  'h-1.5 rounded-full transition-all',
                  i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60',
                ].join(' ')}
              />
            ))}
          </div>

          <Button
            type="button"
            onClick={handleNext}
            loading={finishing}
            size="lg"
            fullWidth
            className="max-w-sm !bg-white !text-purple-700 hover:!bg-white/90"
          >
            {isLast ? 'Get Started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
};
