'use client';

import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Database, Search } from 'lucide-react';
import RunwareProviderTest, { type ProviderTestCopy } from '@/src/components/internal/RunwareProviderTest';
import AdminPaymentActions from './AdminPaymentActions';
import AdminPaymentPlans from './AdminPaymentPlans';
import type {
  AdminDataResult,
  AdminJobRow,
  AdminModelRow,
  AdminOverviewData,
  AdminPaymentRow,
  AdminPaymentPlan,
  AdminProviderRow,
  AdminUsersData,
  CostAmount,
} from '@/lib/admin/types';

function PageHeader({ title, description }: { title: string; description: string }) {
  return <header className="mb-6 text-start"><h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--studio-text-secondary)]">{description}</p></header>;
}

function Notice({ reason }: { reason?: 'not_configured' | 'query_failed' }) {
  const t = useTranslations('Admin.common');
  return <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-start text-[12.5px] leading-relaxed text-white/65"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{t(reason === 'query_failed' ? 'queryFailed' : 'notConfigured')}</span></div>;
}

function Empty({ label }: { label?: string }) {
  const t = useTranslations('Admin.common');
  return <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 text-center"><Database className="h-7 w-7 text-white/20" aria-hidden="true" /><p className="mt-3 text-[13px] text-white/45">{label ?? t('noData')}</p></div>;
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'strong' | 'danger' }) {
  const classes = tone === 'strong' ? 'border-white/20 bg-white text-black' : tone === 'danger' ? 'border-red-400/20 bg-red-400/[0.08] text-red-200' : 'border-white/10 bg-white/[0.04] text-white/55';
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
  const danger = ['failed', 'attention', 'suspended'].includes(value);
  const strong = ['healthy', 'completed', 'active', 'available'].includes(value);
  return <Badge tone={danger ? 'danger' : strong ? 'strong' : 'neutral'}>{translated}</Badge>;
}

export function OverviewView({ result }: { result: AdminDataResult<AdminOverviewData> }) {
  const t = useTranslations('Admin');
  const metrics = [
    ['totalUsers', result.data.totalUsers], ['totalGenerations', result.data.totalGenerations],
    ['successfulJobs', result.data.successfulJobs], ['failedJobs', result.data.failedJobs],
    ['creditsConsumed', result.data.creditsConsumed],
  ] as const;
  return <><PageHeader title={t('overview.title')} description={t('overview.description')} />{!result.available && <Notice reason={result.reason} />}<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(([key, value]) => <div key={key} className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] p-4 text-start"><p className="text-[11px] uppercase tracking-[0.12em] text-white/40">{t(`overview.${key}`)}</p><p className="mt-3 text-2xl font-semibold tabular-nums text-white">{value ?? '—'}</p></div>)}</section><section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] p-5"><h2 className="text-start text-[13px] font-semibold text-white/85">{t('overview.recentActivity')}</h2><div className="mt-4 space-y-1">{result.data.recentActivity.length ? result.data.recentActivity.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 border-t border-white/[0.06] py-3 text-start first:border-0"><div className="min-w-0"><p className="truncate text-[12.5px] text-white/75">{item.label}</p><p className="mt-0.5 truncate text-[11px] text-white/40">{item.detail}</p></div><div className="shrink-0 text-end"><Status value={item.status} /><p className="mt-1.5 text-[10px] text-white/35"><DateValue value={item.createdAt} /></p></div></div>) : <Empty label={t('overview.noActivity')} />}</div></div><div className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] p-5 text-start"><h2 className="text-[13px] font-semibold text-white/85">{t('overview.providerCost')}</h2><div className="mt-4 space-y-2">{result.data.providerCosts.length ? result.data.providerCosts.map((cost) => <div key={cost.currency} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-[12px] text-white/65"><Cost value={cost} /></div>) : <p className="text-[12px] text-white/40">{t('common.unavailable')}</p>}</div></div></section></>;
}

export function ProvidersView({ result }: { result: AdminDataResult<AdminProviderRow[]> }) {
  const t = useTranslations('Admin');
  const providerTestCopy: ProviderTestCopy = {
    provider: t('providerTest.provider'), prompt: t('providerTest.prompt'), promptPlaceholder: t('providerTest.promptPlaceholder'),
    generate: t('providerTest.generate'), generating: t('providerTest.generating'), result: t('providerTest.result'),
    resultAlt: t('providerTest.resultAlt'), summary: t('providerTest.summary'), emptyTitle: t('providerTest.emptyTitle'),
    emptyDescription: t('providerTest.emptyDescription'), genericError: t('providerTest.genericError'),
  };
  return <><PageHeader title={t('providers.title')} description={t('providers.description')} />{!result.available && <Notice reason={result.reason} />}{result.data.length ? <TableFrame><table className="w-full min-w-[1120px] text-start text-[11.5px]"><thead className="border-b border-white/[0.07] text-white/35"><tr>{['name','modality','state','health','role','requests','failures','latency','cost','lastError'].map((key) => <th key={key} className="px-4 py-3 font-medium">{t(`providers.${key}`)}</th>)}</tr></thead><tbody>{result.data.map((row) => <tr key={row.id} className="border-b border-white/[0.05] last:border-0"><td className="px-4 py-3.5"><p className="font-medium text-white/85">{row.name}</p><code className="text-[10px] text-white/35">{row.id}</code></td><td className="px-4 py-3.5 text-white/60">{row.modalities.join(' · ')}</td><td className="px-4 py-3.5"><Badge tone={row.enabled ? 'strong' : 'neutral'}>{t(row.enabled ? 'common.enabled' : 'common.disabled')}</Badge></td><td className="px-4 py-3.5"><Status value={row.status} /></td><td className="px-4 py-3.5"><Badge>{t(`role.${row.role}`)}</Badge></td><td className="px-4 py-3.5 tabular-nums text-white/65">{row.requestCount}</td><td className="px-4 py-3.5 tabular-nums text-white/65">{row.failures}</td><td className="px-4 py-3.5 text-white/50">{row.averageLatencyMs == null ? '—' : t('common.milliseconds', { value: row.averageLatencyMs })}</td><td className="px-4 py-3.5 text-white/50">{row.accumulatedCosts.length ? row.accumulatedCosts.map((cost) => <div key={cost.currency}><Cost value={cost} /></div>) : '—'}</td><td className="max-w-60 truncate px-4 py-3.5 text-white/45" title={row.lastError ?? undefined}>{row.lastError ?? '—'}</td></tr>)}</tbody></table></TableFrame> : <Empty />}<section className="mt-6"><div className="mb-4 text-start"><h2 className="text-[15px] font-semibold text-white/85">{t('providers.testTitle')}</h2><p className="mt-1 text-[12px] text-white/45">{t('providers.testDescription')}</p></div><RunwareProviderTest copy={providerTestCopy} /></section></>;
}

export function ModelsView({ result }: { result: AdminDataResult<AdminModelRow[]> }) {
  const t = useTranslations('Admin');
  return <><PageHeader title={t('models.title')} description={t('models.description')} />{!result.available && <Notice reason={result.reason} />}{result.data.length ? <TableFrame><table className="w-full min-w-[1050px] text-start text-[11.5px]"><thead className="border-b border-white/[0.07] text-white/35"><tr>{['provider','modelId','displayName','modality','state','providerCost','creditPrice','priority'].map((key) => <th key={key} className="px-4 py-3 font-medium">{t(`models.${key}`)}</th>)}</tr></thead><tbody>{result.data.map((row) => <tr key={row.key} className="border-b border-white/[0.05] last:border-0"><td className="px-4 py-3.5 text-white/60">{row.provider}</td><td className="max-w-72 px-4 py-3.5"><code dir="ltr" className="block truncate text-[10.5px] text-white/55" title={row.modelId}>{row.modelId}</code></td><td className="px-4 py-3.5 font-medium text-white/80">{row.displayName}</td><td className="px-4 py-3.5 text-white/55">{row.modality}</td><td className="px-4 py-3.5"><div className="flex gap-1.5"><Badge tone={row.enabled ? 'strong' : 'neutral'}>{t(row.enabled ? 'common.enabled' : 'common.disabled')}</Badge><Status value={row.availability} /></div></td><td className="px-4 py-3.5 text-white/50"><Cost value={row.providerCost} /></td><td className="px-4 py-3.5 text-white/60">{row.creditPrice == null ? t('common.unavailable') : t('common.credits', { value: row.creditPrice })}</td><td className="px-4 py-3.5"><Badge>{t(`role.${row.priority}`)}</Badge></td></tr>)}</tbody></table></TableFrame> : <Empty />}</>;
}

export function UsersView({ result }: { result: AdminDataResult<AdminUsersData> }) {
  const t = useTranslations('Admin');
  return <><PageHeader title={t('users.title')} description={t('users.description')} />{!result.available && <Notice reason={result.reason} />}<form action="/admin/users" method="get" className="mb-4 flex gap-2"><label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden="true" /><span className="sr-only">{t('users.search')}</span><input name="q" defaultValue={result.data.query} placeholder={t('users.search')} className="h-11 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] ps-10 pe-4 text-[13px] text-white outline-none placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-white/50" /></label><button className="h-11 rounded-xl bg-white px-4 text-[12.5px] font-semibold text-black transition-[background-color] duration-150 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none">{t('users.searchAction')}</button></form><div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-white/40"><span>{t('users.showing', { total: result.data.total })}</span><span>{t('users.safeActions')}</span></div>{result.data.truncated && <p className="mb-3 text-[11px] text-white/45">{t('users.truncated')}</p>}{result.data.users.length ? <TableFrame><table className="w-full min-w-[1100px] text-start text-[11.5px]"><thead className="border-b border-white/[0.07] text-white/35"><tr>{['email','plan','balance','usage','generations','status','created','lastSignIn'].map((key) => <th key={key} className="px-4 py-3 font-medium">{t(`users.${key}`)}</th>)}</tr></thead><tbody>{result.data.users.map((user) => <tr key={user.id} className="border-b border-white/[0.05] last:border-0"><td className="max-w-64 px-4 py-3.5"><p className="truncate text-white/75" title={user.email}>{user.email}</p><code dir="ltr" className="block truncate text-[9.5px] text-white/30">{user.id}</code></td><td className="px-4 py-3.5 text-white/60">{user.plan}</td><td className="px-4 py-3.5 tabular-nums text-white/65">{user.creditBalance ?? t('common.unavailable')}</td><td className="px-4 py-3.5 tabular-nums text-white/65">{user.creditsUsed}</td><td className="px-4 py-3.5 tabular-nums text-white/65">{user.generationCount}</td><td className="px-4 py-3.5"><Status value={user.status} /></td><td className="px-4 py-3.5 whitespace-nowrap text-white/45"><DateValue value={user.createdAt} /></td><td className="px-4 py-3.5 whitespace-nowrap text-white/45"><DateValue value={user.lastSignInAt} /></td></tr>)}</tbody></table></TableFrame> : <Empty />}</>;
}

export function JobsView({ result }: { result: AdminDataResult<AdminJobRow[]> }) {
  const t = useTranslations('Admin');
  return <><PageHeader title={t('jobs.title')} description={t('jobs.description')} />{!result.available && <Notice reason={result.reason} />}{result.data.length ? <TableFrame><table className="w-full min-w-[1200px] text-start text-[11.5px]"><thead className="border-b border-white/[0.07] text-white/35"><tr>{['time','source','user','modality','providerModel','status','cost','details'].map((key) => <th key={key} className="px-4 py-3 font-medium">{t(`jobs.${key}`)}</th>)}</tr></thead><tbody>{result.data.map((job) => <tr key={`${job.source}:${job.id}`} className="border-b border-white/[0.05] last:border-0"><td className="whitespace-nowrap px-4 py-3.5 text-white/45"><DateValue value={job.createdAt} /></td><td className="px-4 py-3.5"><Badge>{t(`jobs.${job.source}`)}</Badge></td><td className="max-w-36 px-4 py-3.5"><code dir="ltr" className="block truncate text-[9.5px] text-white/35" title={job.userId}>{job.userId}</code></td><td className="px-4 py-3.5 text-white/55">{job.modality}</td><td className="max-w-72 px-4 py-3.5"><p className="truncate text-white/60">{job.provider ?? t('common.unavailable')}</p><code dir="ltr" className="block truncate text-[10px] text-white/35" title={job.modelId}>{job.modelId}</code></td><td className="px-4 py-3.5"><Status value={job.status} /></td><td className="px-4 py-3.5 text-white/50"><Cost value={job.providerCost} /></td><td className="max-w-80 px-4 py-3.5"><p className="line-clamp-2 text-white/45" title={job.error ?? job.prompt ?? undefined}>{job.error ?? job.prompt ?? '—'}</p></td></tr>)}</tbody></table></TableFrame> : <Empty />}</>;
}

export function PaymentsView({ plans, result }: { plans: AdminDataResult<AdminPaymentPlan[]>; result: AdminDataResult<AdminPaymentRow[]> }) {
  const t = useTranslations('Admin');
  return <>
    <PageHeader title={t('payments.title')} description={t('payments.description')} />
    {!plans.available && <Notice reason={plans.reason} />}
    <AdminPaymentPlans plans={plans.data} />
    {!result.available && <Notice reason={result.reason} />}
    {result.data.length ? <TableFrame><table className="w-full min-w-[1500px] text-start text-[11.5px]">
      <thead className="border-b border-white/[0.07] text-white/35"><tr>
        {['created','user','amount','product','reference','submission','status','result','audit','actions'].map((key) => <th key={key} className="px-4 py-3 font-medium">{t(`payments.${key}`)}</th>)}
      </tr></thead>
      <tbody>{result.data.map((payment) => <tr key={payment.id} className="border-b border-white/[0.05] align-top last:border-0">
        <td className="whitespace-nowrap px-4 py-3.5 text-white/45"><DateValue value={payment.createdAt} /></td>
        <td className="max-w-64 px-4 py-3.5"><p className="truncate text-white/75" title={payment.userEmail}>{payment.userEmail}</p><code dir="ltr" className="block truncate text-[9.5px] text-white/30">{payment.userId}</code></td>
        <td className="whitespace-nowrap px-4 py-3.5 font-medium text-white/75" dir="ltr">{payment.amountDzd.toLocaleString()} DA{payment.creditsAmount ? <span className="block text-[10px] font-normal text-white/40">{t('payments.credits', { value: payment.creditsAmount })}</span> : null}</td>
        <td className="px-4 py-3.5 text-white/60"><p>{payment.planName}</p><Badge>{t(`payments.${payment.orderKind}`)}</Badge></td>
        <td className="px-4 py-3.5"><code dir="ltr" className="text-white/65">{payment.paymentReference}</code></td>
        <td className="max-w-60 px-4 py-3.5 text-white/55"><p className="break-words">{payment.customerReference ?? t('common.unavailable')}</p>{payment.proofUrl ? <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-white underline underline-offset-4">{t('payments.viewProof')}</a> : <span className="mt-1 block text-white/30">{t('payments.noProof')}</span>}</td>
        <td className="px-4 py-3.5"><Status value={payment.status} />{payment.submittedAt && <p className="mt-1.5 whitespace-nowrap text-[10px] text-white/35"><DateValue value={payment.submittedAt} /></p>}</td>
        <td className="max-w-56 px-4 py-3.5 text-white/45">{payment.resultingCreditTransactionId ? <code dir="ltr" className="block truncate text-[9.5px]" title={payment.resultingCreditTransactionId}>{payment.resultingCreditTransactionId}</code> : payment.resultingEntitlementId ? <code dir="ltr" className="block truncate text-[9.5px]" title={payment.resultingEntitlementId}>{payment.resultingEntitlementId}</code> : '—'}</td>
        <td className="max-w-56 px-4 py-3.5 text-white/45">{payment.audit.length ? payment.audit.map((event) => <p key={event.id} className="mb-1"><span className="text-white/65">{t.has(`status.${event.action}`) ? t(`status.${event.action}`) : event.action}</span> · <DateValue value={event.createdAt} /></p>) : '—'}</td>
        <td className="px-4 py-3.5">{payment.status === 'pending' && payment.submittedAt ? <AdminPaymentActions paymentId={payment.id} /> : <span className="text-white/30">—</span>}</td>
      </tr>)}</tbody>
    </table></TableFrame> : <Empty label={t('payments.noPayments')} />}
  </>;
}
