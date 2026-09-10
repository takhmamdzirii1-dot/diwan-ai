'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ChevronDown, Database, Search } from 'lucide-react';
import RunwareProviderTest, { type ProviderTestCopy } from '@/src/components/internal/RunwareProviderTest';
import AdminPaymentActions from './AdminPaymentActions';
import AdminPaymentPlans from './AdminPaymentPlans';
import type {
  AdminDataResult, AdminJobRow, AdminModelRow, AdminOverviewData, AdminPaymentRow,
  AdminPaymentPlan, AdminProviderRow, AdminUsersData, CostAmount,
} from '@/lib/admin/types';

function PageHeader({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return <header className="mb-6 flex flex-wrap items-end justify-between gap-4 text-start">
    <div><h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">{title}</h1><p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[var(--studio-text-secondary)]">{description}</p></div>
    {children}
  </header>;
}

function Notice({ reason }: { reason?: 'not_configured' | 'query_failed' }) {
  const t = useTranslations('Admin.common');
  return <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-start text-[12.5px] leading-relaxed text-white/65"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{t(reason === 'query_failed' ? 'queryFailed' : 'notConfigured')}</span></div>;
}

function Empty({ label }: { label?: string }) {
  const t = useTranslations('Admin.common');
  return <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 text-center"><Database className="h-7 w-7 text-white/20" aria-hidden="true" /><p className="mt-3 text-[13px] text-white/50">{label ?? t('noData')}</p></div>;
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'strong' | 'danger' }) {
  const classes = tone === 'strong' ? 'border-white/20 bg-white text-black' : tone === 'danger' ? 'border-red-400/20 bg-red-400/[0.08] text-red-200' : 'border-white/10 bg-white/[0.04] text-white/60';
  return <span className={`inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${classes}`}>{children}</span>;
}

function TableFrame({ children }: { children: React.ReactNode }) {
  return <div className="max-w-full overflow-x-auto rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] [scrollbar-width:thin]">{children}</div>;
}

function Cost({ value }: { value: CostAmount | null }) {
  const t = useTranslations('Admin.common');
  return value ? <span dir="ltr">{t('minorUnits', { value: value.minor, currency: value.currency })}</span> : <span>{t('unavailable')}</span>;
}

function DateValue({ value }: { value: string | null }) {
  const locale = useLocale();
  const t = useTranslations('Admin.common');
  if (!value) return <span>{t('never')}</span>;
  return <time dateTime={value}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))}</time>;
}

function Status({ value }: { value: string }) {
  const t = useTranslations('Admin.status');
  const translated = t.has(value) ? t(value) : value;
  const danger = ['failed', 'attention', 'suspended', 'rejected'].includes(value);
  const strong = ['healthy', 'completed', 'active', 'available', 'approved'].includes(value);
  return <Badge tone={danger ? 'danger' : strong ? 'strong' : 'neutral'}>{translated}</Badge>;
}

function TechnicalId({ label, value }: { label: string; value: string }) {
  return <p className="mt-1 flex min-w-0 items-center gap-1 text-[9.5px] text-white/32"><span className="shrink-0">{label}:</span><code dir="ltr" className="truncate" title={value}>{value}</code></p>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] p-4 text-start"><p className="text-[10.5px] uppercase tracking-[0.12em] text-white/45">{label}</p><p className="mt-3 text-2xl font-semibold tabular-nums text-white">{value ?? '—'}</p></div>;
}

export function OverviewView({ result }: { result: AdminDataResult<AdminOverviewData> }) {
  const t = useTranslations('Admin');
  const metrics = [
    ['totalUsers', result.data.totalUsers], ['totalGenerations', result.data.totalGenerations],
    ['successfulJobs', result.data.successfulJobs], ['failedJobs', result.data.failedJobs],
    ['creditsConsumed', result.data.creditsConsumed], ['pendingPayments', result.data.pendingPayments],
  ] as const;
  return <><PageHeader title={t('overview.title')} description={t('overview.description')} />{!result.available && <Notice reason={result.reason} />}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{metrics.map(([key, value]) => <Metric key={key} label={t(`overview.${key}`)} value={value} />)}</section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><div className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] p-5"><h2 className="text-start text-[13px] font-semibold text-white/85">{t('overview.recentActivity')}</h2><div className="mt-4 space-y-1">{result.data.recentActivity.length ? result.data.recentActivity.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 border-t border-white/[0.06] py-3 text-start first:border-0"><div className="min-w-0"><p className="truncate text-[12.5px] text-white/75">{item.label}</p><p className="mt-0.5 truncate text-[11px] text-white/45">{item.detail}</p></div><div className="shrink-0 text-end"><Status value={item.status} /><p className="mt-1.5 text-[10px] text-white/40"><DateValue value={item.createdAt} /></p></div></div>) : <Empty label={t('overview.noActivity')} />}</div></div>
      <div className="space-y-5"><div className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] p-5 text-start"><h2 className="text-[13px] font-semibold text-white/85">{t('overview.attentionTitle')}</h2><div className="mt-3 space-y-2"><Link href="/admin/payments?view=payments&status=pending" prefetch={false} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[11.5px] text-white/60 hover:bg-white/[0.045]"><span>{t('overview.pendingPayments')}</span><strong className="text-white/85">{result.data.pendingPayments ?? '—'}</strong></Link><Link href="/admin/jobs" prefetch={false} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[11.5px] text-white/60 hover:bg-white/[0.045]"><span>{t('overview.failedJobs')}</span><strong className="text-white/85">{result.data.failedJobs ?? '—'}</strong></Link></div></div>
        <div className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] p-5 text-start"><h2 className="text-[13px] font-semibold text-white/85">{t('overview.quickActions')}</h2><div className="mt-3 grid gap-2"><Link href="/admin/payments?view=plans" prefetch={false} className="rounded-xl border border-white/[0.07] px-3 py-2.5 text-[11.5px] text-white/60 hover:bg-white/[0.045] hover:text-white">{t('overview.managePlans')}</Link><Link href="/admin/providers" prefetch={false} className="rounded-xl border border-white/[0.07] px-3 py-2.5 text-[11.5px] text-white/60 hover:bg-white/[0.045] hover:text-white">{t('overview.reviewProviders')}</Link><Link href="/admin/users" prefetch={false} className="rounded-xl border border-white/[0.07] px-3 py-2.5 text-[11.5px] text-white/60 hover:bg-white/[0.045] hover:text-white">{t('overview.findUser')}</Link></div></div>
        <div className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] p-5 text-start"><h2 className="text-[13px] font-semibold text-white/85">{t('overview.providerCost')}</h2><div className="mt-3 space-y-2">{result.data.providerCosts.length ? result.data.providerCosts.map((cost) => <div key={cost.currency} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-[12px] text-white/65"><Cost value={cost} /></div>) : <p className="text-[12px] text-white/45">{t('common.unavailable')}</p>}</div></div></div>
    </section></>;
}

export function ProvidersView({ result }: { result: AdminDataResult<AdminProviderRow[]> }) {
  const t = useTranslations('Admin');
  const configured = result.data.filter((row) => row.enabled).length;
  const attention = result.data.filter((row) => row.status === 'attention').length;
  const providerTestCopy: ProviderTestCopy = {
    provider: t('providerTest.provider'), prompt: t('providerTest.prompt'), promptPlaceholder: t('providerTest.promptPlaceholder'), generate: t('providerTest.generate'), generating: t('providerTest.generating'), result: t('providerTest.result'), resultAlt: t('providerTest.resultAlt'), summary: t('providerTest.summary'), summaryHelp: t('providerTest.summaryHelp'), emptyTitle: t('providerTest.emptyTitle'), emptyDescription: t('providerTest.emptyDescription'), genericError: t('providerTest.genericError'),
  };
  return <><PageHeader title={t('providers.title')} description={t('providers.description')}><div className="flex gap-2"><Badge>{t('providers.configuredCount', { count: configured })}</Badge><Badge tone={attention ? 'danger' : 'neutral'}>{t('providers.attentionCount', { count: attention })}</Badge></div></PageHeader>{!result.available && <Notice reason={result.reason} />}
    {result.data.length ? <TableFrame><table className="w-full min-w-[1380px] text-start text-[11.5px]"><thead className="border-b border-white/[0.07] text-white/40"><tr>{['name','modality','state','health','role','models','requests','failures','latency','lastActivity','cost','lastError'].map((key) => <th key={key} className="px-4 py-3 font-medium">{t(`providers.${key}`)}</th>)}</tr></thead><tbody>{result.data.map((row) => <tr key={row.id} className="border-b border-white/[0.05] last:border-0"><td className="px-4 py-3.5"><p className="font-medium text-white/85">{row.name}</p><TechnicalId label={t('common.internalId')} value={row.id} /></td><td className="px-4 py-3.5 text-white/60">{row.modalities.map((value) => t.has(`modality.${value}`) ? t(`modality.${value}`) : value).join(' · ')}</td><td className="px-4 py-3.5"><Badge tone={row.enabled ? 'strong' : 'neutral'}>{t(row.enabled ? 'common.enabled' : 'common.disabled')}</Badge></td><td className="px-4 py-3.5"><Status value={row.status} /></td><td className="px-4 py-3.5"><Badge>{t(`role.${row.role}`)}</Badge></td><td className="max-w-64 px-4 py-3.5 text-white/50">{row.associatedModels.length ? row.associatedModels.join(' · ') : t('common.noneRecorded')}</td><td className="px-4 py-3.5 tabular-nums text-white/65">{row.requestCount}</td><td className="px-4 py-3.5 tabular-nums text-white/65">{row.failures}</td><td className="px-4 py-3.5 text-white/50">{row.averageLatencyMs == null ? '—' : t('common.milliseconds', { value: row.averageLatencyMs })}</td><td className="whitespace-nowrap px-4 py-3.5 text-white/45"><DateValue value={row.lastActivityAt} /></td><td className="px-4 py-3.5 text-white/50">{row.accumulatedCosts.length ? row.accumulatedCosts.map((cost) => <div key={cost.currency}><Cost value={cost} /></div>) : '—'}</td><td className="max-w-60 px-4 py-3.5 text-white/45"><p className="line-clamp-2" title={row.lastError ?? undefined}>{row.lastError ?? t('common.noneRecorded')}</p></td></tr>)}</tbody></table></TableFrame> : <Empty />}
    <section className="mt-6"><div className="mb-4 text-start"><h2 className="text-[15px] font-semibold text-white/85">{t('providers.testTitle')}</h2><p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-white/50">{t('providers.testDescription')}</p></div><RunwareProviderTest copy={providerTestCopy} /></section></>;
}

export function ModelsView({ result }: { result: AdminDataResult<AdminModelRow[]> }) {
  const t = useTranslations('Admin');
  return <><PageHeader title={t('models.title')} description={t('models.description')}><Badge>{t('models.modelCount', { count: result.data.length })}</Badge></PageHeader>{!result.available && <Notice reason={result.reason} />}{result.data.length ? <TableFrame><table className="w-full min-w-[1100px] text-start text-[11.5px]"><thead className="border-b border-white/[0.07] text-white/40"><tr>{['displayName','modality','provider','modelId','state','providerCost','creditPrice','priority'].map((key) => <th key={key} className="px-4 py-3 font-medium">{t(`models.${key}`)}</th>)}</tr></thead><tbody>{result.data.map((row) => <tr key={row.key} className="border-b border-white/[0.05] last:border-0"><td className="px-4 py-3.5 font-medium text-white/85">{row.displayName}</td><td className="px-4 py-3.5 text-white/60">{t.has(`modality.${row.modality}`) ? t(`modality.${row.modality}`) : row.modality}</td><td className="px-4 py-3.5 text-white/60">{row.provider}</td><td className="max-w-72 px-4 py-3.5"><TechnicalId label={t('common.modelId')} value={row.modelId} /></td><td className="px-4 py-3.5"><div className="flex flex-wrap gap-1.5"><Badge tone={row.enabled ? 'strong' : 'neutral'}>{t(row.enabled ? 'common.enabled' : 'common.disabled')}</Badge><Status value={row.availability} /></div></td><td className="px-4 py-3.5 text-white/50"><Cost value={row.providerCost} /></td><td className="px-4 py-3.5 text-white/60">{row.creditPrice == null ? t('common.unavailable') : t('common.credits', { value: row.creditPrice })}</td><td className="px-4 py-3.5"><Badge>{t(`role.${row.priority}`)}</Badge></td></tr>)}</tbody></table></TableFrame> : <Empty />}</>;
}

export function UsersView({ result }: { result: AdminDataResult<AdminUsersData> }) {
  const t = useTranslations('Admin');
  return <><PageHeader title={t('users.title')} description={t('users.description')} />{!result.available && <Notice reason={result.reason} />}<form action="/admin/users" method="get" className="mb-4 flex gap-2"><label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden="true" /><span className="sr-only">{t('users.search')}</span><input name="q" defaultValue={result.data.query} placeholder={t('users.search')} className="h-11 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] ps-10 pe-4 text-[13px] text-white outline-none placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-white/50" /></label><button className="h-11 rounded-xl bg-white px-4 text-[12.5px] font-semibold text-black transition-[background-color] duration-150 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none">{t('users.searchAction')}</button></form><div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-white/45"><span>{t('users.showing', { total: result.data.total })}</span><span>{t('users.safeActions')}</span></div>{result.data.truncated && <p className="mb-3 text-[11px] text-white/45">{t('users.truncated')}</p>}{result.data.users.length ? <TableFrame><table className="w-full min-w-[1180px] text-start text-[11.5px]"><thead className="border-b border-white/[0.07] text-white/40"><tr>{['email','plan','balance','usage','generations','payments','status','created','lastSignIn'].map((key) => <th key={key} className="px-4 py-3 font-medium">{t(`users.${key}`)}</th>)}</tr></thead><tbody>{result.data.users.map((user) => <tr key={user.id} className="border-b border-white/[0.05] last:border-0"><td className="max-w-64 px-4 py-3.5"><p className="truncate text-white/80" title={user.email}>{user.email}</p><TechnicalId label={t('common.userId')} value={user.id} /></td><td className="px-4 py-3.5 text-white/60">{user.plan}</td><td className="px-4 py-3.5 tabular-nums text-white/70">{user.creditBalance ?? t('common.unavailable')}</td><td className="px-4 py-3.5 tabular-nums text-white/70">{user.creditsUsed}</td><td className="px-4 py-3.5 tabular-nums text-white/70">{user.generationCount}</td><td className="px-4 py-3.5 tabular-nums text-white/70">{user.paymentOrderCount}</td><td className="px-4 py-3.5"><Status value={user.status} /></td><td className="whitespace-nowrap px-4 py-3.5 text-white/45"><DateValue value={user.createdAt} /></td><td className="whitespace-nowrap px-4 py-3.5 text-white/45"><DateValue value={user.lastSignInAt} /></td></tr>)}</tbody></table></TableFrame> : <Empty label={result.data.query ? t('users.noMatches') : undefined} />}</>;
}

export function JobsView({ result }: { result: AdminDataResult<AdminJobRow[]> }) {
  const t = useTranslations('Admin');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [modality, setModality] = useState('all');
  const statusOptions = useMemo(() => [...new Set(result.data.map((job) => job.status))].sort(), [result.data]);
  const modalityOptions = useMemo(() => [...new Set(result.data.map((job) => job.modality))].sort(), [result.data]);
  const filtered = useMemo(() => result.data.filter((job) => {
    const haystack = `${job.userEmail ?? ''} ${job.userId} ${job.provider ?? ''} ${job.modelId}`.toLowerCase();
    return (!query.trim() || haystack.includes(query.trim().toLowerCase())) && (status === 'all' || job.status === status) && (modality === 'all' || job.modality === modality);
  }), [result.data, query, status, modality]);
  const input = 'h-10 min-w-0 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 text-[11.5px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/50';
  return <><PageHeader title={t('jobs.title')} description={t('jobs.description')}><Badge>{t('jobs.resultCount', { count: filtered.length })}</Badge></PageHeader>{!result.available && <Notice reason={result.reason} />}
    <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_180px_180px]"><label className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" aria-hidden="true" /><span className="sr-only">{t('jobs.search')}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('jobs.search')} className={`${input} w-full ps-9`} /></label><label><span className="sr-only">{t('jobs.statusFilter')}</span><select value={status} onChange={(event) => setStatus(event.target.value)} className={`${input} w-full`}><option value="all">{t('jobs.allStatuses')}</option>{statusOptions.map((value) => <option key={value} value={value}>{t.has(`status.${value}`) ? t(`status.${value}`) : value}</option>)}</select></label><label><span className="sr-only">{t('jobs.modalityFilter')}</span><select value={modality} onChange={(event) => setModality(event.target.value)} className={`${input} w-full`}><option value="all">{t('jobs.allModalities')}</option>{modalityOptions.map((value) => <option key={value} value={value}>{t.has(`modality.${value}`) ? t(`modality.${value}`) : value}</option>)}</select></label></div>
    {filtered.length ? <TableFrame><table className="w-full min-w-[1350px] text-start text-[11.5px]"><thead className="border-b border-white/[0.07] text-white/40"><tr>{['time','source','user','modality','providerModel','status','latency','cost','creditsCharged','details'].map((key) => <th key={key} className="px-4 py-3 font-medium">{t(`jobs.${key}`)}</th>)}</tr></thead><tbody>{filtered.map((job) => <tr key={`${job.source}:${job.id}`} className="border-b border-white/[0.05] last:border-0"><td className="whitespace-nowrap px-4 py-3.5 text-white/45"><DateValue value={job.createdAt} /></td><td className="px-4 py-3.5"><Badge>{t(`jobs.${job.source}`)}</Badge></td><td className="max-w-52 px-4 py-3.5"><p className="truncate text-white/70" title={job.userEmail ?? undefined}>{job.userEmail ?? t('common.unavailable')}</p><TechnicalId label={t('common.userId')} value={job.userId} /></td><td className="px-4 py-3.5 text-white/55">{t.has(`modality.${job.modality}`) ? t(`modality.${job.modality}`) : job.modality}</td><td className="max-w-72 px-4 py-3.5"><p className="truncate text-white/65">{job.provider ?? t('common.unavailable')}</p><TechnicalId label={t('common.modelId')} value={job.modelId} /></td><td className="px-4 py-3.5"><Status value={job.status} /></td><td className="px-4 py-3.5 text-white/50">{job.latencyMs == null ? '—' : t('common.milliseconds', { value: job.latencyMs })}</td><td className="px-4 py-3.5 text-white/50"><Cost value={job.providerCost} /></td><td className="px-4 py-3.5 text-white/60">{job.creditsCharged == null ? t('common.unavailable') : t('common.credits', { value: job.creditsCharged })}</td><td className="max-w-80 px-4 py-3.5"><details><summary className="cursor-pointer text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">{t('jobs.viewDetails')}</summary><p className="mt-2 whitespace-pre-wrap break-words text-[10.5px] leading-relaxed text-white/45">{job.error ?? job.prompt ?? t('common.noneRecorded')}</p><TechnicalId label={t('common.jobId')} value={job.id} /></details></td></tr>)}</tbody></table></TableFrame> : <Empty label={t('jobs.noMatches')} />}</>;
}

export function PlansPricingView({ result }: { result: AdminDataResult<AdminPaymentPlan[]> }) {
  const t = useTranslations('Admin');
  return <><PageHeader title={t('payments.plansPageTitle')} description={t('payments.plansPageDescription')} />
    {!result.available && <Notice reason={result.reason} />}<AdminPaymentPlans plans={result.data} /></>;
}

export function PaymentsView({ result, initialStatus = 'pending' }: { result: AdminDataResult<AdminPaymentRow[]>; initialStatus?: string }) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const [payments, setPayments] = useState(result.data);
  const [status, setStatus] = useState(['pending', 'approved', 'rejected', 'all'].includes(initialStatus) ? initialStatus : 'pending');
  const [resolved, setResolved] = useState<Record<string, 'approved' | 'rejected'>>({});
  useEffect(() => setPayments(result.data), [result.data]);
  const filtered = status === 'all' ? payments : payments.filter((payment) => payment.status === status);
  const pending = payments.filter((payment) => payment.status === 'pending').length;
  return <><PageHeader title={t('payments.title')} description={t('payments.description')}><div className="flex gap-2"><Badge>{t('payments.orderCount', { count: payments.length })}</Badge><Badge tone={pending ? 'danger' : 'neutral'}>{t('payments.pendingCount', { count: pending })}</Badge></div></PageHeader>
    <section aria-labelledby="payment-orders-title"><div className="mb-4 text-start"><h2 id="payment-orders-title" className="text-[15px] font-semibold text-white/85">{t('payments.ordersTitle')}</h2><p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-white/50">{t('payments.ordersDescription')}</p></div>
      <div role="tablist" aria-label={t('payments.statusFilter')} className="mb-4 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{['pending','approved','rejected','all'].map((value) => <button key={value} type="button" role="tab" aria-selected={status === value} onClick={() => setStatus(value)} className={`min-h-9 shrink-0 rounded-lg px-3 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 motion-reduce:transition-none ${status === value ? 'bg-white text-black' : 'text-white/50 hover:bg-white/[0.05] hover:text-white/80'}`}>{value === 'all' ? t('payments.allStatuses') : t(`status.${value}`)}</button>)}</div>
      {!result.available && <Notice reason={result.reason} />}
      {filtered.length ? <div className="space-y-3">{filtered.map((payment) => <details key={payment.id} className="group rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)]">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50 [&::-webkit-details-marker]:hidden"><ChevronDown className="h-4 w-4 shrink-0 text-white/35 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[12.5px] font-medium text-white/80">{payment.userEmail}</p><Status value={payment.status} /></div><p className="mt-1 truncate text-[10.5px] text-white/45">{payment.planName} · {payment.creditsAmount ? t('payments.credits', { value: payment.creditsAmount }) : t('common.unavailable')} · {t.has(`payments.${payment.paymentMethod}`) ? t(`payments.${payment.paymentMethod}`) : payment.paymentMethod}</p></div><div className="shrink-0 text-end"><p dir="ltr" className="text-[13px] font-semibold tabular-nums text-white/80">{payment.amountDzd.toLocaleString(locale)} DA</p><p className="mt-1 text-[9.5px] text-white/35"><DateValue value={payment.createdAt} /></p></div></summary>
        <div className="border-t border-white/[0.07] p-4"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <PaymentField label={t('payments.customer')}><p>{payment.userEmail}</p><TechnicalId label={t('common.userId')} value={payment.userId} /></PaymentField>
          <PaymentField label={t('payments.product')}><p>{payment.planName}</p><p className="mt-1 text-white/40">{t(`payments.${payment.orderKind}`)}</p></PaymentField>
          <PaymentField label={t('payments.amount')}><p dir="ltr">{payment.amountDzd.toLocaleString(locale)} DA</p><p className="mt-1">{payment.creditsAmount ? t('payments.credits', { value: payment.creditsAmount }) : t('common.unavailable')}</p></PaymentField>
          <PaymentField label={t('payments.method')}><p>{t.has(`payments.${payment.paymentMethod}`) ? t(`payments.${payment.paymentMethod}`) : payment.paymentMethod}</p><TechnicalId label={t('payments.reference')} value={payment.paymentReference} /></PaymentField>
          <PaymentField label={t('payments.submission')}><p className="break-words">{payment.customerReference ?? t('common.noneRecorded')}</p>{payment.proofUrl ? <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-8 items-center rounded-lg border border-white/12 px-2.5 text-[10.5px] text-white/75 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">{t('payments.viewProof')}</a> : <p className="mt-1 text-white/35">{t('payments.noProof')}</p>}</PaymentField>
          <PaymentField label={t('payments.reviewInformation')}><p><DateValue value={payment.reviewedAt} /></p><p className="mt-1 break-words text-white/45">{payment.reviewNote ?? t('payments.noReviewNote')}</p></PaymentField>
          <PaymentField label={t('payments.result')}>{payment.resultingCreditTransactionId ? <TechnicalId label={t('payments.ledgerTransaction')} value={payment.resultingCreditTransactionId} /> : payment.resultingEntitlementId ? <TechnicalId label={t('payments.entitlement')} value={payment.resultingEntitlementId} /> : <p>{t('common.noneRecorded')}</p>}</PaymentField>
          <PaymentField label={t('payments.audit')}>{payment.audit.length ? <div className="space-y-1">{payment.audit.map((event) => <p key={event.id}><span className="text-white/65">{t.has(`status.${event.action}`) ? t(`status.${event.action}`) : event.action}</span> · <DateValue value={event.createdAt} /></p>)}</div> : <p>{t('common.noneRecorded')}</p>}</PaymentField>
        </div>{payment.status === 'pending' && payment.submittedAt ? <div className="mt-4 max-w-md"><AdminPaymentActions paymentId={payment.id} onResolved={(nextStatus) => { setPayments((current) => current.map((item) => item.id === payment.id ? { ...item, status: nextStatus } : item)); setResolved((current) => ({ ...current, [payment.id]: nextStatus })); }} /></div> : null}
        {resolved[payment.id] && <p role="status" className="mt-4 text-start text-[11px] text-white/70">{t(resolved[payment.id] === 'approved' ? 'payments.approvedSuccess' : 'payments.rejectedSuccess')}</p>}</div>
      </details>)}</div> : <Empty label={status === 'all' ? t('payments.noPayments') : t('payments.noPaymentsForStatus')} />}
    </section></>;
}

function PaymentField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 text-start text-[11px] leading-relaxed text-white/60"><p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white/35">{label}</p>{children}</div>;
}
