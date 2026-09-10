'use client';

import { useState } from 'react';
import { Loader2, ShieldBan, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function AdminUserActions({ userId, status, isOwner, onChanged }: {
  userId: string;
  status: 'active' | 'unconfirmed' | 'suspended';
  isOwner: boolean;
  onChanged: (status: 'active' | 'unconfirmed' | 'suspended') => void;
}) {
  const t = useTranslations('Admin.users');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspended = status === 'suspended';
  const nextStatus = suspended ? 'active' : 'suspended';

  const updateStatus = async () => {
    if (isOwner || !window.confirm(t(suspended ? 'confirmReactivate' : 'confirmSuspend'))) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'USER_STATUS_UPDATE_FAILED');
      onChanged(body.status === 'unconfirmed' ? 'unconfirmed' : nextStatus);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'USER_STATUS_UPDATE_FAILED';
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.USER_STATUS_UPDATE_FAILED'));
    } finally {
      setLoading(false);
    }
  };

  if (isOwner) return <span className="text-[11px] text-[var(--studio-text-muted)]">{t('ownerProtected')}</span>;

  return <div className="space-y-1.5 text-end">
    <button
      type="button"
      disabled={loading}
      onClick={updateStatus}
      className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--studio-border)] px-3 text-[11.5px] font-semibold text-white transition-[background-color,border-color] duration-150 hover:border-[var(--studio-border-strong)] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 motion-reduce:transition-none"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        : suspended ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          : <ShieldBan className="h-3.5 w-3.5" aria-hidden="true" />}
      {t(suspended ? 'reactivate' : 'suspend')}
    </button>
    {error && <p role="alert" className="max-w-48 text-[10.5px] leading-relaxed text-red-200">{error}</p>}
  </div>;
}
