'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ChevronDown, ChevronRight, CreditCard, Database, ExternalLink, ImageIcon, Search, UserRound, X } from 'lucide-react';
import RunwareProviderTest, { type ProviderTestCopy } from '@/src/components/internal/RunwareProviderTest';
import AdminPaymentActions from './AdminPaymentActions';
import AdminPaymentPlans from './AdminPaymentPlans';
import AdminUserActions from './AdminUserActions';
import AdminCreditAdjustment from './AdminCreditAdjustment';
import AdminModelControls from './AdminModelControls';
import AdminProviderControls from './AdminProviderControls';
import AdminModelRouteControls from './AdminModelRouteControls';
import AdminModelPresentationControls from './AdminModelPresentationControls';
import AdminModelCapabilitiesControls from './AdminModelCapabilitiesControls';
import AdminModelCreate from './AdminModelCreate';
import AdminProviderCreate from './AdminProviderCreate';
import AdminModelLifecycleControls from './AdminModelLifecycleControls';
import type {
  AdminAuditRow, AdminDataResult, AdminJobRow, AdminJobsData, AdminModelRow, AdminPaymentRow,
  AdminPaymentPlan, AdminProviderRow, AdminUserRow, AdminUsersData, CostAmount,
} from '@/lib/admin/types';
import { isMissingCustomerPricing } from '@/lib/admin/model-economics';

function PageHeader({ title, description, children, compact = false }: { title: string; description: string; children?: React.ReactNode; compact?: boolean }) {
  return <header className={`${compact ? 'mb-3' : 'mb-5'} flex flex-wrap items-end justify-between gap-3 text-start`}>
    <div className="min-w-0"><h1 className="text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[30px]">{title}</h1><p className="mt-1 max-w-3xl text-[13px] leading-snug text-[var(--studio-text-secondary)]">{description}</p></div>
    {children}
  </header>;
}

function Notice({ reason }: { reason?: 'not_configured' | 'query_failed' }) {
  const t = useTranslations('Admin.common');
  return <div role="status" className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-300/20 bg-amber-300/[0.055] px-3 py-2.5 text-start text-[12px] leading-snug text-amber-50/90"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" /><span>{t(reason === 'query_failed' ? 'queryFailed' : 'notConfigured')}</span></div>;
}

function Empty({ label, action }: { label?: string; action?: React.ReactNode }) {
  const t = useTranslations('Admin.common');
  return <div className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--studio-border)] bg-white/[0.018] px-4 py-5 text-center"><Database className="h-5 w-5 text-[var(--studio-text-muted)]" aria-hidden="true" /><p className="mt-2 max-w-xl text-[12px] leading-snug text-[var(--studio-text-secondary)]">{label ?? t('noData')}</p>{action && <div className="mt-3">{action}</div>}</div>;
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
  return <div className="max-w-full overflow-hidden rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.95)] [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-150 [&_tbody_tr:hover]:bg-white/[0.03] [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-middle [&_th]:h-8 [&_th]:bg-white/[0.03] [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.07em] [&_th]:text-[var(--studio-text-secondary)]">{children}</div>;
}

const adminTableClass = 'w-full table-fixed text-start text-[12px]';

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

function DateValue({ value, compact = false }: { value: string | null; compact?: boolean }) {
  const locale = useLocale();
  const t = useTranslations('Admin.common');
  if (!value) return <span>{t('never')}</span>;
  return <time dateTime={value}>{new Intl.DateTimeFormat(locale, { dateStyle: compact ? 'short' : 'medium', timeStyle: 'short' }).format(new Date(value))}</time>;
}

function Status({ value }: { value: string }) {
  const t = useTranslations('Admin.status');
  const translated = t.has(value) ? t(value) : value;
  const danger = ['failed', 'attention', 'misconfigured', 'unavailable', 'suspended', 'rejected'].includes(value);
  const warning = ['pending', 'unconfirmed', 'temporarily_unavailable'].includes(value);
  const success = ['healthy', 'ready', 'completed', 'active', 'available', 'approved'].includes(value);
  return <Badge tone={danger ? 'danger' : warning ? 'warning' : success ? 'success' : 'neutral'}>{translated}</Badge>;
}

function humanizeIdentifier(value: string) {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function TechnicalId({ label, value }: { label: string; value: string }) {
  return <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--studio-text-muted)]"><span className="shrink-0 font-medium">{label}:</span><code dir="ltr" className="truncate" title={value}>{value}</code></p>;
}

function TechnicalDetails({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Admin.common');
  return <details className="mt-1.5"><summary className="w-fit cursor-pointer rounded text-[10.5px] font-medium text-[var(--studio-text-muted)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">{t('technicalDetails')}</summary><div className="mt-1.5 rounded-lg border border-[var(--studio-border-subtle)] bg-black/20 p-2">{children}</div></details>;
}

function DetailDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useTranslations('Admin.common');
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} onClose={onClose} onClick={(event) => { if (event.target === ref.current) ref.current?.close(); }} aria-label={title} className="fixed inset-y-0 end-0 m-0 ms-auto h-dvh max-h-dvh w-full max-w-[600px] overflow-y-auto border-s border-[var(--studio-border)] bg-[var(--studio-surface)] p-0 text-white shadow-2xl backdrop:bg-black/70">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--studio-border)] bg-[var(--studio-surface)] px-4 py-3"><h2 className="truncate text-[17px] font-semibold">{title}</h2><button type="button" onClick={() => ref.current?.close()} aria-label={t('close')} className="rounded-lg p-2 text-[var(--studio-text-secondary)] hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"><X className="h-4 w-4" /></button></div>
    <div className="p-4">{children}</div>
  </dialog>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-2.5 text-start shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-secondary)]">{label}</p><p className="mt-1.5 text-[22px] font-bold leading-none tabular-nums tracking-[-0.03em] text-white">{value ?? '—'}</p></div>;
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return <div className="mb-3 text-start"><h2 className="text-[17px] font-semibold tracking-[-0.02em] text-white">{title}</h2>{description && <p className="mt-0.5 max-w-3xl text-[12px] leading-snug text-[var(--studio-text-secondary)]">{description}</p>}</div>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-[var(--studio-border-subtle)] bg-black/15 p-3"><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-secondary)]">{title}</h3><div className="space-y-2 text-[12.5px]">{children}</div></section>;
}

export function ProvidersView({ result }: { result: AdminDataResult<AdminProviderRow[]> }) {
  const t = useTranslations('Admin');
  const [providers, setProviders] = useState(result.data);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'models' | 'runtime' | 'diagnostics'>('overview');
  useEffect(() => setProviders(result.data), [result.data]);
  const configured = providers.filter((row) => row.enabled).length;
  const attention = providers.filter((row) => row.status === 'misconfigured' || row.status === 'unavailable').length;
  const selected = providers.find((row) => row.id === editingProvider);
  const providerTestCopy: ProviderTestCopy = {
    provider: t('providerTest.provider'), prompt: t('providerTest.prompt'), promptPlaceholder: t('providerTest.promptPlaceholder'), generate: t('providerTest.generate'), generating: t('providerTest.generating'), result: t('providerTest.result'), resultAlt: t('providerTest.resultAlt'), summary: t('providerTest.summary'), summaryHelp: t('providerTest.summaryHelp'), emptyTitle: t('providerTest.emptyTitle'), emptyDescription: t('providerTest.emptyDescription'), genericError: t('providerTest.genericError'),
  };
  return <><PageHeader title={t('providers.title')} description={t('providers.description')} compact><div className="flex gap-2"><Badge>{t('providers.configuredCount', { count: configured })}</Badge>{attention > 0 && <Badge tone="danger">{t('providers.attentionCount', { count: attention })}</Badge>}</div></PageHeader>{!result.available && <Notice reason={result.reason} />}
    <AdminProviderCreate />
    {providers.length ? <TableFrame><table className={adminTableClass}>
      <thead className="border-b border-[var(--studio-border)]"><tr><th className="w-[20%]">{t('providers.name')}</th><th className="w-[14%]">{t('providers.modality')}</th><th className="w-[12%]">{t('providers.health')}</th><th className="w-[12%]">{t('providers.routing')}</th><th className="w-[8%] text-end">{t('providers.models')}</th><th className="w-[14%] text-end">{t('providers.cost')}</th><th className="w-[8%] text-end">{t('providers.failures')}</th><th className="w-[12%]">{t('providers.lastActivity')}</th></tr></thead>
      <tbody>{providers.map((row) => <tr key={row.id} className="border-b border-[var(--studio-border-subtle)] last:border-0"><td><button type="button" onClick={() => { setEditingProvider(row.id); setTab('overview'); }} className="max-w-full truncate text-start font-semibold text-white hover:underline focus-visible:ring-2 focus-visible:ring-white/50">{row.name}</button></td><td className="truncate text-[var(--studio-text-secondary)]" title={row.modalities.join(', ')}>{row.modalities.map((value) => t.has(`modality.${value}`) ? t(`modality.${value}`) : value).join(' · ')}</td><td><Status value={row.status} /></td><td><Badge tone={row.enabled && !row.emergencyDisabled ? 'success' : 'neutral'}>{t(row.enabled && !row.emergencyDisabled ? 'common.enabled' : 'common.disabled')}</Badge></td><td className="text-end tabular-nums">{row.associatedModels.length}</td><td className="text-end tabular-nums text-[var(--studio-text-secondary)]">{row.accumulatedCosts.length ? row.accumulatedCosts.map((cost) => <div key={cost.currency}><Cost value={cost} /></div>) : '—'}</td><td className={`text-end tabular-nums ${row.failures ? 'text-red-100' : 'text-[var(--studio-text-secondary)]'}`}>{row.failures}</td><td className="text-[var(--studio-text-secondary)]"><DateValue value={row.lastActivityAt} compact /></td></tr>)}</tbody>
    </table></TableFrame> : <Empty label={t('providers.noProviders')} />}
    {selected && <DetailDrawer title={selected.name} onClose={() => setEditingProvider(null)}><div className="mb-3 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{(['overview', 'models', 'runtime', 'diagnostics'] as const).map((value) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`min-h-8 shrink-0 rounded-lg border px-2.5 text-[11px] font-medium ${tab === value ? 'border-white bg-white text-black' : 'border-[var(--studio-border)] text-[var(--studio-text-secondary)]'}`}>{t(`providers.tabs.${value}`)}</button>)}</div>
      {tab === 'overview' && <div className="space-y-3 text-[13px]"><p><strong>{t('providers.health')}:</strong> <Status value={selected.status} /></p><p><strong>Adapter:</strong> {selected.adapterType}</p><p><strong>Credential:</strong> <Badge tone={selected.configured ? 'success' : 'warning'}>{selected.configured ? 'Configured' : 'Missing'}</Badge></p><p><strong>{t('providers.routing')}:</strong> {t(selected.enabled && !selected.emergencyDisabled ? 'common.enabled' : 'common.disabled')}</p><p><strong>{t('providers.requests')}:</strong> <span className="tabular-nums">{selected.requestCount}</span></p><p><strong>Routes:</strong> <span className="tabular-nums">{selected.routeCount}</span></p><p><strong>{t('providers.failures')}:</strong> <span className="tabular-nums">{selected.failures}</span></p><p><strong>{t('providers.cost')}:</strong> {selected.accumulatedCosts.length ? selected.accumulatedCosts.map((cost) => <span key={cost.currency} className="ms-2"><Cost value={cost} /></span>) : '—'}</p><p><strong>{t('providers.lastActivity')}:</strong> <DateValue value={selected.lastActivityAt} /></p>{selected.lastError && <p className="text-red-100">{selected.lastError}</p>}<TechnicalDetails><TechnicalId label={t('common.internalId')} value={selected.id} />{selected.baseEndpoint && <TechnicalId label="Base endpoint" value={selected.baseEndpoint} />}</TechnicalDetails></div>}
      {tab === 'models' && <div className="space-y-2">{selected.associatedModels.length ? selected.associatedModels.map((model) => <div key={`${model.key}:${model.providerModelId}`} className="rounded-lg border border-[var(--studio-border)] px-3 py-2"><p className="text-[13px] font-semibold text-white">{model.name}</p><TechnicalDetails><TechnicalId label={t('common.internalId')} value={model.key} /><TechnicalId label={t('models.providerModelId')} value={model.providerModelId} /></TechnicalDetails></div>) : <Empty label={t('common.noneRecorded')} />}<Link href="/admin/models" prefetch={false} className="inline-block pt-2 text-[12px] underline">{t('nav.models')}</Link></div>}
      {tab === 'runtime' && <AdminProviderControls provider={selected} onSaved={(config) => setProviders((current) => current.map((item) => item.id === config.providerId ? { ...item, name: config.displayName, adapterType: config.adapterType, baseEndpoint: config.baseEndpoint, archived: config.archived, enabled: config.enabled, configured: config.configured, priority: config.priority, emergencyDisabled: config.emergencyDisabled, dailySpendLimitMinor: config.dailySpendLimitMinor, spendCurrency: config.spendCurrency, role: config.enabled && !config.emergencyDisabled ? (config.priority <= 20 ? 'primary' : 'backup') : 'unassigned', status: config.archived || !config.enabled ? 'disabled' : !config.configured ? 'misconfigured' : 'ready' } : item))} />}
      {tab === 'diagnostics' && <div className="space-y-3"><div className="grid gap-2 sm:grid-cols-2"><Metric label={t('providers.requests')} value={selected.requestCount} /><Metric label={t('providers.failures')} value={selected.failures} /><Metric label={t('providers.latency')} value={selected.averageLatencyMs == null ? '—' : t('common.milliseconds', { value: selected.averageLatencyMs })} /><Metric label={t('providers.lastActivity')} value={<span className="text-[13px]"><DateValue value={selected.lastActivityAt} compact /></span>} /></div>{selected.lastError && <div className="rounded-lg border border-red-400/20 bg-red-400/[0.05] p-3 text-[12px] text-red-100"><strong>{t('providers.lastError')}:</strong> {selected.lastError}</div>}{selected.id === 'runware' ? <><p className="text-[12px] text-[var(--studio-text-secondary)]">{t('providers.testDescription')}</p><RunwareProviderTest copy={providerTestCopy} /></> : <p className="text-[12px] text-[var(--studio-text-secondary)]">{t('providers.noDiagnostics')}</p>}</div>}
    </DetailDrawer>}</>;
}

export function ModelsView({ result }: { result: AdminDataResult<AdminModelRow[]> }) {
  const t = useTranslations('Admin');
  const [filter, setFilter] = useState('all');
  const [models, setModels] = useState(result.data);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'presentation' | 'capabilities' | 'pricing' | 'routes'>('overview');
  useEffect(() => setModels(result.data), [result.data]);
  const filterOptions = ['all', 'enabled', 'primary', 'image', 'chat', 'video', 'missingPricing', 'preview', 'notInStudio'] as const;
  const counts = {
    total: models.length,
    enabled: models.filter((row) => row.enabled).length,
    primary: models.filter((row) => row.priority === 'primary').length,
    missingPricing: models.filter(isMissingCustomerPricing).length,
    unknownProviderCost: models.filter((row) => row.providerCostState === 'unknown').length,
    preview: models.filter((row) => row.availability === 'preview').length,
  };
  const filtered = useMemo(() => models.filter((row) => {
    if (filter === 'enabled') return row.enabled;
    if (filter === 'primary') return row.priority === 'primary';
    if (['image', 'chat', 'video'].includes(filter)) return row.modality === filter;
    if (filter === 'missingPricing') return isMissingCustomerPricing(row);
    if (filter === 'preview') return row.availability === 'preview';
    if (filter === 'notInStudio') return row.availability === 'not_in_studio';
    return true;
  }), [filter, models]);
  const selected = models.find((row) => row.key === editingKey);
  return <><PageHeader title={t('models.title')} description={t('models.description')} />{!result.available && <Notice reason={result.reason} />}
    <AdminModelCreate />
    <section aria-label={t('models.summary')} className="mb-3 grid grid-cols-3 gap-1.5 xl:grid-cols-6">{(['total','enabled','primary','missingPricing','unknownProviderCost','preview'] as const).map((key) => <div key={key} className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-2.5 py-2 text-start"><p className="truncate text-[9.5px] font-semibold uppercase tracking-[0.07em] text-[var(--studio-text-secondary)]" title={t(`models.summary${key[0].toUpperCase()}${key.slice(1)}`)}>{t(`models.summary${key[0].toUpperCase()}${key.slice(1)}`)}</p><p className="mt-0.5 text-base font-bold tabular-nums text-white">{counts[key]}</p></div>)}</section>
    <div role="group" aria-label={t('models.filterLabel')} className="mb-3 flex gap-1.5 overflow-x-auto rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{filterOptions.map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-8 shrink-0 rounded-lg border px-2.5 text-[11px] font-semibold transition-[background-color,border-color,color] duration-150 motion-reduce:transition-none ${filter === value ? 'border-white bg-white text-black' : 'border-transparent text-[var(--studio-text-secondary)] hover:border-[var(--studio-border)] hover:bg-white/[0.04] hover:text-white'}`}>{t(`models.filters.${value}`)}</button>)}</div>
    {filtered.length ? <TableFrame><table className={adminTableClass}>
      <thead className="border-b border-[var(--studio-border)]"><tr><th className="w-[22%]">{t('models.displayName')}</th><th className="w-[10%]">{t('models.modality')}</th><th className="w-[12%]">{t('models.studio')}</th><th className="w-[12%]">{t('models.state')}</th><th className="w-[17%] text-end">{t('models.pricing')}</th><th className="w-[16%]">{t('models.routeStatus')}</th><th className="w-[11%]">{t('models.health')}</th></tr></thead>
      <tbody>{filtered.map((row) => <tr key={row.key} className="border-b border-[var(--studio-border-subtle)] last:border-0"><td><button type="button" onClick={() => { setEditingKey(row.key); setTab('overview'); }} className="max-w-full truncate text-start font-semibold text-white hover:underline focus-visible:ring-2 focus-visible:ring-white/50">{row.displayName}</button></td><td className="text-[var(--studio-text-secondary)]">{t.has(`modality.${row.modality}`) ? t(`modality.${row.modality}`) : row.modality}</td><td><Badge tone={row.visibleInStudio ? 'success' : 'neutral'}>{t(row.visibleInStudio ? 'common.visible' : 'common.hidden')}</Badge></td><td><Badge tone={row.enabled ? 'success' : 'neutral'}>{t(row.enabled ? 'common.enabled' : 'common.disabled')}</Badge></td><td className="text-end font-semibold tabular-nums text-white">{isMissingCustomerPricing(row) ? t('common.noPrice') : t('common.credits', { value: row.creditPrice })}</td><td className="truncate text-[var(--studio-text-secondary)]">{row.routes.filter((route) => route.enabled && route.configured && route.providerEnabled).length ? row.routes.filter((route) => route.enabled && route.configured && route.providerEnabled).map((route) => route.providerId).join(', ') : t('models.noActiveRoute')}</td><td><Status value={row.availability} /></td></tr>)}</tbody>
    </table></TableFrame> : <Empty label={t('models.noMatches')} />}
    {selected && <DetailDrawer title={selected.displayName} onClose={() => setEditingKey(null)}><div className="mb-3 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{(['overview', 'presentation', 'capabilities', 'pricing', 'routes'] as const).map((value) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`min-h-8 shrink-0 rounded-lg border px-2.5 text-[11px] font-medium ${tab === value ? 'border-white bg-white text-black' : 'border-[var(--studio-border)] text-[var(--studio-text-secondary)]'}`}>{t(`models.tabs.${value}`)}</button>)}</div>
      {tab === 'overview' && <div className="space-y-3 text-[12.5px]"><div className="flex items-start gap-3"><span role="img" aria-label={selected.displayName} className="h-12 w-12 shrink-0 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] bg-contain bg-center bg-no-repeat" style={selected.mediaUrl ? { backgroundImage: `url(${JSON.stringify(selected.mediaUrl)})` } : undefined} /><div className="min-w-0"><p className="font-semibold text-white">{selected.displayName}</p><p className="mt-1 text-[var(--studio-text-secondary)]">{selected.shortDescription || t('common.noneRecorded')}</p></div></div><div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg border border-[var(--studio-border-subtle)] p-2.5"><p className="text-[10px] uppercase tracking-wide text-[var(--studio-text-muted)]">{t('models.modality')}</p><p className="mt-1 font-semibold text-white">{t.has(`modality.${selected.modality}`) ? t(`modality.${selected.modality}`) : selected.modality}</p></div><div className="rounded-lg border border-[var(--studio-border-subtle)] p-2.5"><p className="text-[10px] uppercase tracking-wide text-[var(--studio-text-muted)]">{t('models.studio')}</p><p className="mt-1 font-semibold text-white">{selected.archived ? 'Archived' : t(selected.visibleInStudio ? 'common.visible' : 'common.hidden')}</p></div><div className="rounded-lg border border-[var(--studio-border-subtle)] p-2.5"><p className="text-[10px] uppercase tracking-wide text-[var(--studio-text-muted)]">{t('models.pricing')}</p><p className="mt-1 font-semibold text-white">{isMissingCustomerPricing(selected) ? t('common.noPrice') : t('common.credits', { value: selected.creditPrice })}</p></div><div className="rounded-lg border border-[var(--studio-border-subtle)] p-2.5"><p className="text-[10px] uppercase tracking-wide text-[var(--studio-text-muted)]">{t('models.providerCost')}</p><p className="mt-1 font-semibold text-white"><ProviderEconomics row={selected} /></p></div></div><TechnicalDetails><TechnicalId label={t('common.modelId')} value={selected.modelId} /><TechnicalId label={t('common.internalId')} value={selected.key} /></TechnicalDetails><AdminModelLifecycleControls modelKey={selected.key} archived={selected.archived} /></div>}
      {tab === 'presentation' && <AdminModelPresentationControls model={selected} onSaved={(presentation) => setModels((current) => current.map((item) => item.key === selected.key ? { ...item, displayName: presentation.displayName, shortDescription: presentation.shortDescription, mediaUrl: presentation.mediaUrl, category: presentation.category, sortOrder: presentation.sortOrder, visibleInStudio: presentation.visibleInStudio, availabilityLabel: presentation.availabilityLabel, updatedAt: presentation.updatedAt, persisted: true } : item))} />}
      {tab === 'capabilities' && <AdminModelCapabilitiesControls model={selected} onSaved={(capabilities, updatedAt) => setModels((current) => current.map((item) => item.key === selected.key ? { ...item, capabilities, updatedAt, persisted: true } : item))} />}
      {tab === 'pricing' && <AdminModelControls model={selected} mode="pricing" onSaved={(config) => setModels((current) => current.map((item) => item.key === config.modelKey ? { ...item, enabled: config.enabled, priority: config.routingRole, creditPrice: config.customerCreditPrice, allowedPlans: config.allowedPlans, persisted: true, updatedAt: config.updatedAt } : item))} />}
      {tab === 'routes' && <div className="space-y-3"><AdminModelControls model={selected} mode="routing" onSaved={(config) => setModels((current) => current.map((item) => item.key === config.modelKey ? { ...item, enabled: config.enabled, priority: config.routingRole, creditPrice: config.customerCreditPrice, allowedPlans: config.allowedPlans, persisted: true, updatedAt: config.updatedAt } : config.routingRole === 'primary' && item.modality === selected.modality && item.priority === 'primary' ? { ...item, priority: 'unassigned' } : item))} /><AdminModelRouteControls modelKey={selected.key} routes={selected.routes} providerOptions={selected.providerOptions} onCreated={(createdRoute) => setModels((current) => current.map((item) => item.key === selected.key ? { ...item, routes: [...item.routes, createdRoute] } : item))} onSaved={(savedRoute) => setModels((current) => current.map((item) => item.key === selected.key ? { ...item, routes: item.routes.map((route) => route.id === savedRoute.id ? { ...route, ...savedRoute } : route) } : item))} /></div>}
    </DetailDrawer>}</>;
}

function UserMediaSummary({ user }: { user: AdminUserRow }) {
  const plan = user.plan.toLowerCase();
  if (plan === 'free') return <><p className="font-medium tabular-nums text-white">Images {user.freeImageRemaining ?? '—'} / 5</p><p className="mt-0.5 text-[10.5px] tabular-nums text-[var(--studio-text-muted)]">Videos {user.freeVideoRemaining ?? '—'} / 1 · lifetime</p></>;
  if (plan === 'lite') return <><p className="font-medium tabular-nums text-white">{user.subscriptionBalance ?? '—'} subscription Credits</p><p className="mt-0.5 text-[10.5px] tabular-nums text-[var(--studio-text-muted)]">{user.liteVideoRemaining ?? '—'} included Videos remaining</p></>;
  if (plan === 'pro') return <><p className="font-medium tabular-nums text-white">{user.creditBalance ?? '—'} usable Credits</p><p className="mt-0.5 text-[10.5px] text-[var(--studio-text-muted)]">Subscription + purchased</p></>;
  return <><p className="font-medium tabular-nums text-white">{user.generationCount.toLocaleString()} generations</p><p className="mt-0.5 text-[10.5px] tabular-nums text-[var(--studio-text-muted)]">{user.creditsUsed} credits used</p></>;
}

export function UsersView({ result }: { result: AdminDataResult<AdminUsersData> }) {
  const t = useTranslations('Admin');
  const [users, setUsers] = useState(result.data.users);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  useEffect(() => setUsers(result.data.users), [result.data.users]);
  const selected = users.find((user) => user.id === selectedId);
  const planOptions = useMemo(() => [...new Set(users.map((user) => user.plan))].sort(), [users]);
  const filteredUsers = useMemo(() => {
    const now = Date.now();
    return users.filter((user) => {
      if (planFilter !== 'all' && user.plan !== planFilter) return false;
      if (statusFilter !== 'all' && user.status !== statusFilter) return false;
      const lastActive = user.lastSignInAt ? Date.parse(user.lastSignInAt) : null;
      if (activityFilter === '7d' && (!lastActive || now - lastActive > 7 * 86_400_000)) return false;
      if (activityFilter === '30d' && (!lastActive || now - lastActive > 30 * 86_400_000)) return false;
      if (activityFilter === 'never' && lastActive) return false;
      return true;
    });
  }, [activityFilter, planFilter, statusFilter, users]);
  const initials = (email: string) => email.split('@')[0].split(/[._-]+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase()).join('') || 'U';
  const relativeActivity = (value: string | null) => {
    if (!value) return 'Never';
    const elapsed = Math.max(0, Date.now() - Date.parse(value));
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };
  const selectClass = 'h-11 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 text-[12px] text-white outline-none focus-visible:border-[var(--studio-border-strong)]';

  return <><PageHeader title="Users" description="Manage accounts, subscriptions, usage, and customer activity." />{!result.available && <Notice reason={result.reason} />}
    <form action="/admin/users" method="get" className="mb-5 grid items-end gap-3 lg:grid-cols-[minmax(320px,1fr)_174px_174px_180px]">
      <label className="relative min-w-0"><Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--studio-text-muted)]" aria-hidden="true" /><span className="sr-only">Search users</span><input name="q" defaultValue={result.data.query} placeholder="Search users by email or user ID..." className="h-11 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] ps-11 pe-3 text-[12px] text-white outline-none placeholder:text-[var(--studio-text-muted)] focus-visible:border-[var(--studio-border-strong)]" /></label>
      <label className="text-start"><span className="mb-1 block text-[10.5px] font-medium text-[var(--studio-text-secondary)]">Plan</span><select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)} className={selectClass}><option value="all">All plans</option>{planOptions.map((plan) => <option key={plan} value={plan}>{plan}</option>)}</select></label>
      <label className="text-start"><span className="mb-1 block text-[10.5px] font-medium text-[var(--studio-text-secondary)]">Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={selectClass}><option value="all">All statuses</option><option value="active">Active</option><option value="unconfirmed">Unconfirmed</option><option value="suspended">Suspended</option></select></label>
      <label className="text-start"><span className="mb-1 block text-[10.5px] font-medium text-[var(--studio-text-secondary)]">Activity</span><select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)} className={selectClass}><option value="all">All activity</option><option value="7d">Active in 7 days</option><option value="30d">Active in 30 days</option><option value="never">Never active</option></select></label>
      <button type="submit" className="sr-only">Search</button>
    </form>
    <div className="mb-3 text-start text-[12px] text-[var(--studio-text-secondary)]">{filteredUsers.length.toLocaleString()} {filteredUsers.length === 1 ? 'user' : 'users'}</div>
    {result.data.truncated && <p className="mb-3 text-[11px] text-[var(--studio-text-muted)]">{t('users.truncated')}</p>}
    {filteredUsers.length ? <div className="overflow-x-auto rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)]"><table className="w-full min-w-[820px] table-fixed text-start text-[12px]">
      <colgroup><col className="w-[31%]" /><col className="w-[12%]" /><col className="w-[16%]" /><col className="w-[23%]" /><col className="w-[18%]" /></colgroup>
      <thead className="border-b border-[var(--studio-border)] bg-white/[0.025]"><tr>{['User', 'Plan', 'Status', 'Media', 'Last Active'].map((label) => <th key={label} className="h-10 px-5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-secondary)]">{label}</th>)}</tr></thead>
      <tbody>{filteredUsers.map((user) => <tr key={user.id} tabIndex={0} onClick={() => setSelectedId(user.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(user.id); } }} className="group cursor-pointer border-b border-[var(--studio-border-subtle)] outline-none transition-colors last:border-0 hover:bg-white/[0.035] focus-visible:bg-white/[0.045]">
        <td className="px-5 py-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.08] text-[11px] font-medium text-white">{initials(user.email)}</span><div className="min-w-0"><p className="truncate font-semibold text-white">{user.email}</p>{user.isOwner && <p className="mt-0.5 text-[10.5px] text-[var(--studio-text-muted)]">Owner</p>}</div></div></td>
        <td className="px-5 py-3 font-medium text-white">{user.plan}</td>
        <td className="px-5 py-3"><Status value={user.status} /></td>
        <td className="px-5 py-3"><UserMediaSummary user={user} /></td>
        <td className="px-5 py-3"><div className="flex items-center justify-between gap-3"><span className="text-[var(--studio-text-secondary)]">{relativeActivity(user.lastSignInAt)}</span><ChevronRight className="h-4 w-4 shrink-0 text-[var(--studio-text-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></div></td>
      </tr>)}</tbody>
    </table></div> : <Empty label={users.length ? 'No users match these filters.' : result.data.query ? t('users.noMatches') : t('users.noUsers')} />}
    {selected && <AdminUserDetail key={selected.id} user={selected} onClose={() => setSelectedId(null)} onStatusChanged={(nextStatus) => setUsers((current) => current.map((item) => item.id === selected.id ? { ...item, status: nextStatus } : item))} onCreditChanged={(creditBalance) => setUsers((current) => current.map((item) => item.id === selected.id ? { ...item, creditBalance } : item))} />}</>;
}

type UserDetailData = {
  balances: {
    balance: string;
    subscription_balance: string;
    subscription_rollover_balance: string;
    purchased_balance: string;
    free_image_remaining: number;
    free_video_remaining: number;
    lite_video_remaining: number;
  } | null;
  entitlements: { id: string; plan_name: string; status: string; starts_at: string; ends_at: string | null }[];
  ledger: { id: string; transaction_type: string; amount: string; reason: string; created_at: string }[];
  payments: { id: string; plan_name: string; status: string; amount_dzd: number; created_at: string }[];
  jobs: { id: string; model_id: string; modality: string; state: string; credits_charged: string | null; created_at: string }[];
  audit: { id: string; payment_order_id: string; action: string; created_at: string }[];
};

function UserOverviewSection({ icon, title, description, children }: {
  icon: React.ReactNode; title: string; description: string; children: React.ReactNode;
}) {
  return <section className="grid gap-4 border-b border-[var(--studio-border-subtle)] py-6 last:border-0 sm:grid-cols-[180px_minmax(0,1fr)]">
    <div className="flex items-start gap-3 text-start"><span className="mt-0.5 text-white">{icon}</span><div><h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-white">{title}</h3><p className="mt-1 text-[11px] leading-relaxed text-[var(--studio-text-muted)]">{description}</p></div></div>
    <div className="min-w-0">{children}</div>
  </section>;
}

function UserOverviewField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid min-h-10 items-center gap-2 border-b border-[var(--studio-border-subtle)] py-2 last:border-0 sm:grid-cols-[145px_minmax(0,1fr)]"><span className="text-[11.5px] text-[var(--studio-text-secondary)]">{label}</span><div className="min-w-0 text-[12px] font-medium text-white">{children}</div></div>;
}

function isPositiveStoredBalance(value: string | null) {
  if (value === null) return false;
  try { return BigInt(value) > 0n; } catch { return false; }
}

function AdminUserDetail({ user, onClose, onStatusChanged, onCreditChanged }: {
  user: AdminUserRow; onClose: () => void;
  onStatusChanged: (status: AdminUserRow['status']) => void;
  onCreditChanged: (balance: string) => void;
}) {
  const t = useTranslations('Admin');
  const drawerRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<'overview' | 'subscription' | 'credits' | 'payments' | 'jobs' | 'security' | 'audit'>('overview');
  const [data, setData] = useState<UserDetailData | null>(null);
  const [balance, setBalance] = useState(user.creditBalance);
  const [error, setError] = useState(false);
  useEffect(() => {
    const drawer = drawerRef.current;
    drawer?.showModal();
    return () => { if (drawer?.open) drawer.close(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/users/${user.id}/detail`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error('USER_DETAIL_QUERY_FAILED'); return response.json(); })
      .then((body: UserDetailData) => setData(body))
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [user.id]);
  const tabs = ['overview', 'subscription', 'credits', 'payments', 'jobs', 'security', 'audit'] as const;
  const tabLabels = { overview: 'Overview', subscription: 'Subscription', credits: 'Credits & Ledger', payments: 'Payments', jobs: 'Jobs', security: 'Security', audit: 'Audit' } as const;
  const currentEntitlement = data?.entitlements.find((item) => item.status === 'active'
    && (!item.ends_at || Date.parse(item.ends_at) > Date.now())) ?? data?.entitlements[0] ?? null;
  const recentImages = data?.jobs.filter((item) => item.modality === 'image').length ?? null;
  const recentVideos = data?.jobs.filter((item) => item.modality === 'video').length ?? null;
  const plan = user.plan.toLowerCase();
  const usageBalances = data?.balances ?? {
    balance: user.creditBalance,
    subscription_balance: user.subscriptionBalance,
    subscription_rollover_balance: user.subscriptionRolloverBalance,
    purchased_balance: user.purchasedBalance,
    free_image_remaining: user.freeImageRemaining,
    free_video_remaining: user.freeVideoRemaining,
    lite_video_remaining: user.liteVideoRemaining,
  };
  const avatar = user.email.split('@')[0].split(/[._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U';

  return <dialog ref={drawerRef} onClose={onClose} onClick={(event) => { if (event.target === drawerRef.current) drawerRef.current?.close(); }} aria-label={`User details for ${user.email}`} className="fixed inset-y-0 end-0 m-0 ms-auto h-dvh max-h-dvh w-full max-w-[760px] overflow-y-auto border-s border-[var(--studio-border)] bg-[var(--studio-surface)] p-0 text-white shadow-2xl backdrop:bg-black/75">
    <div className="sticky top-0 z-20 border-b border-[var(--studio-border)] bg-[var(--studio-surface)]">
      <div className="flex items-start gap-4 px-6 pb-5 pt-6">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-[18px] font-medium text-white">{avatar}</span>
        <div className="min-w-0 flex-1 text-start"><h2 className="truncate text-[20px] font-semibold tracking-[-0.025em] text-white">{user.email}</h2><div className="mt-2 flex flex-wrap items-center gap-2"><Badge>{user.plan}</Badge><Status value={user.status} /></div><p className="mt-3 text-[10.5px] text-[var(--studio-text-muted)]">User</p><p className="truncate text-[11.5px] text-[var(--studio-text-secondary)]">{user.email}</p></div>
        <button type="button" onClick={() => drawerRef.current?.close()} aria-label="Close user details" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--studio-text-secondary)] hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <div role="tablist" aria-label="User details" className="flex gap-1 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{tabs.map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`shrink-0 border-b-2 px-2.5 pb-3 pt-1 text-[11.5px] font-medium transition-colors ${tab === value ? 'border-white text-white' : 'border-transparent text-[var(--studio-text-secondary)] hover:text-white'}`}>{tabLabels[value]}</button>)}</div>
    </div>

    <div className="px-6 pb-8">
      {tab === 'overview' && <div>
        <UserOverviewSection icon={<UserRound className="h-5 w-5" />} title="Account" description="Basic information and account status.">
          <UserOverviewField label="Email"><span className="break-all">{user.email}</span></UserOverviewField>
          <UserOverviewField label="Joined"><DateValue value={user.createdAt} /></UserOverviewField>
          <UserOverviewField label="Last active"><DateValue value={user.lastSignInAt} /></UserOverviewField>
          <UserOverviewField label="Email status"><Status value={user.status === 'unconfirmed' ? 'unconfirmed' : 'active'} /></UserOverviewField>
        </UserOverviewSection>
        <UserOverviewSection icon={<CreditCard className="h-5 w-5" />} title="Subscription" description="Plan and manual billing details.">
          <UserOverviewField label="Plan">{user.plan}</UserOverviewField>
          <UserOverviewField label="Access">{user.plan.toLowerCase() === 'free' ? 'Trial' : currentEntitlement ? humanizeIdentifier(currentEntitlement.status) : 'No active paid period'}</UserOverviewField>
          <UserOverviewField label="Current period">{currentEntitlement ? <><DateValue value={currentEntitlement.starts_at} /> – <DateValue value={currentEntitlement.ends_at} /></> : '—'}</UserOverviewField>
          <UserOverviewField label="Billing">{user.plan.toLowerCase() === 'free' ? '0 DA · Trial' : 'Manual payment'}</UserOverviewField>
        </UserOverviewSection>
        <UserOverviewSection icon={<ImageIcon className="h-5 w-5" />} title="Media" description={plan === 'max' ? 'Recorded generation activity.' : 'Current plan allowances and balances.'}>
          {plan === 'free' ? <>
            <UserOverviewField label="Lifetime Images remaining"><span className="tabular-nums">{usageBalances.free_image_remaining ?? '—'} / 5</span></UserOverviewField>
            <UserOverviewField label="Lifetime Videos remaining"><span className="tabular-nums">{usageBalances.free_video_remaining ?? '—'} / 1</span></UserOverviewField>
          </> : plan === 'lite' ? <>
            <UserOverviewField label="Subscription Credits"><span className="tabular-nums">{usageBalances.subscription_balance ?? '—'}</span></UserOverviewField>
            <UserOverviewField label="Included Videos remaining"><span className="tabular-nums">{usageBalances.lite_video_remaining ?? '—'}</span></UserOverviewField>
            {isPositiveStoredBalance(usageBalances.purchased_balance) && <UserOverviewField label="Purchased Credits"><span className="tabular-nums">{usageBalances.purchased_balance}</span></UserOverviewField>}
          </> : plan === 'pro' ? <>
            <UserOverviewField label="Subscription Credits"><span className="tabular-nums">{usageBalances.subscription_balance ?? '—'}</span></UserOverviewField>
            <UserOverviewField label="Rollover Credits"><span className="tabular-nums">{usageBalances.subscription_rollover_balance ?? '—'}</span></UserOverviewField>
            {isPositiveStoredBalance(usageBalances.purchased_balance) && <UserOverviewField label="Purchased Credits"><span className="tabular-nums">{usageBalances.purchased_balance}</span></UserOverviewField>}
          </> : <>
            <UserOverviewField label="All generations"><span className="tabular-nums">{user.generationCount.toLocaleString()}</span></UserOverviewField>
            <UserOverviewField label="Recent image jobs"><span className="tabular-nums">{recentImages ?? '—'}</span></UserOverviewField>
            <UserOverviewField label="Recent video jobs"><span className="tabular-nums">{recentVideos ?? '—'}</span></UserOverviewField>
          </>}
        </UserOverviewSection>
        <details className="group border-b border-[var(--studio-border-subtle)] py-5"><summary className="flex cursor-pointer list-none items-center gap-3 text-start [&::-webkit-details-marker]:hidden"><ChevronRight className="h-4 w-4 text-[var(--studio-text-secondary)] transition-transform group-open:rotate-90" aria-hidden="true" /><span><strong className="block text-[12px] font-semibold text-white">Technical details</strong><span className="mt-0.5 block text-[10.5px] text-[var(--studio-text-muted)]">IDs and raw account references</span></span></summary><div className="mt-4 rounded-xl border border-[var(--studio-border-subtle)] bg-black/15 p-3"><TechnicalId label={t('common.userId')} value={user.id} /><p className="mt-2 text-[11px] text-[var(--studio-text-secondary)]">Credit balance: <span className="tabular-nums text-white">{balance ?? '—'}</span></p><p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]">Payment records: <span className="tabular-nums text-white">{user.paymentOrderCount}</span></p></div></details>
      </div>}
      {tab === 'security' && <div className="space-y-4 py-6"><p className="text-[12px] text-[var(--studio-text-secondary)]">{t('users.securityHelp')}</p><AdminUserActions userId={user.id} status={user.status} isOwner={user.isOwner} onChanged={onStatusChanged} /></div>}
      {tab !== 'overview' && tab !== 'security' && (error ? <div className="pt-6"><Notice reason="query_failed" /></div> : !data ? <p role="status" className="py-8 text-[12px] text-[var(--studio-text-muted)]">{t('users.loading')}</p> : <div className="space-y-2 py-6 text-[12px]">
        {tab === 'subscription' && (data.entitlements.length ? data.entitlements.map((item) => <div key={item.id} className="rounded-lg border border-[var(--studio-border)] p-3"><p className="font-semibold text-white">{item.plan_name} · {item.status}</p><p className="mt-1 text-[var(--studio-text-muted)]"><DateValue value={item.starts_at} /> – <DateValue value={item.ends_at} /></p></div>) : <Empty />)}
        {tab === 'credits' && <><p className="mb-3 font-semibold text-white">{t('users.balance')}: <span className="tabular-nums">{balance ?? '—'}</span></p><AdminCreditAdjustment userId={user.id} onAdjusted={(result) => { setBalance(result.balance); onCreditChanged(result.balance); setData((current) => current ? { ...current, ledger: [result.transaction, ...current.ledger.filter((item) => item.id !== result.transaction.id)] } : current); }} />{data.ledger.length ? data.ledger.map((item) => <div key={item.id} className="flex justify-between gap-3 border-b border-[var(--studio-border-subtle)] py-2"><div><strong>{t.has(`status.${item.transaction_type}`) ? t(`status.${item.transaction_type}`) : item.transaction_type}</strong><p className="text-[var(--studio-text-muted)]">{item.reason}</p></div><div className="shrink-0 text-end tabular-nums">{item.amount}<p className="text-[var(--studio-text-muted)]"><DateValue value={item.created_at} /></p></div></div>) : <Empty />}</>}
        {tab === 'payments' && (data.payments.length ? data.payments.map((item) => <div key={item.id} className="flex justify-between gap-3 border-b border-[var(--studio-border-subtle)] py-2"><div><strong>{item.plan_name}</strong><div className="mt-1"><Status value={item.status} /></div></div><div className="shrink-0 text-end tabular-nums">{item.amount_dzd} DZD<p className="text-[var(--studio-text-muted)]"><DateValue value={item.created_at} /></p></div></div>) : <Empty />)}
        {tab === 'jobs' && (data.jobs.length ? data.jobs.map((item) => <div key={item.id} className="flex justify-between gap-3 border-b border-[var(--studio-border-subtle)] py-2"><div><strong>{humanizeIdentifier(item.model_id)}</strong><p className="text-[var(--studio-text-muted)]">{humanizeIdentifier(item.modality)} · {humanizeIdentifier(item.state)}</p><TechnicalDetails><TechnicalId label={t('common.modelId')} value={item.model_id} /></TechnicalDetails></div><div className="shrink-0 text-end tabular-nums">{item.credits_charged ?? '—'}<p className="text-[var(--studio-text-muted)]"><DateValue value={item.created_at} /></p></div></div>) : <Empty />)}
        {tab === 'audit' && (data.audit.length ? data.audit.map((item) => <div key={item.id} className="flex justify-between gap-3 border-b border-[var(--studio-border-subtle)] py-2"><strong>{t.has(`audit.actions.${item.action}`) ? t(`audit.actions.${item.action}`) : humanizeIdentifier(item.action)}</strong><DateValue value={item.created_at} /></div>) : <Empty />)}
      </div>)}
    </div>
  </dialog>;
}

export function JobsView({ result, filters }: { result: AdminDataResult<AdminJobsData>; filters: { q?: string; status?: string; modality?: string; provider?: string; model?: string; range?: string; cursor?: string; seen?: string } }) {
  const t = useTranslations('Admin');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = result.data.jobs.find((job) => job.id === selectedId);
  const input = 'h-9 min-w-0 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white outline-none focus-visible:border-[var(--studio-border-strong)]';
  const nextParams = new URLSearchParams(Object.entries(filters).filter(([key, value]) => key !== 'cursor' && Boolean(value)) as [string, string][]);
  if (result.data.nextCursor) nextParams.set('cursor', result.data.nextCursor);
  if (result.data.nextCursor) nextParams.set('seen', String((Number(filters.seen) || 0) + result.data.jobs.length));
  return <><PageHeader title={t('jobs.title')} description={t('jobs.description')} compact><Badge>{t('jobs.resultCount', { count: result.data.total })}</Badge></PageHeader>{!result.available && <Notice reason={result.reason} />}
    <form action="/admin/jobs" method="get" className="mb-4 grid gap-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(170px,1fr)_130px_130px_135px_135px_auto]"><label><span className="sr-only">{t('jobs.search')}</span><input name="q" defaultValue={filters.q ?? ''} placeholder={t('jobs.search')} className={`${input} w-full`} /></label><label><span className="sr-only">{t('jobs.statusFilter')}</span><select name="status" defaultValue={filters.status ?? 'all'} className={`${input} w-full`}>{['all','reserved','streaming','completed','failed','cancelled','pending','processing'].map((value) => <option key={value} value={value}>{value === 'all' ? t('jobs.allStatuses') : t.has(`status.${value}`) ? t(`status.${value}`) : value}</option>)}</select></label><label><span className="sr-only">{t('jobs.modalityFilter')}</span><select name="modality" defaultValue={filters.modality ?? 'all'} className={`${input} w-full`}>{['all','chat','image','video'].map((value) => <option key={value} value={value}>{value === 'all' ? t('jobs.allModalities') : t(`modality.${value}`)}</option>)}</select></label><label><span className="sr-only">{t('jobs.providerFilter')}</span><input name="provider" defaultValue={filters.provider === 'all' ? '' : filters.provider ?? ''} placeholder={t('jobs.allProviders')} className={`${input} w-full`} /></label><label><span className="sr-only">{t('jobs.modelFilter')}</span><input name="model" defaultValue={filters.model === 'all' ? '' : filters.model ?? ''} placeholder={t('jobs.allModels')} className={`${input} w-full`} /></label><button type="submit" className="h-9 rounded-lg bg-white px-3 text-[12px] font-semibold text-black">{t('jobs.searchAction')}</button></form>
    {result.data.jobs.length ? <TableFrame><table className={adminTableClass}><thead className="border-b border-[var(--studio-border)]"><tr><th className="w-[16%]">{t('jobs.time')}</th><th className="w-[20%]">{t('jobs.user')}</th><th className="w-[22%]">{t('jobs.providerModel')}</th><th className="w-[13%]">{t('jobs.status')}</th><th className="w-[11%] text-end">{t('jobs.creditsCharged')}</th><th className="w-[11%] text-end">{t('jobs.cost')}</th><th className="w-[7%]">{t('jobs.details')}</th></tr></thead><tbody>{result.data.jobs.map((job) => <tr key={`${job.source}:${job.id}`} className="border-b border-[var(--studio-border-subtle)] last:border-0"><td className="text-[var(--studio-text-secondary)]"><DateValue value={job.createdAt} /></td><td className="truncate font-medium text-white" title={job.userEmail ?? undefined}>{job.userEmail ?? t('common.unavailable')}</td><td><p className="truncate font-medium text-white">{job.modelName ?? job.modelId}</p><p className="truncate text-[10px] text-[var(--studio-text-muted)]">{job.modality} · {job.provider ?? '—'}</p></td><td><Status value={job.status} /></td><td className="text-end tabular-nums">{job.creditsCharged ?? '—'}</td><td className="text-end"><Cost value={job.providerCost} /></td><td><button type="button" onClick={() => setSelectedId(job.id)} className="text-[11px] font-semibold text-white underline focus-visible:ring-2 focus-visible:ring-white/50">{t('jobs.viewDetails')}</button></td></tr>)}</tbody></table></TableFrame> : <Empty label={filters.q || filters.status && filters.status !== 'all' || filters.modality && filters.modality !== 'all' || filters.provider || filters.model ? t('jobs.noMatches') : t('jobs.noJobs')} action={<Link href="/admin/models" className="text-[12px] text-white underline">{t('nav.models')}</Link>} />}
    <div className="mt-3 flex items-center justify-between text-[12px] text-[var(--studio-text-muted)]"><span>{(Number(filters.seen) || 0) + result.data.jobs.length} / {result.data.total}</span>{result.data.nextCursor && <Link href={`/admin/jobs?${nextParams}`} prefetch={false} className="rounded-lg border border-[var(--studio-border)] px-3 py-2 text-white">{t('jobs.nextPage')}</Link>}</div>
    {selected && <DetailDrawer title={`${selected.modelName ?? selected.modelId} · ${selected.userEmail ?? selected.userId}`} onClose={() => setSelectedId(null)}>
      <div className="space-y-2.5">
        <DetailSection title={t('jobs.request')}><p><strong>{t('jobs.user')}:</strong> {selected.userEmail ?? t('common.unavailable')}</p><p><strong>{t('jobs.modality')}:</strong> {t.has(`modality.${selected.modality}`) ? t(`modality.${selected.modality}`) : humanizeIdentifier(selected.modality)}</p><p><strong>{t('models.displayName')}:</strong> {selected.modelName ?? humanizeIdentifier(selected.modelId)}</p>{selected.prompt && <p className="break-words text-[var(--studio-text-secondary)]">{selected.prompt}</p>}</DetailSection>
        <DetailSection title={t('jobs.usage')}><p><strong>{t('jobs.creditsCharged')}:</strong> <span className="tabular-nums">{selected.creditsCharged ?? '—'}</span></p><p><strong>{t('jobs.cost')}:</strong> <Cost value={selected.providerCost} /></p></DetailSection>
        <DetailSection title={t('jobs.execution')}><p><strong>{t('jobs.status')}:</strong> <Status value={selected.status} /></p><p><strong>{t('jobs.providerModel')}:</strong> {selected.provider ?? '—'}{selected.providerModelId ? ` · ${selected.providerModelId}` : ''}</p><p><strong>{t('jobs.latency')}:</strong> {selected.latencyMs == null ? '—' : t('common.milliseconds', { value: selected.latencyMs })}</p><p><strong>{t('jobs.reservation')}:</strong> {selected.reservationState ? humanizeIdentifier(selected.reservationState) : '—'}</p>{selected.attempts.length > 0 && <details><summary className="cursor-pointer font-semibold text-white">{t('jobs.attempts')} · {selected.attempts.length}</summary><div className="mt-2 space-y-2">{selected.attempts.map((attempt, index) => <div key={`${attempt.startedAt}:${index}`} className="rounded-lg border border-[var(--studio-border)] p-2.5"><p>{index + 1}. {attempt.provider} · {humanizeIdentifier(attempt.state)}</p><p className="text-[11px] text-[var(--studio-text-muted)]"><DateValue value={attempt.startedAt} /></p>{attempt.error && <p className="break-words text-red-100">{attempt.error}</p>}</div>)}</div></details>}</DetailSection>
        {selected.error && <DetailSection title={t('jobs.failure')}><p className="break-words text-red-100">{selected.error}</p></DetailSection>}
        <details className="rounded-lg border border-[var(--studio-border-subtle)] bg-black/15 p-3"><summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-secondary)]">{t('jobs.rawTechnicalData')}</summary><div className="mt-2"><TechnicalId label={t('common.jobId')} value={selected.id} /><TechnicalId label={t('common.userId')} value={selected.userId} /><TechnicalId label={t('common.modelId')} value={selected.modelId} />{selected.usageMetadata && <pre className="mt-2 whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(selected.usageMetadata, null, 2)}</pre>}</div></details>
      </div>
    </DetailDrawer>}</>;
}

export function RuntimeLimitsView({ result }: { result: AdminDataResult<AdminProviderRow[]> }) {
  const t = useTranslations('Admin');
  const [providers, setProviders] = useState(result.data);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => setProviders(result.data), [result.data]);
  const selected = providers.find((row) => row.id === selectedId);
  return <><PageHeader title={t('runtime.title')} description={t('runtime.description')} compact />{!result.available && <Notice reason={result.reason} />}
    <TableFrame><table className={adminTableClass}><thead><tr><th>{t('providers.name')}</th><th>{t('providers.routing')}</th><th>{t('providers.killSwitch')}</th><th className="text-end">{t('providers.priority')}</th><th>{t('providers.spendLimit')}</th><th>{t('users.actions')}</th></tr></thead><tbody>{providers.map((row) => <tr key={row.id} className="border-t border-[var(--studio-border-subtle)]"><td className="font-semibold text-white">{row.name}</td><td><Badge tone={row.enabled ? 'success' : 'neutral'}>{t(row.enabled ? 'common.enabled' : 'common.disabled')}</Badge></td><td><Badge tone={row.emergencyDisabled ? 'danger' : 'neutral'}>{t(row.emergencyDisabled ? 'providers.emergencyOn' : 'providers.emergencyOff')}</Badge></td><td className="text-end tabular-nums">{row.priority}</td><td className="tabular-nums">{row.dailySpendLimitMinor == null ? t('providers.noLimit') : `${row.dailySpendLimitMinor} ${row.spendCurrency ?? ''}`}</td><td><button type="button" onClick={() => setSelectedId(row.id)} className="text-[12px] font-semibold text-white underline">{t('providers.manage')}</button></td></tr>)}</tbody></table></TableFrame>
    {selected && <DetailDrawer title={selected.name} onClose={() => setSelectedId(null)}><AdminProviderControls provider={selected} onSaved={(config) => setProviders((current) => current.map((item) => item.id === config.providerId ? { ...item, ...config } : item))} /></DetailDrawer>}
  </>;
}

export function AuditView({ result }: { result: AdminDataResult<AdminAuditRow[]> }) {
  const t = useTranslations('Admin');
  return <><PageHeader title={t('audit.title')} description={t('audit.description')} compact />{!result.available && <Notice reason={result.reason} />}
    {result.data.length ? <TableFrame><table className={adminTableClass}><thead><tr><th className="w-[20%]">{t('audit.time')}</th><th className="w-[25%]">{t('audit.admin')}</th><th className="w-[25%]">{t('audit.action')}</th><th className="w-[30%]">{t('audit.resource')}</th></tr></thead><tbody>{result.data.map((row) => { const summary = t.has(`audit.actions.${row.action}`) ? t(`audit.actions.${row.action}`) : humanizeIdentifier(row.action); return <tr key={`${row.resourceType}:${row.id}`} className="border-t border-[var(--studio-border-subtle)]"><td><DateValue value={row.createdAt} /></td><td className="truncate">{row.actor ?? '—'}</td><td><span className="font-medium text-white">{summary}</span></td><td><span className="font-medium capitalize text-white">{t.has(`audit.resources.${row.resourceType}`) ? t(`audit.resources.${row.resourceType}`) : humanizeIdentifier(row.resource)}</span><TechnicalDetails><TechnicalId label={t('common.internalId')} value={row.resourceId} />{row.detail && <p className="mt-2 break-words text-[10.5px] text-[var(--studio-text-secondary)]">{row.detail}</p>}{(row.previousState || row.newState) && <div className="mt-2 grid gap-2 text-[10.5px]"><div><p className="font-semibold text-[var(--studio-text-secondary)]">{t('audit.previousState')}</p><pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(row.previousState, null, 2) ?? '—'}</pre></div><div><p className="font-semibold text-[var(--studio-text-secondary)]">{t('audit.newState')}</p><pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(row.newState, null, 2) ?? '—'}</pre></div></div>}</TechnicalDetails></td></tr>; })}</tbody></table></TableFrame> : <Empty label={t('audit.empty')} />}
    <p className="mt-3 text-[11px] text-[var(--studio-text-muted)]">{t('audit.scope')}</p>
  </>;
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
  const [status, setStatus] = useState(['incomplete', 'pending', 'approved', 'rejected', 'cancelled', 'all'].includes(initialStatus) ? initialStatus : 'pending');
  const [resolved, setResolved] = useState<Record<string, 'approved' | 'rejected' | 'cancelled'>>({});
  useEffect(() => setPayments(result.data), [result.data]);
  const filtered = status === 'all' ? payments : payments.filter((payment) => payment.status === status);
  const pending = payments.filter((payment) => payment.status === 'pending').length;
  return <><PageHeader compact title={t('payments.title')} description={t('payments.description')}><div className="flex gap-2"><Badge>{t('payments.orderCount', { count: payments.length })}</Badge><Badge tone={pending ? 'danger' : 'neutral'}>{t('payments.pendingCount', { count: pending })}</Badge></div></PageHeader>
    <section aria-labelledby="payment-orders-title"><SectionHeading title={t('payments.ordersTitle')} description={t('payments.ordersDescription')} />
      <div role="tablist" aria-label={t('payments.statusFilter')} className="mb-3 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{['incomplete','pending','approved','rejected','cancelled','all'].map((value) => <button key={value} type="button" role="tab" aria-selected={status === value} onClick={() => setStatus(value)} className={`min-h-8 shrink-0 rounded-lg px-3 text-[11.5px] font-semibold transition-colors duration-150 motion-reduce:transition-none ${status === value ? 'bg-white text-black' : 'text-[var(--studio-text-secondary)] hover:bg-white/[0.06] hover:text-white'}`}>{value === 'all' ? t('payments.allStatuses') : t(`status.${value}`)}</button>)}</div>
      {!result.available && <Notice reason={result.reason} />}
      {filtered.length ? <div className="space-y-2">{filtered.map((payment) => <details key={payment.id} name="admin-payment-order" className="group rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.95)] [&_summary]:min-h-14">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-2 text-start [&::-webkit-details-marker]:hidden"><ChevronDown className="h-4 w-4 shrink-0 text-[var(--studio-text-muted)] transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="break-words text-[13px] font-semibold text-white">{payment.userEmail}</p><Status value={payment.status} /></div><p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--studio-text-secondary)]"><span>{payment.planName}</span><span aria-hidden="true">·</span><span>{payment.creditsAmount ? t('payments.credits', { value: payment.creditsAmount }) : '—'}</span><span aria-hidden="true">·</span><span>{t.has(`payments.${payment.paymentMethod}`) ? t(`payments.${payment.paymentMethod}`) : payment.paymentMethod}</span><span aria-hidden="true">·</span><span className={payment.proofUrl ? 'font-semibold text-emerald-100' : ''}>{payment.proofUrl ? t('payments.proofAttached') : t('payments.noProof')}</span></p></div><div className="shrink-0 text-end"><p dir="ltr" className="text-[15px] font-bold tabular-nums text-white">{payment.amountDzd.toLocaleString(locale)} DA</p><p className="mt-0.5 text-[10.5px] text-[var(--studio-text-muted)]"><DateValue value={payment.submittedAt ?? payment.createdAt} /></p></div></summary>
        <div className="border-t border-[var(--studio-border)] p-2">
          {(payment.status === 'pending' && payment.submittedAt) || payment.status === 'incomplete'
            ? <div className="sticky top-2 z-10 mb-2.5 max-w-3xl"><AdminPaymentActions paymentId={payment.id} creditsAmount={payment.creditsAmount} allowReview={payment.status === 'pending'} onResolved={(nextStatus) => { setPayments((current) => current.map((item) => item.id === payment.id ? { ...item, status: nextStatus } : item)); setResolved((current) => ({ ...current, [payment.id]: nextStatus })); }} /></div>
            : null}
          <div className="grid items-start gap-1.5 lg:grid-cols-2 xl:grid-cols-3">
          <PaymentGroup title={t('payments.customerGroup')}><PaymentField label={t('payments.customer')}><p className="font-medium text-white">{payment.userEmail}</p><TechnicalId label={t('common.userId')} value={payment.userId} /></PaymentField></PaymentGroup>
          <PaymentGroup title={t('payments.snapshotTitle')}><div className="grid gap-2 sm:grid-cols-2"><PaymentField label={t('payments.product')}><p className="font-medium text-white">{payment.planName}</p><p className="mt-0.5 text-[var(--studio-text-muted)]">{t(`payments.${payment.orderKind}`)}</p></PaymentField><PaymentField label={t('payments.amount')}><p dir="ltr" className="font-semibold tabular-nums text-white">{payment.amountDzd.toLocaleString(locale)} DA</p><p className="mt-0.5">{payment.creditsAmount ? t('payments.credits', { value: payment.creditsAmount }) : '—'}</p></PaymentField></div></PaymentGroup>
          <PaymentGroup title={t('payments.paymentEvidence')}><PaymentField label={t('payments.method')}><p className="font-medium text-white">{t.has(`payments.${payment.paymentMethod}`) ? t(`payments.${payment.paymentMethod}`) : payment.paymentMethod}</p><TechnicalId label={t('payments.reference')} value={payment.paymentReference} /></PaymentField><div className="mt-2"><PaymentField label={t('payments.submission')}><p className="break-words">{payment.customerReference ?? t('common.noneRecorded')}</p>{payment.proofUrl ? <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg bg-white px-3 text-[12px] font-semibold text-black transition-colors duration-150 hover:bg-white/90"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{t('payments.viewProof')}</a> : <p className="mt-0.5 text-[var(--studio-text-muted)]">{t('payments.noProof')}</p>}</PaymentField></div></PaymentGroup>
          <PaymentGroup title={t('payments.reviewInformation')}><PaymentField label={t('payments.reviewInformation')}><p><DateValue value={payment.reviewedAt} /></p><p className="mt-1 break-words text-[var(--studio-text-muted)]">{payment.reviewNote ?? t('payments.noReviewNote')}</p></PaymentField></PaymentGroup>
          <PaymentGroup title={t('payments.creditResult')}><PaymentField label={t('payments.result')}>{payment.resultingCreditTransactionId ? <TechnicalId label={t('payments.ledgerTransaction')} value={payment.resultingCreditTransactionId} /> : payment.resultingEntitlementId ? <TechnicalId label={t('payments.entitlement')} value={payment.resultingEntitlementId} /> : <p>{t('common.noneRecorded')}</p>}</PaymentField></PaymentGroup>
          <PaymentGroup title={t('payments.audit')}><PaymentField label={t('payments.timestamps')}><p>{t('payments.created')}: <DateValue value={payment.createdAt} /></p><p className="mt-0.5">{t('status.submitted')}: <DateValue value={payment.submittedAt} /></p></PaymentField>{payment.audit.length ? <div className="mt-2 space-y-1 border-t border-[var(--studio-border-subtle)] pt-2">{payment.audit.map((event) => <p key={event.id} className="text-[11px] text-[var(--studio-text-secondary)]"><span className="font-semibold text-white">{t.has(`status.${event.action}`) ? t(`status.${event.action}`) : event.action}</span> · <DateValue value={event.createdAt} /></p>)}</div> : <p className="mt-1 text-[11px] text-[var(--studio-text-muted)]">{t('common.noneRecorded')}</p>}</PaymentGroup>
        </div>
        {resolved[payment.id] && <p role="status" className="mt-2 text-start text-[11px] text-white/70">{t(resolved[payment.id] === 'approved' ? 'payments.approvedSuccess' : resolved[payment.id] === 'rejected' ? 'payments.rejectedSuccess' : 'payments.cancelledSuccess')}</p>}</div>
      </details>)}</div> : <Empty label={status === 'all' ? t('payments.noPayments') : t('payments.noPaymentsForStatus')} />}
    </section></>;
}

function PaymentField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 text-start text-[11.5px] leading-relaxed text-[var(--studio-text-secondary)]"><p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--studio-text-muted)]">{label}</p>{children}</div>;
}

function PaymentGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="h-fit self-start rounded-lg border border-[var(--studio-border-subtle)] bg-white/[0.02] p-2"><h3 className="mb-1 text-start text-[12px] font-semibold text-white">{title}</h3>{children}</div>;
}
