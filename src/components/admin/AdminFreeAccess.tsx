'use client';

import { useState } from 'react';
import type { FreeEligibilityState } from '@/lib/access/trial-state';

export type FreeAccessDetail = {
  state: FreeEligibilityState;
  reason_code: string | null;
  evidence: { signal?: string; matching_accounts?: number; reason?: string; signals?: Record<string, boolean> };
  updated_at: string | null;
  updated_by: string | null;
  riskSummary?: { linked_accounts: number; shared_installations: number; shared_browser_keys: number } | null;
};

const labels: Record<FreeEligibilityState, string> = {
  eligible: 'Eligible', review_required: 'Review required',
  ineligible: 'Ineligible', manually_approved: 'Manually approved',
};

const signalLabels = {
  repeated_email_alias: 'Repeated account email alias',
  shared_vantra_device: 'VANTRA installation previously used for Free access',
  shared_trusted_browser_key: 'Trusted browser key previously used for Free access',
} as const;

function riskReasons(detail: FreeAccessDetail) {
  const recorded = Object.entries(signalLabels)
    .filter(([code]) => detail.evidence.signals?.[code] === true)
    .map(([, label]) => label);
  const legacy = detail.reason_code && detail.reason_code in signalLabels
    ? signalLabels[detail.reason_code as keyof typeof signalLabels] : null;
  const reasons = [detail.evidence.reason, ...recorded, ...(recorded.length ? [] : legacy ? [legacy] : [])]
    .filter((item): item is string => Boolean(item));
  return [...new Set(reasons)].join(' · ') || 'No review reason recorded.';
}

export default function AdminFreeAccess({ userId, detail, onChanged }: {
  userId: string;
  detail: FreeAccessDetail | null | undefined;
  onChanged: (next: FreeAccessDetail) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const change = async (state: FreeEligibilityState, action: string) => {
    if (busy || !window.confirm(`${action} for this user?`)) return;
    const reason = window.prompt('Reason for the audit record (required):')?.trim();
    if (!reason) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/free-access`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state, reason }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'FREE_ACCESS_CHANGE_FAILED');
      onChanged(body.detail as FreeAccessDetail);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'FREE_ACCESS_CHANGE_FAILED');
    } finally { setBusy(false); }
  };
  const button = (state: FreeEligibilityState, label: string) => <button key={state} type="button"
    disabled={busy || detail?.state === state} onClick={() => void change(state, label)}
    className="min-h-9 rounded-lg border border-[var(--studio-border)] px-3 text-[11px] font-medium text-white hover:bg-white/[0.06] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">{label}</button>;
  return <section className="rounded-xl border border-[var(--studio-border)] bg-white/[0.025] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-[12px] font-semibold">Free Access</h3><p className="mt-1 text-[11px] text-[var(--studio-text-muted)]">Controls Free execution only. Paid access remains available.</p></div><strong className="text-[11px]">{detail ? labels[detail.state] : 'Unavailable'}</strong></div>
    {detail && <><p className="mt-3 text-[11px] text-[var(--studio-text-secondary)]">{riskReasons(detail)}{detail.updated_at ? ` · ${new Date(detail.updated_at).toLocaleString('en')}` : ''}</p>
      {detail.riskSummary && detail.riskSummary.linked_accounts > 0 && <p className="mt-1 text-[11px] text-[var(--studio-text-muted)]">{detail.riskSummary.linked_accounts} linked account{detail.riskSummary.linked_accounts === 1 ? '' : 's'} · {detail.riskSummary.shared_installations} shared installation{detail.riskSummary.shared_installations === 1 ? '' : 's'} · {detail.riskSummary.shared_browser_keys} shared browser key{detail.riskSummary.shared_browser_keys === 1 ? '' : 's'}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{button('manually_approved', 'Approve Free Access')}{button('eligible', 'Restore Free Eligibility')}{button('ineligible', 'Mark Free Access Ineligible')}{button('review_required', 'Send to Review')}</div>
      <p className="mt-2 text-[10px] text-[var(--studio-text-muted)]">Restoring access never refills consumed Free images or videos.</p></>}
    {error && <p role="alert" className="mt-2 text-[11px] text-red-200">{error}</p>}
  </section>;
}
