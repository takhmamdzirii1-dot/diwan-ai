'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('Admin.common');
  useEffect(() => { console.error('[admin] route error', { digest: error.digest }); }, [error]);
  return <div role="alert" className="mx-auto mt-16 max-w-xl rounded-2xl border border-red-400/15 bg-red-400/[0.04] p-6 text-center">
    <AlertTriangle className="mx-auto h-7 w-7 text-red-200/80" aria-hidden="true" />
    <h1 className="mt-4 text-lg font-semibold text-white">{t('pageErrorTitle')}</h1>
    <p className="mt-2 text-[12.5px] leading-relaxed text-white/55">{t('pageErrorDescription')}</p>
    <button type="button" onClick={reset} className="mt-5 h-10 rounded-xl bg-white px-4 text-[12px] font-semibold text-black hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">{t('tryAgain')}</button>
  </div>;
}
