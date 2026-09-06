'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import useUser from '../../hooks/useUser';
import StudioDashboard from './StudioDashboard';

const WORKSPACES = ['chat', 'image', 'video', 'library'] as const;
type StudioWorkspaceRoute = (typeof WORKSPACES)[number];

export default function StudioWorkspace() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useUser();
  const redirectedRef = useRef(false);
  const segment = pathname.split('/').filter(Boolean)[1];
  const workspace = WORKSPACES.includes(segment as StudioWorkspaceRoute)
    ? (segment as StudioWorkspaceRoute)
    : null;

  useEffect(() => {
    if (status === 'authenticated') redirectedRef.current = false;
    if (status === 'unauthenticated' && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace(`/${locale}`);
    }
  }, [locale, router, status]);

  const navigateWorkspace = useCallback((next: StudioWorkspaceRoute) => {
    if (next !== workspace) router.push(`/studio/${next}`);
  }, [router, workspace]);

  if (status !== 'authenticated' || !workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]" aria-busy={status === 'loading'}>
        <span className="h-5 w-5 animate-pulse rounded-full border border-white/20 bg-white/10 motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  }

  return <StudioDashboard activeWorkspace={workspace} onWorkspaceChange={navigateWorkspace} />;
}
