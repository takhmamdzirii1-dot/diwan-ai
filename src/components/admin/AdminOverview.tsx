'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Box,
  CircleCheck,
  CircleX,
  CreditCard,
  FileText,
  RefreshCw,
  Search,
  Server,
  UserRound,
} from 'lucide-react';
import type { AdminActivity, AdminDataResult, AdminOverviewData } from '@/lib/admin/types';

const cardClass = 'rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)]';

function relativeTime(value: string, now: number) {
  const elapsed = Math.max(0, now - Date.parse(value));
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function IconFrame({ children }: { children: ReactNode }) {
  return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.055] text-white">{children}</span>;
}

function PrimaryCard({ href, icon, label, value, context, tone = 'neutral' }: {
  href: string; icon: ReactNode; label: string; value: string; context: string; tone?: 'neutral' | 'success' | 'danger';
}) {
  const contextTone = tone === 'success' ? 'text-emerald-300' : tone === 'danger' ? 'text-red-300' : 'text-[var(--studio-text-secondary)]';
  return <Link href={href} prefetch={false} className={`${cardClass} group px-4 py-3 transition-[background-color,border-color] duration-150 hover:border-[var(--studio-border-strong)] hover:bg-white/[0.035]`}>
    <div className="flex items-start gap-4">
      <IconFrame>{icon}</IconFrame>
      <div className="min-w-0 pt-1 text-start">
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--studio-text-secondary)]">{label}</p>
        <p className="mt-2 text-[30px] font-bold leading-none tracking-[-0.045em] text-white tabular-nums">{value}</p>
        <p className={`mt-3 text-[11.5px] leading-snug ${contextTone}`}>{context}</p>
      </div>
    </div>
  </Link>;
}

function SecondaryCard({ href, icon, label, value, context }: {
  href: string; icon: ReactNode; label: string; value: string; context: string;
}) {
  return <Link href={href} prefetch={false} className={`${cardClass} group flex items-center gap-4 px-4 py-2.5 transition-[background-color,border-color] duration-150 hover:border-[var(--studio-border-strong)] hover:bg-white/[0.035]`}>
    <IconFrame>{icon}</IconFrame>
    <div className="min-w-0 flex-1 text-start">
      <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--studio-text-secondary)]">{label}</p>
      <p className="mt-1.5 text-[22px] font-bold leading-none tracking-[-0.035em] text-white tabular-nums">{value}</p>
      <p className="mt-2 truncate text-[11.5px] text-[var(--studio-text-secondary)]">{context}</p>
    </div>
    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--studio-text-secondary)] transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
  </Link>;
}

function StatusPill({ status }: { status: string }) {
  const danger = ['failed', 'rejected', 'unavailable', 'misconfigured'].includes(status);
  const warning = ['pending', 'degraded'].includes(status);
  const success = ['approved', 'completed', 'ready'].includes(status);
  const classes = danger ? 'border-red-400/35 bg-red-400/[0.08] text-red-200'
    : warning ? 'border-amber-300/30 bg-amber-300/[0.07] text-amber-200'
      : success ? 'border-emerald-300/30 bg-emerald-300/[0.07] text-emerald-200'
        : 'border-white/15 bg-white/[0.04] text-[var(--studio-text-secondary)]';
  return <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 text-[10.5px] font-medium capitalize ${classes}`}>{status}</span>;
}

function ActivityIcon({ item }: { item: AdminActivity }) {
  const icon = item.kind === 'payment' || item.kind === 'subscription' || item.kind === 'credit' ? <FileText className="h-4 w-4" />
    : item.kind === 'generation' ? <CircleX className="h-4 w-4" />
      : item.kind === 'provider' ? <Server className="h-4 w-4" /> : <Box className="h-4 w-4" />;
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.055] text-white">{icon}</span>;
}

export default function AdminOverview({ result }: { result: AdminDataResult<AdminOverviewData> }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [now, setNow] = useState(() => Date.parse(result.data.generatedAt));
  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, [result.data.generatedAt]);

  const refresh = () => startRefresh(() => router.refresh());
  const data = result.data;
  const terminalJobs = data.successfulJobs7d == null || data.failedJobs7d == null
    ? null : data.successfulJobs7d + data.failedJobs7d;
  const successRate = terminalJobs == null ? null : terminalJobs === 0 ? '—' : `${((data.successfulJobs7d! / terminalJobs) * 100).toFixed(1)}%`;
  const failureRate = terminalJobs == null ? null : terminalJobs === 0 ? '—' : `${((data.failedJobs7d! / terminalJobs) * 100).toFixed(1)}%`;
  const generationDelta = data.generations7d == null || data.generationsPrevious7d == null
    ? null : data.generations7d - data.generationsPrevious7d;
  const providerContext = data.providerHealth == null ? 'Unavailable'
    : data.providerHealth.enabled === 0 ? 'No enabled providers'
      : data.providerHealth.degraded || data.providerHealth.unavailable || data.providerHealth.misconfigured
        ? `${data.providerHealth.degraded} degraded · ${data.providerHealth.unavailable} unavailable · ${data.providerHealth.misconfigured} misconfigured`
        : 'All enabled providers ready';
  const attention = [
    { value: data.pendingPayments, label: 'Payments awaiting review', href: '/admin/payments?view=payments&status=pending' },
    { value: data.providerIssues, label: 'Provider issues', href: '/admin/providers' },
    { value: data.modelsMissingPricing, label: 'Models missing price', href: '/admin/models' },
    { value: data.modelsMissingRoute, label: 'Models missing route', href: '/admin/models' },
  ].filter((item): item is { value: number; label: string; href: string } => typeof item.value === 'number' && item.value > 0);

  return <>
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4 text-start">
      <div>
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.04em] text-white">Overview</h1>
        <p className="mt-1.5 text-[13px] text-[var(--studio-text-secondary)]">A live snapshot of VANTRA&apos;s users, AI activity, and system health.</p>
      </div>
      <button type="button" onClick={refresh} disabled={refreshing} className="mt-1 inline-flex h-9 items-center gap-2 rounded-lg px-2 text-[11.5px] text-[var(--studio-text-secondary)] hover:bg-white/[0.05] hover:text-white disabled:cursor-wait" aria-label="Refresh Overview">
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
        <span>{refreshing ? 'Refreshing…' : `Updated ${relativeTime(data.generatedAt, now)}`}</span>
      </button>
    </header>

    {!result.available ? <div role="alert" className={`${cardClass} flex min-h-40 flex-col items-center justify-center p-6 text-center`}>
      <AlertTriangle className="h-6 w-6 text-red-200" aria-hidden="true" />
      <h2 className="mt-3 text-[15px] font-semibold text-white">Overview unavailable</h2>
      <p className="mt-1 text-[12px] text-[var(--studio-text-secondary)]">The live snapshot could not be loaded.</p>
      <button type="button" onClick={refresh} className="mt-4 h-9 rounded-lg bg-white px-4 text-[12px] font-semibold text-black">Try again</button>
    </div> : <>
      {attention.length > 0 && <section aria-labelledby="attention-heading" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-amber-300/30 bg-amber-300/[0.045] px-4 py-4 text-start">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
          <h2 id="attention-heading" className="text-[12px] font-semibold text-amber-100">Needs attention</h2>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--studio-text-secondary)]">
          {attention.map((item, index) => <span key={item.label} className="inline-flex items-center gap-3">{index > 0 && <span className="text-amber-300/70" aria-hidden="true">•</span>}<Link href={item.href} prefetch={false} className="hover:text-white"><strong className="me-1.5 tabular-nums text-white">{item.value}</strong>{item.label}</Link></span>)}
        </div>
        <Link href={attention[0].href} prefetch={false} className="group inline-flex items-center gap-2 text-[11.5px] font-semibold text-white">Review issues<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></Link>
      </section>}

      {data.partialFailures.length > 0 && <p role="status" className="mb-3 text-[11px] text-amber-200/80">Some metrics are temporarily unavailable.</p>}

      <section aria-label="Primary metrics" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <PrimaryCard href="/admin/users" icon={<UserRound className="h-5 w-5" />} label="Total users" value={data.totalUsers?.toLocaleString() ?? '—'} context={data.usersThisMonth == null ? 'Unavailable' : `↗ +${data.usersThisMonth} this month`} tone={data.usersThisMonth && data.usersThisMonth > 0 ? 'success' : 'neutral'} />
        <PrimaryCard href="/admin/jobs?range=7d" icon={<Box className="h-5 w-5" />} label="Generations · 7D" value={data.generations7d?.toLocaleString() ?? '—'} context={generationDelta == null ? 'Comparison unavailable' : `${generationDelta >= 0 ? '↗ +' : '↘ '}${generationDelta} vs previous 7d`} tone={generationDelta != null && generationDelta > 0 ? 'success' : 'neutral'} />
        <PrimaryCard href="/admin/jobs?range=7d&status=completed" icon={<CircleCheck className="h-5 w-5" />} label="Success rate · 7D" value={successRate ?? '—'} context={terminalJobs === 0 ? 'No jobs yet' : data.successfulJobs7d == null ? 'Unavailable' : `${data.successfulJobs7d.toLocaleString()} successful jobs`} />
        <PrimaryCard href="/admin/jobs?range=7d&status=failed" icon={<CircleX className="h-5 w-5" />} label="Failure rate · 7D" value={failureRate ?? '—'} context={terminalJobs === 0 ? 'No jobs yet' : data.failedJobs7d == null ? 'Unavailable' : `${data.failedJobs7d.toLocaleString()} failed jobs`} tone={data.failedJobs7d && data.failedJobs7d > 0 ? 'danger' : 'neutral'} />
      </section>

      <section aria-label="Operational metrics" className="mt-6 grid gap-2.5 lg:grid-cols-3">
        <SecondaryCard href="/admin/payments?view=payments&status=pending" icon={<CreditCard className="h-5 w-5" />} label="Payments awaiting review" value={data.pendingPayments?.toLocaleString() ?? '—'} context={data.pendingPayments == null ? 'Unavailable' : data.pendingPayments > 0 ? 'Requires action' : 'Nothing awaiting review'} />
        <SecondaryCard href="/admin/providers" icon={<Server className="h-5 w-5" />} label="Provider health" value={data.providerHealth == null ? '—' : `${data.providerHealth.ready} / ${data.providerHealth.enabled}`} context={providerContext} />
        <SecondaryCard href="/admin/models" icon={<Boxes className="h-5 w-5" />} label="Active models" value={data.activeModels?.toLocaleString() ?? '—'} context={data.testingModels == null || data.disabledModels == null ? 'Unavailable' : `${data.testingModels} testing · ${data.disabledModels} disabled`} />
      </section>

      <section className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className={`${cardClass} min-w-0 p-4`}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-white">Recent Activity</h2>
            <Link href="/admin/audit" prefetch={false} className="group inline-flex items-center gap-2 text-[11px] font-medium text-[var(--studio-text-secondary)] hover:text-white">View all<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></Link>
          </div>
          <div className="mt-3">
            {data.recentActivity.length > 0 ? data.recentActivity.slice(0, 5).map((item) => <Link key={item.id} href={item.href} prefetch={false} className="group flex items-center gap-3 border-t border-[var(--studio-border-subtle)] py-2.5 first:border-t-0">
              <ActivityIcon item={item} />
              <div className="min-w-0 flex-1 text-start">
                <p className="truncate text-[12.5px] font-semibold text-white">{item.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--studio-text-secondary)]">{item.context}</p>
              </div>
              <time dateTime={item.createdAt} className="hidden shrink-0 text-[10.5px] text-[var(--studio-text-muted)] sm:block">{relativeTime(item.createdAt, now)}</time>
              <StatusPill status={item.status} />
            </Link>) : <div className="flex items-center justify-center py-10 text-center text-[12px] text-[var(--studio-text-secondary)]">No important activity yet.</div>}
          </div>
        </div>

        <div className={`${cardClass} p-3`}>
          <h2 className="px-1 pb-2 text-[17px] font-semibold tracking-[-0.02em] text-white">Quick Actions</h2>
          <div className="grid gap-2">
            {[
              { href: '/admin/payments?view=payments&status=pending', label: 'Review Payments', context: 'View and approve pending payments', icon: <FileText className="h-4 w-4" /> },
              { href: '/admin/models', label: 'Manage Models', context: 'Add, update, or disable models', icon: <Box className="h-4 w-4" /> },
              { href: '/admin/jobs?range=7d&status=failed', label: 'View Failed Jobs', context: 'Investigate failed jobs', icon: <CircleX className="h-4 w-4" /> },
              { href: '/admin/users', label: 'Find User', context: 'Search users and view activity', icon: <Search className="h-4 w-4" /> },
            ].map((action) => <Link key={action.label} href={action.href} prefetch={false} className="group flex items-center gap-3 rounded-xl border border-[var(--studio-border)] bg-white/[0.018] px-3 py-3 transition-[background-color,border-color] duration-150 hover:border-[var(--studio-border-strong)] hover:bg-white/[0.045]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.05] text-white">{action.icon}</span>
              <span className="min-w-0 flex-1 text-start"><strong className="block text-[12px] font-semibold text-white">{action.label}</strong><span className="mt-0.5 block truncate text-[10.5px] text-[var(--studio-text-secondary)]">{action.context}</span></span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--studio-text-secondary)] transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>)}
          </div>
        </div>
      </section>
    </>}
  </>;
}
