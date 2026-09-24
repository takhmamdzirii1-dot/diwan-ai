'use client';

import { useEffect, useState } from 'react';
import { Filter } from 'lucide-react';

type FunnelRow = { event: string; count: number; users: number };

const GROUPS: { title: string; steps: string[] }[] = [
  {
    title: 'Acquisition',
    steps: ['trial_started', 'paywall_shown', 'checkout_started', 'payment_submitted', 'payment_approved'],
  },
  {
    title: 'Renewal',
    steps: ['renewal_reminder_shown', 'renewal_started', 'renewal_completed', 'renewal_failed'],
  },
  {
    title: 'Reactivation',
    steps: ['reactivation_started', 'reactivation_completed', 'reactivation_failed'],
  },
  {
    title: 'Models & offers',
    steps: ['model_locked_clicked', 'model_trial_used', 'model_trial_exhausted', 'media_upgrade_prompt_shown', 'pro_accepted', 'lite_shown', 'lite_accepted'],
  },
];

const label = (event: string) =>
  event.split('_').map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part)).join(' ');

/**
 * Compact operational funnel from real user_funnel audit rows. Raw counts
 * and distinct users only — no conversion rates, so missing denominators
 * can never mislead. Acquisition vs renewal/reactivation split by event.
 */
export default function AdminFunnelCard() {
  const [range, setRange] = useState<'7d' | '30d'>('7d');
  const [rows, setRows] = useState<FunnelRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setRows(null);
    setFailed(false);
    fetch(`/api/admin/funnel?range=${range}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json().catch(() => null) : null))
      .then((body) => {
        if (!live) return;
        if (!body || !Array.isArray(body.events)) setFailed(true);
        else setRows(body.events);
      })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [range]);

  const counts = new Map((rows ?? []).map((row) => [row.event, row]));

  return (
    <section aria-label="Conversion funnel" className="mt-6 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-white">Conversion funnel</h2>
          <p className="mt-0.5 text-[11px] text-[var(--studio-text-secondary)]">Real recorded events · counts and users, no modeled rates</p>
        </div>
        <div role="group" aria-label="Funnel range" className="flex items-center gap-1 rounded-lg border border-[var(--studio-border)] p-0.5">
          <Filter className="ms-1.5 h-3.5 w-3.5 text-[var(--studio-text-muted)]" aria-hidden="true" />
          {(['7d', '30d'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => setRange(value)}
              className={range === value
                ? 'h-7 rounded-md bg-white px-2.5 text-[11px] font-semibold text-black'
                : 'h-7 rounded-md px-2.5 text-[11px] text-[var(--studio-text-secondary)] hover:text-white'}
            >
              {value === '7d' ? '7 days' : '30 days'}
            </button>
          ))}
        </div>
      </div>
      {failed ? (
        <p role="status" className="py-6 text-center text-[12px] text-[var(--studio-text-secondary)]">Funnel data is unavailable right now.</p>
      ) : !rows ? (
        <div className="grid gap-2 py-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading funnel">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-xl border border-[var(--studio-border)] bg-white/[0.02] motion-reduce:animate-none" />)}
        </div>
      ) : (
        <div className="mt-3 grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {GROUPS.map((group) => (
            <div key={group.title} className="rounded-xl border border-[var(--studio-border-subtle)] bg-black/20 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--studio-text-muted)]">{group.title}</h3>
              <ol className="mt-2 divide-y divide-[var(--studio-border-subtle)]">
                {group.steps.map((step) => {
                  const row = counts.get(step);
                  return (
                    <li key={step} className="flex items-baseline justify-between gap-2 py-1.5 text-[12px]">
                      <span className="min-w-0 truncate text-[var(--studio-text-secondary)]">{label(step)}</span>
                      <span className="shrink-0 tabular-nums text-white">
                        {(row?.count ?? 0).toLocaleString()}
                        <span className="ms-1.5 font-normal text-[var(--studio-text-muted)]">{(row?.users ?? 0).toLocaleString()} users</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
