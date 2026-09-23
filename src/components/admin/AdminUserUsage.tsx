'use client';

import { useEffect, useState } from 'react';
import type { UsageRange } from '@/lib/admin/user-usage';

type Usage = {
  range: UsageRange;
  plan: { name: string; status: string; startsAt: string | null; endsAt: string | null; rollover: string | null; previousPaid: string | null };
  chat: { fiveHourUsed: number; fiveHourLimit: number | null; fiveHourRemaining: number | null; nextFiveHourAt: string | null;
    weeklyUsed: number; weeklyLimit: number | null; weeklyRemaining: number | null; nextWeeklyAt: string | null;
    activeReservations: number; requests: number; breakdown: { model: string; requests: number; weightedUsage: number }[] };
  media: { modality: 'image' | 'video'; successful: number; failed: number; credits: string | null;
    breakdown: { model: string; successful: number; failed: number; credits: string | null }[] }[];
  allowances: { freeMediaEndsAt: string; freeImageRemaining: number | null; freeVideoRemaining: number | null; liteVideoTotal: number | null; liteVideoRemaining: number | null };
  credits: { subscriptionBalance: string | null; purchasedBalance: string | null; rolloverBalance: string | null;
    subscriptionConsumedCycle: string | null; purchasedConsumed: string | null;
    ledger: { id: string; type: string; amount: string; reason: string; createdAt: string }[] };
  trials: { model: string; plan: string; scope: string | null; allowance: number | null; used: number; remaining: number | null; exhausted: boolean }[];
  jobs: { id: string; createdAt: string; modality: string; model: string; provider: string | null; status: string;
    charge: string | null; providerCost: { minor: string; currency: string } | null }[];
};

const panel = 'rounded-xl border border-[var(--studio-border)] bg-[var(--studio-card)] p-4';
const muted = 'text-[var(--studio-text-secondary)]';
const dash = '—';
const show = (value: number | string | null | undefined) => value ?? dash;
const date = (value: string | null) => value ? new Date(value).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }) : dash;
function stat(label: string, value: number | string | null | undefined, note?: string) {
  return <div className="rounded-lg border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] px-3 py-3">
    <p className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${muted}`}>{label}</p>
    <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--studio-text-primary)]">{show(value)}</p>
    {note && <p className={`mt-0.5 text-[10px] ${muted}`}>{note}</p>}
  </div>;
}
function section(title: string, children: React.ReactNode) {
  return <section className={panel}><h3 className="mb-3 text-[13px] font-semibold text-[var(--studio-text-primary)]">{title}</h3>{children}</section>;
}
function lines(items: React.ReactNode[], empty: string) {
  return items.length ? <div className="divide-y divide-[var(--studio-border-subtle)]">{items}</div>
    : <p className={`rounded-lg border border-dashed border-[var(--studio-border)] px-3 py-5 text-center text-[11px] ${muted}`}>{empty}</p>;
}
function cost(value: Usage['jobs'][number]['providerCost']) {
  if (!value) return dash;
  const minor = Number(value.minor);
  if (!Number.isSafeInteger(minor)) return dash;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: value.currency }).format(minor / 100);
}

export default function AdminUserUsage({ userId }: { userId: string }) {
  const [range, setRange] = useState<UsageRange>('cycle');
  const [data, setData] = useState<Usage | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(false);
    fetch(`/api/admin/users/${userId}/usage?range=${range}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error('USAGE_UNAVAILABLE'); return response.json() as Promise<Usage>; })
      .then(setData).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [userId, range]);
  return <div className="space-y-4 py-5 text-start text-[12px]">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-[15px] font-semibold">Usage</h3><p className={`mt-1 text-[11px] ${muted}`}>Recorded usage and current capacity for this user.</p></div>
      <label className={`flex items-center gap-2 text-[11px] ${muted}`}>Activity range
        <select aria-label="Usage range" value={range} onChange={(event) => setRange(event.target.value as UsageRange)} className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-2 text-[var(--studio-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--studio-border-strong)]">
          <option value="cycle">Current cycle</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All time</option>
        </select>
      </label>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-300/20 bg-red-300/5 p-4 text-red-200">Usage could not be loaded. Try another range or reopen this user.</div>}
    {!data && !error && <div role="status" className={`${panel} ${muted}`}>Loading usage…</div>}
    {data && <>
      {section('Plan', <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {stat('Current plan', data.plan.name)}{stat('Status', data.plan.status)}{stat('Starts', date(data.plan.startsAt))}{stat('Ends', date(data.plan.endsAt))}
        {data.plan.rollover !== null && stat('Rollover', data.plan.rollover)}
        {data.plan.previousPaid && stat('Previous paid plan', data.plan.previousPaid)}
      </div>)}
      {section('Chat', <>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {stat('Rolling 5h used', data.chat.fiveHourUsed, `Limit ${show(data.chat.fiveHourLimit)} · Remaining ${show(data.chat.fiveHourRemaining)}`)}
          {stat('Rolling 7d used', data.chat.weeklyUsed, `Limit ${show(data.chat.weeklyLimit)} · Remaining ${show(data.chat.weeklyRemaining)}`)}
          {stat('Requests in range', data.chat.requests)}{stat('Live reservations', data.chat.activeReservations)}
        </div>
        {(data.chat.nextFiveHourAt || data.chat.nextWeeklyAt) && <p className={`mt-3 text-[11px] ${muted}`}>Next weighted unit available: 5h {date(data.chat.nextFiveHourAt)} · 7d {date(data.chat.nextWeeklyAt)}</p>}
        <h4 className="mb-2 mt-4 text-[11px] font-semibold">By model</h4>
        {lines(data.chat.breakdown.map((row) => <div key={row.model} className="flex justify-between gap-3 py-2"><span className="min-w-0 truncate">{row.model}</span><span className="shrink-0 tabular-nums">{row.requests} requests · {row.weightedUsage} units</span></div>), 'No completed Chat requests in this range.')}
      </>)}
      {data.media.map((item) => section(item.modality === 'image' ? 'Image' : 'Video', <div key={item.modality}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {stat('Successful', item.successful)}{stat('Failed', item.failed)}{stat('Credits consumed', item.credits)}
          {data.plan.name === 'free' && stat('Free used / remaining', (() => {
            const total = item.modality === 'image' ? 5 : 1;
            const remaining = item.modality === 'image' ? data.allowances.freeImageRemaining : data.allowances.freeVideoRemaining;
            return remaining == null ? null : `${total - remaining} / ${remaining}`;
          })(), Date.parse(data.allowances.freeMediaEndsAt) <= Date.now() ? `Unused allowance expired ${date(data.allowances.freeMediaEndsAt)}` : `One-time allowance ends ${date(data.allowances.freeMediaEndsAt)}`)}
          {item.modality === 'video' && data.plan.name === 'lite' && stat('Included Lite videos', data.allowances.liteVideoRemaining, `of ${show(data.allowances.liteVideoTotal)} this period`)}
        </div>
        <h4 className="mb-2 mt-4 text-[11px] font-semibold">By model</h4>
        {lines(item.breakdown.map((row) => <div key={row.model} className="flex justify-between gap-3 py-2"><span className="min-w-0 truncate">{row.model}</span><span className="shrink-0 tabular-nums">{row.successful} successful · {row.failed} failed · {show(row.credits)} credits</span></div>), `No ${item.modality} jobs in this range.`)}
      </div>))}
      {section('Credits', <>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{stat('Subscription balance', data.credits.subscriptionBalance)}{stat('Purchased balance', data.credits.purchasedBalance)}
          {stat('Consumed this cycle', data.credits.subscriptionConsumedCycle, 'Subscription credits')}{stat('Purchased consumed', data.credits.purchasedConsumed, 'In selected range')}{stat('Rollover balance', data.credits.rolloverBalance)}</div>
        <h4 className="mb-2 mt-4 text-[11px] font-semibold">Recent ledger</h4>
        {lines(data.credits.ledger.map((row) => <div key={row.id} className="flex justify-between gap-3 py-2"><span className="min-w-0"><strong>{row.type}</strong><span className={`ms-2 ${muted}`}>{row.reason}</span></span><span className="shrink-0 text-end tabular-nums">{row.amount}<span className={`block text-[10px] ${muted}`}>{date(row.createdAt)}</span></span></div>), 'No ledger entries in this range.')}
      </>)}
      {section('Model trials', lines(data.trials.map((trial) => <div key={`${trial.model}:${trial.scope}`} className="flex justify-between gap-3 py-2"><span className="min-w-0"><strong>{trial.model}</strong><span className={`block text-[10px] ${muted}`}>{trial.plan} · {trial.scope ?? dash}</span></span><span className="shrink-0 text-end tabular-nums">{trial.used} / {show(trial.allowance)} used<span className={`block text-[10px] ${muted}`}>{trial.exhausted ? 'Exhausted or unconfigured' : `${show(trial.remaining)} remaining`}</span></span></div>), 'No Trial model access configured for this plan.'))}
      {section('Recent jobs', lines(data.jobs.map((job) => <div key={job.id} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><strong className="truncate">{job.model}</strong><span className={`ms-2 ${muted}`}>{job.modality} · {job.status}</span><p className={`text-[10px] ${muted}`}>{job.provider ?? dash} · {date(job.createdAt)}</p></div><div className="tabular-nums sm:text-end">{show(job.charge)} credits<span className={`block text-[10px] ${muted}`}>Provider cost {cost(job.providerCost)}</span></div></div>), 'No jobs in this range.'))}
    </>}
  </div>;
}
