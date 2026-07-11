import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useSettings } from './useSettings';
import { FONT_SIZE_META, type Theme, type FontSize, type ColorHue } from '../types/settings';

interface AppearanceState {
  theme: Theme;
  colorPrimary: ColorHue;
  colorSecondary: ColorHue;
  fontSize: FontSize;
  reducedMotion: boolean;
  highContrast: boolean;
  largerTouchTargets: boolean;
}

interface ThemeContextType extends AppearanceState {
  setTheme: (theme: Theme) => void;
  setColorPair: (primary: ColorHue, secondary: ColorHue) => void;
  setFontSize: (size: FontSize) => void;
  setReducedMotion: (value: boolean) => void;
  setHighContrast: (value: boolean) => void;
  setLargerTouchTargets: (value: boolean) => void;
}

const STORAGE_KEY = 'memorydrop_appearance';
const DEFAULT_STATE: AppearanceState = {
  theme: 'system', colorPrimary: 'classic_purple', colorSecondary: 'classic_blue',
  fontSize: 'medium', reducedMotion: false, highContrast: false, largerTouchTargets: false,
};

const readLocal = (): AppearanceState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
};

const applyToDocument = (state: AppearanceState) => {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = state.theme === 'dark' || (state.theme === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
  root.setAttribute('data-primary', state.colorPrimary);
  root.setAttribute('data-secondary', state.colorSecondary);
  root.classList.toggle('md-reduced-motion', state.reducedMotion);
  root.classList.toggle('md-high-contrast', state.highContrast);
  root.classList.toggle('md-large-touch', state.largerTouchTargets);
  root.style.setProperty('--md-font-scale', String(FONT_SIZE_META[state.fontSize].scale));
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Applies instantly from localStorage on first paint (no flash while
// waiting on a network round trip), then reconciles with user_settings
// once the signed-in user's real preferences load, which then becomes
// the source of truth going forward. Dark mode itself only visibly
// changes the core shell and the Settings page this phase touches —
// see the README for the honest scope of what "dark mode" covers today.
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { getSettings, updateSettings } = useSettings();
  const [state, setState] = useState<AppearanceState>(readLocal);

  useEffect(() => { applyToDocument(state); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);

  useEffect(() => {
    if (!state.theme || state.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyToDocument(state);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [state]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getSettings().then(settings => {
      if (cancelled || !settings) return;
      setState({
        theme: settings.theme,
        colorPrimary: settings.color_theme_primary,
        colorSecondary: settings.color_theme_secondary,
        fontSize: settings.font_size,
        reducedMotion: settings.reduced_motion,
        highContrast: settings.high_contrast,
        largerTouchTargets: settings.larger_touch_targets,
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const persist = useCallback((patch: Partial<AppearanceState>, dbPatch: Record<string, unknown>) => {
    setState(prev => ({ ...prev, ...patch }));
    if (user) updateSettings(dbPatch);
  }, [user, updateSettings]);

  const value: ThemeContextType = {
    ...state,
    setTheme: theme => persist({ theme }, { theme }),
    setColorPair: (primary, secondary) => persist(
      { colorPrimary: primary, colorSecondary: secondary },
      { color_theme_primary: primary, color_theme_secondary: secondary },
    ),
    setFontSize: fontSize => persist({ fontSize }, { font_size: fontSize }),
    setReducedMotion: reducedMotion => persist({ reducedMotion }, { reduced_motion: reducedMotion }),
    setHighContrast: highContrast => persist({ highContrast }, { high_contrast: highContrast }),
    setLargerTouchTargets: largerTouchTargets => persist({ largerTouchTargets }, { larger_touch_targets: largerTouchTargets }),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
