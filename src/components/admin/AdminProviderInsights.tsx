'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CircleAlert } from 'lucide-react';
import type { AdminProviderRow, CostAmount } from '@/lib/admin/types';

const card = 'rounded-xl border border-[var(--studio-border)] bg-[var(--studio-card)]';
const heading = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-secondary)]';
const dash = '—';

export function providerMoney(value: CostAmount | null): string {
  if (!value || !/^\d+$/.test(value.minor)) return dash;
  const minor = BigInt(value.minor);
  const decimal = `${minor / 100n}.${String(minor % 100n).padStart(2, '0')}`;
  return value.currency.toUpperCase() === 'USD' ? `$${decimal}` : `${decimal} ${value.currency}`;
}

function date(value: string | null): string {
  return value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : dash;
}

function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const colors = {
    neutral: 'border-[var(--studio-border)] text-[var(--studio-text-secondary)]',
    good: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
    warn: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
    bad: 'border-red-400/25 bg-red-400/10 text-red-200',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${colors[tone]}`}>{children}</span>;
}

function Metric({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return <div className={`${card} min-w-0 p-3.5`}>
    <p className={heading}>{label}</p>
    <p className="mt-2 truncate text-[21px] font-semibold tabular-nums tracking-tight text-[var(--studio-text-primary)]">{value}</p>
    {note && <p className="mt-1 text-[10px] text-[var(--studio-text-muted)]">{note}</p>}
  </div>;
}

function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[42%_1fr] gap-3 border-b border-[var(--studio-border-subtle)] py-2.5 text-[12px] last:border-0">
    <span className="text-[var(--studio-text-secondary)]">{name}</span>
    <span className="min-w-0 break-words font-medium text-[var(--studio-text-primary)]">{children}</span>
  </div>;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className={`${card} p-4`}>
    <h3 className="text-[13px] font-semibold text-[var(--studio-text-primary)]">{title}</h3>
    {description && <p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]">{description}</p>}
    <div className="mt-3">{children}</div>
  </section>;
}

function providerState(row: AdminProviderRow) {
  if (row.archived || !row.enabled || row.emergencyDisabled) return <Chip>Disabled</Chip>;
  if (row.status === 'misconfigured') return <Chip tone="warn">Misconfigured</Chip>;
  if (row.status === 'unavailable') return <Chip tone="bad">Unavailable</Chip>;
  return <Chip tone="good">Ready</Chip>;
}

export function ProviderOverview({ row }: { row: AdminProviderRow }) {
  const rate = row.metricsComplete && row.terminalAttempts > 0
    ? `${(row.successfulAttempts / row.terminalAttempts * 100).toFixed(1)}%` : row.requestCount === 0 ? 'No traffic' : dash;
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div>{providerState(row)}<p className="mt-1.5 text-[11px] text-[var(--studio-text-secondary)]">{row.status === 'ready' ? 'Configured for routing.' : 'See runtime state and diagnostics below.'}</p></div>
      <Link href="/admin/runtime" className="text-[11px] text-[var(--studio-text-secondary)] underline hover:text-[var(--studio-text-primary)]">Manage runtime <ArrowUpRight className="inline h-3 w-3" /></Link>
    </div>
    <Section title="Provider">
      <Row name="Status">{providerState(row)}</Row>
      <Row name="Adapter">{row.adapterType}</Row>
      <Row name="Credential">{row.configured ? <Chip tone="good">Configured</Chip> : <Chip tone="warn">Missing</Chip>}</Row>
      <Row name="Capabilities">{row.modalities.join(' · ') || dash}</Row>
    </Section>
    <Section title="Activity · Recorded attempts">
      <Row name="Requests">{row.metricsComplete ? row.requestCount.toLocaleString() : `At least ${row.requestCount.toLocaleString()}`}</Row>
      <Row name="Successful">{row.metricsComplete ? row.successfulAttempts.toLocaleString() : dash}</Row>
      <Row name="Failed">{row.metricsComplete ? row.failures.toLocaleString() : dash}</Row>
      <Row name="Success rate">{rate}</Row>
      <Row name="Last activity">{date(row.lastActivityAt)}</Row>
    </Section>
    <Section title="Dependencies">
      <Row name="Connected models">{new Set(row.associatedModels.map((route) => route.key)).size}</Row>
      <Row name="Connected routes">{row.routeCount}</Row>
    </Section>
    <Section title="Runtime snapshot">
      <Row name="Routing">{row.enabled && !row.emergencyDisabled ? <Chip tone="good">Enabled</Chip> : <Chip>Disabled</Chip>}</Row>
      <Row name="Emergency stop">{row.emergencyDisabled ? <Chip tone="bad">On</Chip> : <Chip>Off</Chip>}</Row>
      <Row name="Priority">{row.priority}</Row>
      <Row name="Daily limit">{row.dailySpendLimitMinor && row.spendCurrency ? `${providerMoney({ minor: row.dailySpendLimitMinor, currency: row.spendCurrency })} / day` : 'No configured limit'}</Row>
    </Section>
    <details className={`${card} p-3 text-[11px] text-[var(--studio-text-secondary)]`}>
      <summary className="cursor-pointer">Technical details</summary>
      <p className="mt-2 break-all">Provider ID: {row.id}</p>
      {row.baseEndpoint && <p className="mt-1 break-all">Endpoint: {row.baseEndpoint}</p>}
    </details>
  </div>;
}

export function ProviderRoutes({ row }: { row: AdminProviderRow }) {
  const routes = [...row.associatedModels].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  return <div className="space-y-4">
    <div><h3 className="text-[15px] font-semibold">Connected Models</h3><p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]">Real model routes configured for this provider.</p></div>
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full min-w-[520px] text-left text-[11px]">
        <thead className="border-b border-[var(--studio-border)] text-[9px] uppercase tracking-wider text-[var(--studio-text-secondary)]"><tr><th className="px-3 py-3">VANTRA model</th><th>Backend</th><th>Route</th><th>Status</th></tr></thead>
        <tbody>{routes.map((route) => <tr key={route.routeId} className="border-b border-[var(--studio-border-subtle)] last:border-0"><td className="px-3 py-2.5"><p className="font-semibold">{route.name}</p><p className="capitalize text-[var(--studio-text-muted)]">{route.modality}</p></td><td className="max-w-[130px] truncate" title={route.providerModelId}>{route.providerModelId}</td><td>{route.fallback ? 'Fallback' : 'Primary'} · {route.priority}</td><td>{route.enabled ? <Chip tone="good">Active</Chip> : <Chip>Disabled</Chip>}</td></tr>)}</tbody>
      </table>
      {!routes.length && <p className="px-4 py-10 text-center text-[12px] text-[var(--studio-text-secondary)]">No model routes are connected.</p>}
    </div>
    <Section title="Routes" description="Routing role and state are stored per model route.">
      <Row name="Primary routes">{routes.filter((route) => !route.fallback).length}</Row>
      <Row name="Fallback-marked routes">{routes.filter((route) => route.fallback).length}</Row>
      <Row name="Enabled routes">{routes.filter((route) => route.enabled).length}</Row>
    </Section>
    <p className="text-[11px] text-[var(--studio-text-secondary)]">A fallback-marked route does not mean automatic fallback policy is enabled.</p>
    <Link href="/admin/models" className="block rounded-lg border border-[var(--studio-border)] px-3 py-2.5 text-[12px] hover:bg-[var(--studio-hover)]">Open Models & Routes <ArrowUpRight className="float-right h-3.5 w-3.5" /></Link>
  </div>;
}

function BarChart({ label, days, mode }: { label: string; days: AdminProviderRow['dailyUsage']; mode: 'attempts' | 'spend' }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(true);
  const [showFailures, setShowFailures] = useState(true);
  const values = days.map((day) => mode === 'attempts'
    ? (showSuccess ? day.successful : 0) + (showFailures ? day.failed : 0) + day.other
    : Number(day.spendUsdMinor ?? 0));
  const max = Math.max(1, ...values);
  const available = mode === 'attempts' || days.some((day) => day.spendUsdMinor !== null);
  return <section className={`${card} p-4`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[13px] font-semibold">{label}</h3><p className="text-[10px] text-[var(--studio-text-muted)]">Daily · UTC</p></div>
    {available ? <>
      <div className="relative mt-4 flex h-40 items-end gap-[2px] border-b border-[var(--studio-border)] bg-[linear-gradient(to_top,var(--studio-border-subtle)_1px,transparent_1px)] bg-[length:100%_25%]">
        {days.map((day, index) => {
          const successful = mode === 'attempts' && showSuccess ? day.successful : 0;
          const failed = mode === 'attempts' && showFailures ? day.failed : 0;
          const other = mode === 'attempts' ? day.other : 0;
          const spend = mode === 'spend' ? Number(day.spendUsdMinor ?? 0) : 0;
          const total = mode === 'attempts' ? successful + failed + other : spend;
          const height = total ? Math.max(3, total / max * 100) : 0;
          const tooltip = mode === 'attempts' ? `${day.date}: ${day.successful} successful, ${day.failed} failed, ${day.other} other` : day.spendUsdMinor === null ? `${day.date}: no recorded USD cost` : `${day.date}: ${providerMoney({ currency: 'USD', minor: day.spendUsdMinor })} recorded`;
          return <button key={day.date} type="button" title={tooltip} aria-label={tooltip} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(index)} onBlur={() => setHover(null)} className="relative flex min-w-0 flex-1 flex-col justify-end outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]" style={{ height: `${height}%` }}>
            {mode === 'attempts' ? <><span className="w-full bg-[var(--studio-text-muted)]" style={{ height: total ? `${other / total * 100}%` : 0 }} /><span className="w-full bg-red-400" style={{ height: total ? `${failed / total * 100}%` : 0 }} /><span className="w-full flex-1 bg-emerald-400" /></> : <span className="h-full w-full bg-[var(--studio-accent)]" />}
            {hover === index && <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-2 py-1 text-[10px] text-[var(--studio-text-primary)] shadow-lg">{tooltip}</span>}
          </button>;
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-[var(--studio-text-muted)]"><span>{days[0]?.date ?? dash}</span><span>{days.at(-1)?.date ?? dash}</span></div>
      {mode === 'attempts' ? <div className="mt-3 flex gap-3 text-[11px]"><button type="button" aria-pressed={showSuccess} onClick={() => setShowSuccess((value) => !value)} className={showSuccess ? 'text-emerald-300' : 'text-[var(--studio-text-muted)]'}>● Successful</button><button type="button" aria-pressed={showFailures} onClick={() => setShowFailures((value) => !value)} className={showFailures ? 'text-red-300' : 'text-[var(--studio-text-muted)]'}>● Failed</button></div> : <p className="mt-3 text-[10px] text-[var(--studio-text-muted)]">Recorded provider cost in USD</p>}
    </> : <div className="mt-4 flex h-40 items-center justify-center rounded-lg border border-dashed border-[var(--studio-border)] text-center text-[12px] text-[var(--studio-text-secondary)]">No USD cost records available for this chart.</div>}
  </section>;
}

export function ProviderUsage({ row }: { row: AdminProviderRow }) {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const days = useMemo(() => row.dailyUsage.slice(-range), [row.dailyUsage, range]);
  const counts = days.reduce((sum, day) => ({ successful: sum.successful + day.successful, failed: sum.failed + day.failed, other: sum.other + day.other }), { successful: 0, failed: 0, other: 0 });
  const terminal = counts.successful + counts.failed;
  const knownSpend = days.some((day) => day.spendUsdMinor !== null);
  const spend = knownSpend ? providerMoney({ currency: 'USD', minor: days.reduce((sum, day) => sum + BigInt(day.spendUsdMinor ?? '0'), 0n).toString() }) : dash;
  const rate = row.metricsComplete && terminal > 0 ? `${(counts.successful / terminal * 100).toFixed(1)}%` : terminal === 0 && counts.other === 0 ? 'No traffic' : dash;
  return <div className="space-y-4">
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-[15px] font-semibold">Usage Overview</h3><p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]">Provider attempts and settled cost records.</p></div><select aria-label="Usage range" value={range} onChange={(event) => setRange(Number(event.target.value) as 7 | 30 | 90)} className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-2 text-[11px]"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></div>
    {!row.metricsComplete && <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] text-amber-200">The source record limit was reached. Totals and rates may be incomplete; charts show the loaded records only.</div>}
    <div className="grid grid-cols-2 gap-2"><Metric label="Requests" value={row.metricsComplete ? counts.successful + counts.failed + counts.other : dash} note={`${range}-day recorded attempts`} /><Metric label="Successful" value={row.metricsComplete ? counts.successful : dash} /><Metric label="Failed" value={row.metricsComplete ? counts.failed : dash} /><Metric label="Success rate" value={rate} note="Completed ÷ terminal attempts" /></div>
    <BarChart label="Daily Usage" days={days} mode="attempts" />
    <Section title="VANTRA Spend" description="Actual provider cost where a settled cost record exists."><p className="text-[23px] font-semibold tabular-nums">{row.metricsComplete ? spend : dash}</p><p className="mt-1 text-[10px] text-[var(--studio-text-muted)]">{range}-day recorded USD spend</p><BarChart label="Daily Spend" days={days} mode="spend" /></Section>
    <div><h3 className="mb-2 text-[13px] font-semibold">Cost by Model</h3><div className={`${card} overflow-x-auto`}><table className="w-full min-w-[450px] text-left text-[11px]"><thead className="border-b border-[var(--studio-border)] text-[9px] uppercase text-[var(--studio-text-secondary)]"><tr><th className="px-3 py-3">Backend model</th><th>Settled records</th><th>Recorded spend</th></tr></thead><tbody>{row.costByModel.map((model) => <tr key={`${model.providerModelId}:${model.cost.currency}`} className="border-b border-[var(--studio-border-subtle)] last:border-0"><td className="px-3 py-2.5"><p className="font-medium">{model.name}</p><p className="truncate text-[var(--studio-text-muted)]">{model.providerModelId}</p></td><td>{model.records}</td><td>{providerMoney(model.cost)}</td></tr>)}</tbody></table>{!row.costByModel.length && <div className="px-4 py-8 text-center text-[11px] text-[var(--studio-text-secondary)]">No settled cost by model is recorded yet.</div>}</div><p className="mt-2 text-[10px] text-[var(--studio-text-muted)]">Model breakdown covers loaded historical records; the chart range applies to daily totals.</p></div>
    <Link href={`/admin/jobs?provider=${encodeURIComponent(row.id)}`} className="block rounded-lg border border-[var(--studio-border)] px-3 py-2.5 text-[12px] hover:bg-[var(--studio-hover)]">View jobs for this provider <ArrowUpRight className="float-right h-3.5 w-3.5" /></Link>
  </div>;
}

export function ProviderDiagnostics({ row }: { row: AdminProviderRow }) {
  return <div className="space-y-4">
    <Section title="Health & Status">
      <Row name="Provider status">{providerState(row)}</Row>
      <Row name="Adapter">{row.adapterType}</Row>
      <Row name="Credential">{row.configured ? <Chip tone="good">Configured</Chip> : <Chip tone="warn">Missing</Chip>}</Row>
      <Row name="Last successful request">{date(row.lastSuccessAt)}</Row>
      <Row name="Last failure">{date(row.lastFailureAt)}</Row>
    </Section>
    <div><div className="mb-2 flex items-center gap-2"><CircleAlert className="h-4 w-4 text-[var(--studio-text-secondary)]" /><h3 className="text-[13px] font-semibold">Recent Issues</h3></div><div className={`${card} divide-y divide-[var(--studio-border-subtle)]`}>{row.recentIssues.length ? row.recentIssues.map((issue, index) => <div key={`${issue.at}:${index}`} className="grid grid-cols-[95px_1fr] gap-3 px-3 py-3 text-[11px]"><span className="text-[var(--studio-text-muted)]">{date(issue.at)}</span><span className="break-words text-red-200">{issue.message}</span></div>) : <p className="p-5 text-center text-[11px] text-[var(--studio-text-secondary)]">No failed provider attempts in the loaded records.</p>}</div></div>
    <Section title="Recorded Checks" description="Configuration and runtime state only; no synthetic connectivity checks.">
      <Row name="Credential configuration">{row.configured ? <Chip tone="good">Present</Chip> : <Chip tone="warn">Missing</Chip>}</Row>
      <Row name="Routing configuration">{row.enabled ? <Chip tone="good">Enabled</Chip> : <Chip>Disabled</Chip>}</Row>
      <Row name="Connection test">{row.testSupported ? 'Available in provider controls' : 'Not supported by this adapter'}</Row>
    </Section>
    {row.lastError && <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-[11px] text-red-200">Last recorded error: {row.lastError}</div>}
    <details className={`${card} p-3 text-[11px] text-[var(--studio-text-secondary)]`}><summary className="cursor-pointer">Technical details</summary><p className="mt-2 break-all">Provider ID: {row.id}</p><p className="mt-1">Average finished attempt latency: {row.averageLatencyMs == null ? dash : `${row.averageLatencyMs} ms`}</p></details>
  </div>;
}

export function ProviderSafetySummary({ rows }: { rows: AdminProviderRow[] }) {
  const active = rows.filter((row) => row.enabled && !row.emergencyDisabled && !row.archived).length;
  const limited = rows.filter((row) => row.dailySpendLimitMinor != null).length;
  const stopped = rows.filter((row) => row.emergencyDisabled).length;
  const fallbackMarked = rows.filter((row) => row.associatedModels.some((route) => route.enabled && route.fallback)).length;
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <Metric label="Active providers" value={active} note={`of ${rows.length} configured`} />
    <Metric label="Providers with limits" value={limited} note="Daily spend guard configured" />
    <Metric label="Emergency stops" value={stopped} note={stopped ? 'Routing blocked for these providers' : 'No emergency stop active'} />
    <Metric label="Fallback-marked routes" value={fallbackMarked} note="Route flag only; no automatic policy" />
  </div>;
}

function auditValue(key: string, value: unknown, currency: string | null): string {
  if (value == null) return 'None';
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (key === 'daily_spend_limit_minor' && currency && /^\d+$/.test(String(value))) {
    return providerMoney({ minor: String(value), currency });
  }
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return dash;
}

export function ProviderRuntimeHistory({ row }: { row: AdminProviderRow }) {
  return <div className="space-y-3">
    <div><h3 className="text-[15px] font-semibold">Runtime History</h3><p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]">Recorded owner changes from the immutable Admin audit log.</p></div>
    {row.history.length ? row.history.map((event) => {
      const before = event.previousState ?? {};
      const after = event.newState ?? {};
      const changes = [...new Set([...Object.keys(before), ...Object.keys(after)])]
        .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
      const currency = typeof after.spend_currency === 'string' ? after.spend_currency
        : typeof before.spend_currency === 'string' ? before.spend_currency : null;
      return <section key={event.id} className={`${card} p-4`}>
        <div className="flex items-center justify-between gap-2"><p className="text-[12px] font-semibold">{event.action.replaceAll('_', ' ')}</p><time className="text-[10px] text-[var(--studio-text-muted)]" dateTime={event.at}>{date(event.at)}</time></div>
        <div className="mt-2 divide-y divide-[var(--studio-border-subtle)]">{changes.length ? changes.map((key) => <Row key={key} name={key.replaceAll('_', ' ')}>{auditValue(key, before[key], currency)} → {auditValue(key, after[key], currency)}</Row>) : <p className="py-2 text-[11px] text-[var(--studio-text-secondary)]">Creation or metadata update recorded.</p>}</div>
      </section>;
    }) : <div className={`${card} p-8 text-center text-[12px] text-[var(--studio-text-secondary)]`}>No provider runtime changes are recorded in the loaded audit history.</div>}
    <Link href="/admin/audit" className="block text-[11px] text-[var(--studio-text-secondary)] underline">Open full Audit Log</Link>
  </div>;
}

export function ProviderFallbackPanel({ row }: { row: AdminProviderRow }) {
  const marked = row.associatedModels.filter((route) => route.fallback);
  return <div className="space-y-4">
    <Section title="Fallback Role" description="Automatic fallback routing is not configured.">
      <Row name="Policy status"><Chip>Not configured</Chip></Row>
      <Row name="Fallback-marked routes">{marked.length}</Row>
      <Row name="Automatic failover"><Chip>Disabled</Chip></Row>
    </Section>
    <div className={`${card} p-4`}><h3 className="text-[13px] font-semibold">Route markers</h3><p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]">These are stored route flags, not an active fallback policy.</p><div className="mt-3 divide-y divide-[var(--studio-border-subtle)]">{marked.length ? marked.map((route) => <Row key={route.routeId} name={route.name}>{route.enabled ? 'Enabled route marker' : 'Disabled route marker'}</Row>) : <p className="py-4 text-center text-[11px] text-[var(--studio-text-secondary)]">No fallback-marked routes for this provider.</p>}</div></div>
  </div>;
}
