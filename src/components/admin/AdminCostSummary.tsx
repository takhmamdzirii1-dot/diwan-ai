'use client';

import { useEffect, useState } from 'react';

type Group = { name: string; currency: string; minor: string; records: number };
type Summary = { groups: { plan: Group[]; model: Group[]; provider: Group[] };
  percentiles: { p50: string; p90: string; p99: string } | null;
  recordedJobs: number; truncated: boolean };

export default function AdminCostSummary() {
  const [data, setData] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/overview/cogs', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((body: Summary) => setData(body))
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  const list = (name: string, rows: Group[]) => <div><h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--studio-text-muted)]">{name}</h3>
    {rows.slice(0, 3).map((row) => <div key={`${row.currency}:${row.name}`} className="mt-2 flex justify-between gap-2 text-[11px]"><span className="truncate">{row.name}</span><span className="shrink-0 tabular-nums">{row.minor} minor {row.currency}</span></div>)}
    {!rows.length && <p className="mt-2 text-[11px] text-[var(--studio-text-muted)]">No recorded cost</p>}</div>;
  return <section className="mt-4 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-[14px] font-semibold">Recorded COGS · 7 days</h2><p className="mt-1 text-[11px] text-[var(--studio-text-muted)]">Actual settled provider costs only; unknown costs are excluded.</p></div><span className="text-[11px] text-[var(--studio-text-secondary)]">{data ? `${data.recordedJobs}${data.truncated ? '+' : ''} cost records` : failed ? 'Unavailable' : 'Loading…'}</span></div>
    {data && <><div className="mt-4 grid gap-4 md:grid-cols-3">{list('By plan', data.groups.plan)}{list('By model', data.groups.model)}{list('By provider', data.groups.provider)}</div>
      {data.percentiles && <p className="mt-4 border-t border-[var(--studio-border-subtle)] pt-3 text-[11px] text-[var(--studio-text-secondary)]">USD cost per recorded job: P50 {data.percentiles.p50} · P90 {data.percentiles.p90} · P99 {data.percentiles.p99} minor units</p>}
      {data.truncated && <p className="mt-2 text-[11px] text-[var(--studio-text-muted)]">Latest 1,000 records shown; totals are a sample.</p>}</>}
  </section>;
}
