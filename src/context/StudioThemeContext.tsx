'use client';

import React, { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react';

export const STUDIO_THEMES = ['neutral', 'oled', 'warm'] as const;
export type StudioTheme = (typeof STUDIO_THEMES)[number];

const STORAGE_KEY = 'vantra_studio_theme';

type StudioThemeContextValue = {
  theme: StudioTheme;
  setTheme: (theme: StudioTheme) => void;
};

const StudioThemeContext = createContext<StudioThemeContextValue | null>(null);

function isStudioTheme(value: string | null): value is StudioTheme {
  return STUDIO_THEMES.includes(value as StudioTheme);
}

export function StudioThemeProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const [theme, setThemeState] = useState<StudioTheme>('neutral');

  useLayoutEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isStudioTheme(saved)) setThemeState(saved);
    } catch {
      // Storage may be unavailable in hardened/private browser contexts.
    }
  }, []);

  const setTheme = useCallback((nextTheme: StudioTheme) => {
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // The in-memory preference still applies for the current session.
    }
  }, []);

  return (
    <StudioThemeContext.Provider value={{ theme, setTheme }}>
      <div
        lang={locale}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        data-studio-theme={theme}
        suppressHydrationWarning
        className="studio-overlay-root min-h-screen bg-[var(--studio-canvas)] text-[var(--studio-text-primary)]"
      >
        {children}
      </div>
    </StudioThemeContext.Provider>
  );
}

export function useStudioTheme() {
  const context = useContext(StudioThemeContext);
  if (!context) throw new Error('useStudioTheme must be used within StudioThemeProvider');
  return context;
}
