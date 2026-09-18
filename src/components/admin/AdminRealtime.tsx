'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/src/lib/supabase/client';

/** One subscription for the Admin layout; low-volume DB changes refresh only the visible surface. */
export default function AdminRealtime({ canSubscribe }: { canSubscribe: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!canSubscribe) {
      let lastRefresh = Date.now();
      const refreshOnReturn = () => {
        if (document.visibilityState !== 'visible' || Date.now() - lastRefresh < 30_000) return;
        if (!['/admin', '/admin/jobs', '/admin/models', '/admin/providers'].includes(pathRef.current)) return;
        lastRefresh = Date.now();
        router.refresh();
      };
      window.addEventListener('focus', refreshOnReturn);
      document.addEventListener('visibilitychange', refreshOnReturn);
      return () => {
        window.removeEventListener('focus', refreshOnReturn);
        document.removeEventListener('visibilitychange', refreshOnReturn);
      };
    }
    let pending: ReturnType<typeof setTimeout> | null = null;
    let dirty = false;
    const schedule = (table: string) => {
      const path = pathRef.current;
      const relevant = path === '/admin'
        || (path === '/admin/jobs' && (table === 'ai_executions' || table === 'generations'))
        || (path === '/admin/models' && table === 'model_runtime_configs')
        || (path === '/admin/providers' && table === 'provider_runtime_configs');
      if (!relevant) return;
      if (document.visibilityState !== 'visible') { dirty = true; return; }
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => { pending = null; router.refresh(); }, 1500);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && dirty) {
        dirty = false;
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => { pending = null; router.refresh(); }, 1500);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // Auth app_metadata changes require a fresh JWT before Realtime checks owner RLS.
    void supabase.auth.refreshSession().then(async ({ data, error }) => {
      if (cancelled || error || data.session?.user.app_metadata?.role !== 'owner') return;
      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase.channel('vantra-admin-operations')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_executions' }, () => schedule('ai_executions'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'generations' }, () => schedule('generations'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'model_runtime_configs' }, () => schedule('model_runtime_configs'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'provider_runtime_configs' }, () => schedule('provider_runtime_configs'))
        .subscribe();
    }).catch(() => { /* No subscription without a verified fresh owner JWT. */ });
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (pending) clearTimeout(pending);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, canSubscribe]);
  return null;
}
