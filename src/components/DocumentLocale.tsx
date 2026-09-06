'use client';

import { useLayoutEffect } from 'react';

export default function DocumentLocale({
  locale,
  scrollSmooth = false,
}: {
  locale: string;
  scrollSmooth?: boolean;
}) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = locale === 'ar' ? 'rtl' : 'ltr';
    root.classList.toggle('scroll-smooth', scrollSmooth);
  }, [locale, scrollSmooth]);

  return null;
}
