import React from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { COLOR_HUE_META, SIGNATURE_PAIRS, type ColorHue } from '../../types/settings';

const HUES = Object.keys(COLOR_HUE_META) as ColorHue[];

const HueGrid: React.FC<{ label: string; active: ColorHue; onPick: (hue: ColorHue) => void }> = ({ label, active, onPick }) => (
  <div className="flex flex-col gap-2">
    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
    <div role="radiogroup" aria-label={label} className="grid grid-cols-6 gap-2">
      {HUES.map(hue => {
        const isActive = active === hue;
        return (
          <button
            key={hue}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={COLOR_HUE_META[hue].label}
            title={COLOR_HUE_META[hue].label}
            onClick={() => onPick(hue)}
            className={`relative w-full aspect-square rounded-full border-2 transition-transform ${isActive ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`}
            style={{ backgroundColor: COLOR_HUE_META[hue].swatch }}
          >
            {isActive && <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  </div>
);

// Signature pairs are one-tap starting points; the two grids below let
// anyone override either slot independently — true mix and match, not
// a fixed set of combinations. Both apply instantly (no reload).
export const ColorThemeSelector: React.FC = () => {
  const { colorPrimary, colorSecondary, setColorPair } = useTheme();
  const activePairLabel = SIGNATURE_PAIRS.find(p => p.primary === colorPrimary && p.secondary === colorSecondary)?.label ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SIGNATURE_PAIRS.map(pair => {
          const active = activePairLabel === pair.label;
          return (
            <button
              key={pair.label}
              type="button"
              onClick={() => setColorPair(pair.primary, pair.secondary)}
              className={[
                'flex flex-col items-center gap-2 py-3 px-2 rounded-xl border text-center transition-colors',
                active ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
              ].join(' ')}
            >
              <span className="flex -space-x-1.5">
                <span className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800" style={{ backgroundColor: COLOR_HUE_META[pair.primary].swatch }} aria-hidden="true" />
                <span className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800" style={{ backgroundColor: COLOR_HUE_META[pair.secondary].swatch }} aria-hidden="true" />
              </span>
              <span className={`text-xs font-medium ${active ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-200'}`}>{pair.label}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{pair.description}</span>
            </button>
          );
        })}
      </div>

      <div className="pt-1 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-4">
        <p className="text-xs text-gray-400 dark:text-gray-500 -mb-1">Or pick any two colors yourself.</p>
        <HueGrid label="Primary color" active={colorPrimary} onPick={hue => setColorPair(hue, colorSecondary)} />
        <HueGrid label="Secondary color" active={colorSecondary} onPick={hue => setColorPair(colorPrimary, hue)} />
      </div>
    </div>
  );
};
