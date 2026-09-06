'use client';

import React, { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import useUser from '../../hooks/useUser';
import StudioDashboard from './StudioDashboard';

export default function StudioWorkspace() {
  const locale = useLocale();
  const router = useRouter();
  const { status } = useUser();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/${locale}`);
  }, [locale, router, status]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]" aria-busy={status === 'loading'}>
        <span className="h-5 w-5 animate-pulse rounded-full border border-white/20 bg-white/10 motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  }

  return <StudioDashboard />;
}
