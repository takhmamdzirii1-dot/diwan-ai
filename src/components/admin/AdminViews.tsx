'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ArrowRight, ChevronDown, Database, ExternalLink, Search, X } from 'lucide-react';
import RunwareProviderTest, { type ProviderTestCopy } from '@/src/components/internal/RunwareProviderTest';
import AdminPaymentActions from './AdminPaymentActions';
import AdminPaymentPlans from './AdminPaymentPlans';
import type {
  AdminDataResult, AdminJobRow, AdminModelRow, AdminOverviewData, AdminPaymentRow,
  AdminPaymentPlan, AdminProviderRow, AdminUsersData, CostAmount,
} from '@/lib/admin/types';
import { isMissingCustomerPricing } from '@/lib/admin/model-economics';

function PageHeader({ title, description, children, compact = false }: { title: string; description: string; children?: React.ReactNode; compact?: boolean }) {
  return <header className={`${compact ? 'mb-4' : 'mb-7'} flex flex-wrap items-end justify-between gap-4 text-start`}>
    <div><h1 className="text-[30px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[34px]">{title}</h1><p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--studio-text-secondary)]">{description}</p></div>
    {children}
  </header>;
}

function Notice({ reason }: { reason?: 'not_configured' | 'query_failed' }) {
  const t = useTranslations('Admin.common');
  return <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.055] p-4 text-start text-[13px] leading-relaxed text-amber-50/90"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" /><span>{t(reason === 'query_failed' ? 'queryFailed' : 'notConfigured')}</span></div>;
}

function Empty({ label, action }: { label?: string; action?: React.ReactNode }) {
  const t = useTranslations('Admin.common');
  return <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--studio-border)] bg-white/[0.018] px-6 text-center"><Database className="h-7 w-7 text-[var(--studio-text-muted)]" aria-hidden="true" /><p className="mt-3 max-w-xl text-[13px] leading-relaxed text-[var(--studio-text-secondary)]">{label ?? t('noData')}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'strong' | 'danger' | 'warning' | 'success' }) {
  const classes = tone === 'strong' ? 'border-white/25 bg-white text-black'
    : tone === 'danger' ? 'border-red-400/30 bg-red-400/[0.1] text-red-100'
      : tone === 'warning' ? 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100'
        : tone === 'success' ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100'
          : 'border-white/15 bg-white/[0.055] text-[var(--studio-text-secondary)]';
  return <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${classes}`}>{children}</span>;
}

function TableFrame({ children }: { children: React.ReactNode }) {
  return <div className="max-w-full overflow-x-auto rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.95)] [scrollbar-width:thin] [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-150 [&_tbody_tr:hover]:bg-white/[0.025] [&_th]:bg-white/[0.025] [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-[var(--studio-text-muted)]">{children}</div>;
}

function Cost({ value }: { value: CostAmount | null }) {
  const t = useTranslations('Admin.common');
  return value ? <span dir="ltr" className="tabular-nums">{t('minorUnits', { value: value.minor, currency: value.currency })}</span> : <span aria-label={t('unavailable')}>—</span>;
}

function ProviderEconomics({ row }: { row: Pick<AdminModelRow, 'providerCost' | 'providerCostState'> }) {
  const t = useTranslations('Admin.common');
  if (row.providerCostState === 'free') return <span>{t('providerCostFree')}</span>;
  if (row.providerCostState === 'known') return <Cost value={row.providerCost} />;
  return <span>{t('providerCostUnknown')}</span>;
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
  const warning = ['pending', 'unconfirmed', 'temporarily_unavailable'].includes(value);
  const success = ['healthy', 'completed', 'active', 'available', 'approved'].includes(value);
  return <Badge tone={danger ? 'danger' : warning ? 'warning' : success ? 'success' : 'neutral'}>{translated}</Badge>;
}

function TechnicalId({ label, value }: { label: string; value: string }) {
  return <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--studio-text-muted)]"><span className="shrink-0 font-medium">{label}:</span><code dir="ltr" className="truncate" title={value}>{value}</code></p>;
}

function TechnicalDetails({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Admin.common');
  return <details className="mt-2"><summary className="w-fit cursor-pointer rounded text-[11px] font-medium text-[var(--studio-text-muted)] hover:text-white">{t('technicalDetails')}</summary><div className="mt-2 rounded-lg border border-[var(--studio-border-subtle)] bg-black/20 p-2.5">{children}</div></details>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4 text-start shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--studio-text-muted)]">{label}</p><p className="mt-2 text-[28px] font-bold leading-none tabular-nums tracking-[-0.03em] text-white">{value ?? '—'}</p></div>;
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return <div className="mb-4 text-start"><h2 className="text-[19px] font-semibold tracking-[-0.02em] text-white">{title}</h2>{description && <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-[var(--studio-text-secondary)]">{description}</p>}</div>;
}

const actionLinkClass = 'group flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[var(--studio-border)] bg-white/[0.025] px-3.5 text-[13px] font-medium text-[var(--studio-text-secondary)] transition-[background-color,border-color,color] duration-150 hover:border-[var(--studio-border-strong)] hover:bg-white/[0.065] hover:text-white motion-reduce:transition-none';

function summarizeActivity(items: AdminOverviewData['recentActivity']) {
  return items.reduce<Array<AdminOverviewData['recentActivity'][number] & { occurrences: number }>>((summary, item) => {
    const existing = summary.find((candidate) => candidate.kind === item.kind
      && candidate.label === item.label && candidate.detail === item.detail
      && candidate.status === item.status && candidate.technicalDetail === item.technicalDetail);
    if (existing) existing.occurrences += 1;
    else summary.push({ ...item, occurrences: 1 });
    return summary;
  }, []);
}

export function OverviewView({ result }: { result: AdminDataResult<AdminOverviewData> }) {
  const t = useTranslations('Admin');
  const metrics = [
    ['totalUsers', result.data.totalUsers], ['totalGenerations', result.data.totalGenerations],
    ['successfulJobs', result.data.successfulJobs], ['failedJobs', result.data.failedJobs],
    ['creditsConsumed', result.data.creditsConsumed], ['pendingPayments', result.data.pendingPayments],
  ] as const;
  const attentionItems = [
    { key: 'pendingPayments', value: result.data.pendingPayments, href: '/admin/payments?view=payments&status=pending' },
    { key: 'failedJobs', value: result.data.failedJobs, href: '/admin/jobs' },
    { key: 'providerIssues', value: result.data.providerIssues, href: '/admin/providers' },
    { key: 'modelsMissingPricing', value: result.data.modelsMissingPricing, href: '/admin/models' },
    { key: 'modelsUnknownProviderCost', value: result.data.modelsUnknownProviderCost, href: '/admin/models' },
  ].filter((item) => typeof item.value === 'number' && item.value > 0);
  return <><PageHeader title={t('overview.title')} description={t('overview.description')} />{!result.available && <Notice reason={result.reason} />}
    {attentionItems.length ? <section aria-labelledby="admin-attention-title" className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2.5 text-start"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" /><div className="min-w-0 flex-1"><h2 id="admin-attention-title" className="text-[14px] font-semibold text-amber-50">{t('overview.attentionTitle')}</h2><p className="text-[11.5px] text-amber-50/75">{t('overview.attentionDescription')}</p></div></div>
      <div className="mt-2.5 flex flex-wrap gap-2">{attentionItems.map((item) => <Link key={item.key} href={item.href} prefetch={false} className="inline-flex min-h-8 items-center gap-3 rounded-lg border border-amber-200/15 bg-black/20 px-2.5 py-1.5 text-[11.5px] font-medium text-amber-50/85 hover:bg-black/30 hover:text-white"><span>{t(`overview.${item.key}`)}</span><strong className="tabular-nums text-white">{item.value}</strong></Link>)}</div>
    </section> : null}
    <section aria-label={t('overview.metrics')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([key, value]) => <Metric key={key} label={t(`overview.${key}`)} value={value} />)}</section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5"><SectionHeading title={t('overview.recentActivity')} />
      <div className="space-y-1">{result.data.recentActivity.length ? summarizeActivity(result.data.recentActivity).map((item) => {
        const action = t.has(`status.${item.status}`) ? t(`status.${item.status}`) : item.status;
        const title = item.kind === 'generation'
          ? t('overview.generationActivity', { item: item.label })
          : t('overview.creditActivity', { action });
        const detail = item.kind === 'credit' ? t('overview.creditChange', { value: item.detail }) : item.detail;
        return <div key={item.id} className="flex items-start justify-between gap-4 border-t border-[var(--studio-border-subtle)] py-2.5 text-start first:border-0"><div className="min-w-0"><p className="text-[13px] font-medium text-white">{title}{item.occurrences > 1 ? <span className="ms-2 text-[11px] font-medium text-[var(--studio-text-muted)]">{t('overview.repeatedActivity', { count: item.occurrences })}</span> : null}</p><p className="mt-0.5 break-words text-[12px] text-[var(--studio-text-secondary)]">{detail}</p>{item.technicalDetail ? <TechnicalDetails><p className="break-words text-[11px] text-[var(--studio-text-secondary)]">{item.technicalDetail}</p></TechnicalDetails> : null}</div><div className="shrink-0 text-end"><Status value={item.status} /><p className="mt-1 text-[11px] text-[var(--studio-text-muted)]"><DateValue value={item.createdAt} /></p></div></div>;
      }) : <Empty label={t('overview.noActivity')} />}</div></div>
      <div className="space-y-5"><div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 text-start"><SectionHeading title={t('overview.quickActions')} /><div className="grid gap-2">
        <Link href="/admin/payments?view=payments&status=pending" prefetch={false} className={actionLinkClass}><span>{t('overview.reviewPayments')}</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" /></Link>
        <Link href="/admin/payments?view=plans" prefetch={false} className={actionLinkClass}><span>{t('overview.managePlans')}</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" /></Link>
        <Link href="/admin/jobs" prefetch={false} className={actionLinkClass}><span>{t('overview.viewJobs')}</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" /></Link>
        <Link href="/admin/providers" prefetch={false} className={actionLinkClass}><span>{t('overview.reviewProviders')}</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" /></Link>
        <Link href="/admin/users" prefetch={false} className={actionLinkClass}><span>{t('overview.findUser')}</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" /></Link>
      </div></div>
      {result.data.providerCosts.length ? <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 text-start"><SectionHeading title={t('overview.providerCost')} description={t('overview.providerCostDescription')} /><div className="space-y-2">{result.data.providerCosts.map((cost) => <div key={cost.currency} className="rounded-xl border border-[var(--studio-border-subtle)] bg-white/[0.025] p-3 text-[13px] font-semibold text-white"><Cost value={cost} /></div>)}</div></div> : null}</div>
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
    {result.data.length ? <TableFrame><table className="w-full min-w-[900px] text-start text-[13px]"><thead className="border-b border-[var(--studio-border)]"><tr>{['name','modality','health','role','lastActivity','failures','cost'].map((key) => <th key={key} className="px-4 py-3.5">{t(`providers.${key}`)}</th>)}</tr></thead><tbody>{result.data.map((row) => <tr key={row.id} className="border-b border-[var(--studio-border-subtle)] last:border-0"><td className="px-4 py-4 align-top"><p className="font-semibold text-white">{row.name}</p><div className="mt-1.5"><Badge tone={row.enabled ? 'success' : 'neutral'}>{t(row.enabled ? 'common.enabled' : 'common.disabled')}</Badge></div><TechnicalDetails><TechnicalId label={t('common.internalId')} value={row.id} /><p className="mt-2 text-[11px] text-[var(--studio-text-secondary)]"><strong>{t('providers.models')}:</strong> {row.associatedModels.length ? row.associatedModels.join(' · ') : t('common.noneRecorded')}</p><p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]"><strong>{t('providers.requests')}:</strong> <span className="tabular-nums">{row.requestCount}</span></p><p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]"><strong>{t('providers.latency')}:</strong> {row.averageLatencyMs == null ? '—' : t('common.milliseconds', { value: row.averageLatencyMs })}</p>{row.lastError && <p className="mt-2 break-words text-[11px] text-red-100"><strong>{t('providers.lastError')}:</strong> {row.lastError}</p>}</TechnicalDetails></td><td className="px-4 py-4 align-top text-[var(--studio-text-secondary)]">{row.modalities.map((value) => t.has(`modality.${value}`) ? t(`modality.${value}`) : value).join(' · ')}</td><td className="px-4 py-4 align-top"><Status value={row.status} /></td><td className="px-4 py-4 align-top"><Badge>{t(`role.${row.role}`)}</Badge></td><td className="whitespace-nowrap px-4 py-4 align-top text-[var(--studio-text-secondary)]"><DateValue value={row.lastActivityAt} /></td><td className={`px-4 py-4 text-end align-top font-semibold tabular-nums ${row.failures ? 'text-red-100' : 'text-[var(--studio-text-secondary)]'}`}>{row.failures}</td><td className="px-4 py-4 text-end align-top font-medium text-[var(--studio-text-secondary)]">{row.accumulatedCosts.length ? row.accumulatedCosts.map((cost) => <div key={cost.currency}><Cost value={cost} /></div>) : '—'}</td></tr>)}</tbody></table></TableFrame> : <Empty label={t('providers.noProviders')} />}
    <details className="group mt-6 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)]"><summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 text-start text-[14px] font-semibold text-white [&::-webkit-details-marker]:hidden sm:px-5"><ChevronDown className="h-4 w-4 text-[var(--studio-text-muted)] transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /><span>{t('providers.testTitle')}</span><span className="ms-auto text-[11px] font-medium text-[var(--studio-text-muted)]">{t('providers.diagnosticsLabel')}</span></summary><div className="border-t border-[var(--studio-border-subtle)] p-4 sm:p-5"><p className="mb-4 max-w-2xl text-start text-[13px] leading-relaxed text-[var(--studio-text-secondary)]">{t('providers.testDescription')}</p><RunwareProviderTest copy={providerTestCopy} /></div></details></>;
}

export function ModelsView({ result }: { result: AdminDataResult<AdminModelRow[]> }) {
  const t = useTranslations('Admin');
  const [filter, setFilter] = useState('all');
  const filterOptions = ['all', 'enabled', 'primary', 'image', 'chat', 'video', 'missingPricing', 'preview', 'notInStudio'] as const;
  const counts = {
    total: result.data.length,
    enabled: result.data.filter((row) => row.enabled).length,
    primary: result.data.filter((row) => row.priority === 'primary').length,
    missingPricing: result.data.filter(isMissingCustomerPricing).length,
    unknownProviderCost: result.data.filter((row) => row.providerCostState === 'unknown').length,
    preview: result.data.filter((row) => row.availability === 'preview').length,
  };
  const filtered = useMemo(() => result.data.filter((row) => {
    if (filter === 'enabled') return row.enabled;
    if (filter === 'primary') return row.priority === 'primary';
    if (['image', 'chat', 'video'].includes(filter)) return row.modality === filter;
    if (filter === 'missingPricing') return isMissingCustomerPricing(row);
    if (filter === 'preview') return row.availability === 'preview';
    if (filter === 'notInStudio') return row.availability === 'not_in_studio';
    return true;
  }), [filter, result.data]);
  return <><PageHeader title={t('models.title')} description={t('models.description')} />{!result.available && <Notice reason={result.reason} />}
    <section aria-label={t('models.summary')} className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{(['total','enabled','primary','missingPricing','unknownProviderCost','preview'] as const).map((key) => <div key={key} className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-2.5 text-start"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t(`models.summary${key[0].toUpperCase()}${key.slice(1)}`)}</p><p className="mt-1 text-lg font-bold tabular-nums text-white">{counts[key]}</p></div>)}</section>
    <div role="group" aria-label={t('models.filterLabel')} className="mb-4 flex flex-wrap gap-2">{filterOptions.map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-9 rounded-full border px-3 text-[11.5px] font-semibold transition-[background-color,border-color,color] duration-150 motion-reduce:transition-none ${filter === value ? 'border-white bg-white text-black' : 'border-[var(--studio-border)] bg-[var(--studio-surface)] text-[var(--studio-text-secondary)] hover:border-[var(--studio-border-strong)] hover:text-white'}`}>{t(`models.filters.${value}`)}</button>)}</div>
    {filtered.length ? <TableFrame><table className="w-full min-w-[820px] text-start text-[13px]"><thead className="border-b border-[var(--studio-border)]"><tr>{['displayName','modality','provider','state','priority','pricing'].map((key) => <th key={key} className="px-4 py-3.5">{t(`models.${key}`)}</th>)}</tr></thead><tbody>{filtered.map((row) => <tr key={row.key} className="border-b border-[var(--studio-border-subtle)] last:border-0"><td className="px-4 py-4 align-top"><p className="font-semibold text-white">{row.displayName}</p><TechnicalDetails><TechnicalId label={t('common.modelId')} value={row.modelId} /></TechnicalDetails></td><td className="px-4 py-4 align-top text-[var(--studio-text-secondary)]">{t.has(`modality.${row.modality}`) ? t(`modality.${row.modality}`) : row.modality}</td><td className="px-4 py-4 align-top text-[var(--studio-text-secondary)]">{row.provider}</td><td className="px-4 py-4 align-top"><div className="flex flex-wrap gap-1.5"><Badge tone={row.enabled ? 'success' : 'neutral'}>{t(row.enabled ? 'common.enabled' : 'common.disabled')}</Badge><Status value={row.availability} /></div></td><td className="px-4 py-4 align-top"><Badge>{t(`role.${row.priority}`)}</Badge></td><td className="px-4 py-4 text-end align-top"><p className="font-semibold tabular-nums text-white">{isMissingCustomerPricing(row) ? t('common.noPrice') : t('common.credits', { value: row.creditPrice })}</p><p className="mt-1 text-[11px] text-[var(--studio-text-muted)]">{t('models.providerCost')}: <ProviderEconomics row={row} /></p></td></tr>)}</tbody></table></TableFrame> : <Empty label={t('models.noMatches')} />}</>;
}

export function UsersView({ result }: { result: AdminDataResult<AdminUsersData> }) {
  const t = useTranslations('Admin');
  return <><PageHeader title={t('users.title')} description={t('users.description')} />{!result.available && <Notice reason={result.reason} />}
    <form action="/admin/users" method="get" className="mb-4 flex gap-2"><label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--studio-text-muted)]" aria-hidden="true" /><span className="sr-only">{t('users.search')}</span><input name="q" defaultValue={result.data.query} placeholder={t('users.search')} className="h-11 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] ps-10 pe-4 text-[13px] text-white outline-none placeholder:text-[var(--studio-text-muted)] focus-visible:border-[var(--studio-border-strong)]" /></label><button className="h-11 rounded-xl bg-white px-5 text-[13px] font-semibold text-black transition-[background-color] duration-150 hover:bg-white/90 motion-reduce:transition-none">{t('users.searchAction')}</button></form>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--studio-text-muted)]"><span>{t('users.showing', { total: result.data.total })}</span><span>{t('users.safeActions')}</span></div>{result.data.truncated && <p className="mb-3 text-[12px] text-[var(--studio-text-muted)]">{t('users.truncated')}</p>}
    {result.data.users.length ? <TableFrame><table className="w-full min-w-[760px] text-start text-[13px]"><thead className="border-b border-[var(--studio-border)]"><tr>{['email','balance','status','created','recentUsage'].map((key) => <th key={key} className={`px-4 py-3.5 ${key === 'balance' ? 'text-end' : ''}`}>{t(`users.${key}`)}</th>)}</tr></thead><tbody>{result.data.users.map((user) => <tr key={user.id} className="border-b border-[var(--studio-border-subtle)] last:border-0"><td className="max-w-80 px-4 py-4 align-top"><p className="break-words font-semibold text-white">{user.email}</p><TechnicalDetails><TechnicalId label={t('common.userId')} value={user.id} /><p className="mt-2 text-[11px] text-[var(--studio-text-secondary)]"><strong>{t('users.plan')}:</strong> {user.plan}</p><p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]"><strong>{t('users.lastSignIn')}:</strong> <DateValue value={user.lastSignInAt} /></p><p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]"><strong>{t('users.payments')}:</strong> <span className="tabular-nums">{user.paymentOrderCount}</span></p></TechnicalDetails></td><td className="px-4 py-4 text-end align-top font-semibold tabular-nums text-white">{user.creditBalance ?? '—'}</td><td className="px-4 py-4 align-top"><Status value={user.status} /></td><td className="whitespace-nowrap px-4 py-4 align-top text-[var(--studio-text-secondary)]"><DateValue value={user.createdAt} /></td><td className="px-4 py-4 align-top"><p className="font-medium tabular-nums text-white">{t('users.usageCredits', { value: user.creditsUsed })}</p><p className="mt-1 text-[11px] tabular-nums text-[var(--studio-text-muted)]">{t('users.usageGenerations', { value: user.generationCount })}</p></td></tr>)}</tbody></table></TableFrame> : <Empty label={result.data.query ? t('users.noMatches') : t('users.noUsers')} />}</>;
}

export function JobsView({ result }: { result: AdminDataResult<AdminJobRow[]> }) {
  const t = useTranslations('Admin');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [modality, setModality] = useState('all');
  const [provider, setProvider] = useState('all');
  const [model, setModel] = useState('all');
  const statusOptions = useMemo(() => [...new Set(result.data.map((job) => job.status))].sort(), [result.data]);
  const modalityOptions = useMemo(() => [...new Set(result.data.map((job) => job.modality))].sort(), [result.data]);
  const providerOptions = useMemo(() => [...new Set(result.data.map((job) => job.provider).filter((value): value is string => Boolean(value)))].sort(), [result.data]);
  const modelOptions = useMemo(() => [...new Map(result.data.map((job) => [job.modelId, job.modelName ?? job.modelId])).entries()], [result.data]);
  const filtered = useMemo(() => result.data.filter((job) => {
    const haystack = `${job.userEmail ?? ''} ${job.userId} ${job.provider ?? ''} ${job.modelId}`.toLowerCase();
    return (!query.trim() || haystack.includes(query.trim().toLowerCase())) && (status === 'all' || job.status === status) && (modality === 'all' || job.modality === modality) && (provider === 'all' || job.provider === provider) && (model === 'all' || job.modelId === model);
  }), [result.data, query, status, modality, provider, model]);
  const hasFilters = Boolean(query.trim()) || status !== 'all' || modality !== 'all' || provider !== 'all' || model !== 'all';
  const clearFilters = () => { setQuery(''); setStatus('all'); setModality('all'); setProvider('all'); setModel('all'); };
  const input = 'h-10 min-w-0 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white outline-none focus-visible:border-[var(--studio-border-strong)]';
  return <><PageHeader title={t('jobs.title')} description={t('jobs.description')}><Badge>{t('jobs.resultCount', { count: filtered.length })}</Badge></PageHeader>{!result.available && <Notice reason={result.reason} />}
    <div className="mb-4 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_145px_145px_170px_190px_auto]"><label className="relative sm:col-span-2 xl:col-span-1"><Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--studio-text-muted)]" aria-hidden="true" /><span className="sr-only">{t('jobs.search')}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('jobs.search')} className={`${input} w-full ps-9`} /></label><label><span className="sr-only">{t('jobs.statusFilter')}</span><select value={status} onChange={(event) => setStatus(event.target.value)} className={`${input} w-full`}><option value="all">{t('jobs.allStatuses')}</option>{statusOptions.map((value) => <option key={value} value={value}>{t.has(`status.${value}`) ? t(`status.${value}`) : value}</option>)}</select></label><label><span className="sr-only">{t('jobs.modalityFilter')}</span><select value={modality} onChange={(event) => setModality(event.target.value)} className={`${input} w-full`}><option value="all">{t('jobs.allModalities')}</option>{modalityOptions.map((value) => <option key={value} value={value}>{t.has(`modality.${value}`) ? t(`modality.${value}`) : value}</option>)}</select></label><label><span className="sr-only">{t('jobs.providerFilter')}</span><select value={provider} onChange={(event) => setProvider(event.target.value)} className={`${input} w-full`}><option value="all">{t('jobs.allProviders')}</option>{providerOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span className="sr-only">{t('jobs.modelFilter')}</span><select value={model} onChange={(event) => setModel(event.target.value)} className={`${input} w-full`}><option value="all">{t('jobs.allModels')}</option>{modelOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>{hasFilters && <button type="button" onClick={clearFilters} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--studio-border)] px-3 text-[12px] font-semibold text-[var(--studio-text-secondary)] hover:border-[var(--studio-border-strong)] hover:text-white"><X className="h-3.5 w-3.5" aria-hidden="true" />{t('jobs.clearFilters')}</button>}</div></div>
    {filtered.length ? <TableFrame><table className="w-full min-w-[980px] text-start text-[13px]"><thead className="border-b border-[var(--studio-border)]"><tr>{['time','user','modality','providerModel','status','creditsCharged','cost','details'].map((key) => <th key={key} className={`px-4 py-3.5 ${['creditsCharged','cost'].includes(key) ? 'text-end' : ''}`}>{t(`jobs.${key}`)}</th>)}</tr></thead><tbody>{filtered.map((job) => <tr key={`${job.source}:${job.id}`} className="border-b border-[var(--studio-border-subtle)] last:border-0"><td className="whitespace-nowrap px-4 py-4 align-top text-[var(--studio-text-secondary)]"><DateValue value={job.createdAt} /></td><td className="max-w-52 px-4 py-4 align-top"><p className="break-words font-medium text-white">{job.userEmail ?? t('common.unavailable')}</p></td><td className="px-4 py-4 align-top text-[var(--studio-text-secondary)]">{t.has(`modality.${job.modality}`) ? t(`modality.${job.modality}`) : job.modality}</td><td className="max-w-64 px-4 py-4 align-top"><p className="font-medium text-white">{job.modelName ?? t('common.unavailable')}</p><p className="mt-1 text-[11px] text-[var(--studio-text-muted)]">{job.provider ?? '—'}</p></td><td className="px-4 py-4 align-top"><Status value={job.status} /></td><td className="px-4 py-4 text-end align-top font-medium tabular-nums text-white">{job.creditsCharged == null ? '—' : t('common.credits', { value: job.creditsCharged })}</td><td className="px-4 py-4 text-end align-top text-[var(--studio-text-secondary)]"><Cost value={job.providerCost} /></td><td className="max-w-80 px-4 py-4 align-top"><details><summary className="cursor-pointer rounded text-[12px] font-medium text-[var(--studio-text-secondary)] hover:text-white">{t('jobs.viewDetails')}</summary><div className="mt-2 rounded-lg border border-[var(--studio-border-subtle)] bg-black/20 p-3"><p className={`whitespace-pre-wrap break-words text-[11px] leading-relaxed ${job.error ? 'text-red-100' : 'text-[var(--studio-text-secondary)]'}`}>{job.error ?? job.prompt ?? t('common.noneRecorded')}</p><p className="mt-2 text-[11px] text-[var(--studio-text-secondary)]"><strong>{t('jobs.source')}:</strong> {t(`jobs.${job.source}`)}</p><p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]"><strong>{t('jobs.latency')}:</strong> {job.latencyMs == null ? '—' : t('common.milliseconds', { value: job.latencyMs })}</p><TechnicalId label={t('common.userId')} value={job.userId} /><TechnicalId label={t('common.modelId')} value={job.modelId} /><TechnicalId label={t('common.jobId')} value={job.id} /></div></details></td></tr>)}</tbody></table></TableFrame> : <Empty label={result.data.length ? t('jobs.noMatches') : t('jobs.noJobs')} action={hasFilters ? <button type="button" onClick={clearFilters} className="h-9 rounded-lg border border-[var(--studio-border)] px-3 text-[12px] font-semibold text-white hover:bg-white/[0.06]">{t('jobs.clearFilters')}</button> : null} />}</>;
}

export function PlansPricingView({ result }: { result: AdminDataResult<AdminPaymentPlan[]> }) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  return <><PageHeader compact title={t('payments.plansPageTitle')} description={t('payments.plansPageDescription')}><Link href={`/${locale}#pricing`} target="_blank" prefetch={false} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3.5 text-[12px] font-semibold text-[var(--studio-text-secondary)] hover:border-[var(--studio-border-strong)] hover:text-white">{t('payments.previewPricing')}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></Link></PageHeader>
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
    <section aria-labelledby="payment-orders-title"><SectionHeading title={t('payments.ordersTitle')} description={t('payments.ordersDescription')} />
      <div role="tablist" aria-label={t('payments.statusFilter')} className="mb-4 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{['pending','approved','rejected','all'].map((value) => <button key={value} type="button" role="tab" aria-selected={status === value} onClick={() => setStatus(value)} className={`min-h-9 shrink-0 rounded-lg px-3.5 text-[12px] font-semibold transition-colors duration-150 motion-reduce:transition-none ${status === value ? 'bg-white text-black' : 'text-[var(--studio-text-secondary)] hover:bg-white/[0.06] hover:text-white'}`}>{value === 'all' ? t('payments.allStatuses') : t(`status.${value}`)}</button>)}</div>
      {!result.available && <Notice reason={result.reason} />}
      {filtered.length ? <div className="space-y-2.5">{filtered.map((payment) => <details key={payment.id} name="admin-payment-order" className="group rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.95)]">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 text-start [&::-webkit-details-marker]:hidden"><ChevronDown className="h-4 w-4 shrink-0 text-[var(--studio-text-muted)] transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="break-words text-[13px] font-semibold text-white">{payment.userEmail}</p><Status value={payment.status} /></div><p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--studio-text-secondary)]"><span>{payment.planName}</span><span aria-hidden="true">·</span><span>{payment.creditsAmount ? t('payments.credits', { value: payment.creditsAmount }) : '—'}</span><span aria-hidden="true">·</span><span>{t.has(`payments.${payment.paymentMethod}`) ? t(`payments.${payment.paymentMethod}`) : payment.paymentMethod}</span><span aria-hidden="true">·</span><span className={payment.proofUrl ? 'font-semibold text-emerald-100' : ''}>{payment.proofUrl ? t('payments.proofAttached') : t('payments.noProof')}</span></p></div><div className="shrink-0 text-end"><p dir="ltr" className="text-[15px] font-bold tabular-nums text-white">{payment.amountDzd.toLocaleString(locale)} DA</p><p className="mt-0.5 text-[10.5px] text-[var(--studio-text-muted)]"><DateValue value={payment.submittedAt ?? payment.createdAt} /></p></div></summary>
        <div className="border-t border-[var(--studio-border)] p-3"><div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
          <PaymentGroup title={t('payments.customerGroup')}><PaymentField label={t('payments.customer')}><p className="font-medium text-white">{payment.userEmail}</p><TechnicalId label={t('common.userId')} value={payment.userId} /></PaymentField></PaymentGroup>
          <PaymentGroup title={t('payments.snapshotTitle')}><div className="grid gap-3 sm:grid-cols-2"><PaymentField label={t('payments.product')}><p className="font-medium text-white">{payment.planName}</p><p className="mt-1 text-[var(--studio-text-muted)]">{t(`payments.${payment.orderKind}`)}</p></PaymentField><PaymentField label={t('payments.amount')}><p dir="ltr" className="font-semibold tabular-nums text-white">{payment.amountDzd.toLocaleString(locale)} DA</p><p className="mt-1">{payment.creditsAmount ? t('payments.credits', { value: payment.creditsAmount }) : '—'}</p></PaymentField></div></PaymentGroup>
          <PaymentGroup title={t('payments.paymentEvidence')}><PaymentField label={t('payments.method')}><p className="font-medium text-white">{t.has(`payments.${payment.paymentMethod}`) ? t(`payments.${payment.paymentMethod}`) : payment.paymentMethod}</p><TechnicalId label={t('payments.reference')} value={payment.paymentReference} /></PaymentField><div className="mt-3"><PaymentField label={t('payments.submission')}><p className="break-words">{payment.customerReference ?? t('common.noneRecorded')}</p>{payment.proofUrl ? <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-[12px] font-semibold text-black transition-colors duration-150 hover:bg-white/90"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{t('payments.viewProof')}</a> : <p className="mt-1 text-[var(--studio-text-muted)]">{t('payments.noProof')}</p>}</PaymentField></div></PaymentGroup>
          <PaymentGroup title={t('payments.reviewInformation')}><PaymentField label={t('payments.reviewInformation')}><p><DateValue value={payment.reviewedAt} /></p><p className="mt-1 break-words text-[var(--studio-text-muted)]">{payment.reviewNote ?? t('payments.noReviewNote')}</p></PaymentField></PaymentGroup>
          <PaymentGroup title={t('payments.creditResult')}><PaymentField label={t('payments.result')}>{payment.resultingCreditTransactionId ? <TechnicalId label={t('payments.ledgerTransaction')} value={payment.resultingCreditTransactionId} /> : payment.resultingEntitlementId ? <TechnicalId label={t('payments.entitlement')} value={payment.resultingEntitlementId} /> : <p>{t('common.noneRecorded')}</p>}</PaymentField></PaymentGroup>
          <PaymentGroup title={t('payments.audit')}><PaymentField label={t('payments.timestamps')}><p>{t('payments.created')}: <DateValue value={payment.createdAt} /></p><p className="mt-1">{t('status.submitted')}: <DateValue value={payment.submittedAt} /></p></PaymentField>{payment.audit.length ? <div className="mt-3 space-y-1.5 border-t border-[var(--studio-border-subtle)] pt-3">{payment.audit.map((event) => <p key={event.id} className="text-[11px] text-[var(--studio-text-secondary)]"><span className="font-semibold text-white">{t.has(`status.${event.action}`) ? t(`status.${event.action}`) : event.action}</span> · <DateValue value={event.createdAt} /></p>)}</div> : <p className="mt-2 text-[11px] text-[var(--studio-text-muted)]">{t('common.noneRecorded')}</p>}</PaymentGroup>
        </div>{payment.status === 'pending' && payment.submittedAt ? <div className="sticky bottom-2 z-10 mt-3 max-w-3xl"><AdminPaymentActions paymentId={payment.id} creditsAmount={payment.creditsAmount} onResolved={(nextStatus) => { setPayments((current) => current.map((item) => item.id === payment.id ? { ...item, status: nextStatus } : item)); setResolved((current) => ({ ...current, [payment.id]: nextStatus })); }} /></div> : null}
        {resolved[payment.id] && <p role="status" className="mt-2 text-start text-[11px] text-white/70">{t(resolved[payment.id] === 'approved' ? 'payments.approvedSuccess' : 'payments.rejectedSuccess')}</p>}</div>
      </details>)}</div> : <Empty label={status === 'all' ? t('payments.noPayments') : t('payments.noPaymentsForStatus')} />}
    </section></>;
}

function PaymentField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 text-start text-[11.5px] leading-relaxed text-[var(--studio-text-secondary)]"><p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--studio-text-muted)]">{label}</p>{children}</div>;
}

function PaymentGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-[var(--studio-border-subtle)] bg-white/[0.02] p-3"><h3 className="mb-2 text-start text-[12px] font-semibold text-white">{title}</h3>{children}</section>;
}
