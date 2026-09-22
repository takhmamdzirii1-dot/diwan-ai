'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ChevronDown, ChevronRight, Copy, CreditCard, Database, ExternalLink, ImageIcon, MessageCircle, MoreHorizontal, Search, UserRound, Video, X } from 'lucide-react';
import AdminPaymentActions from './AdminPaymentActions';
import AdminUserActions from './AdminUserActions';
import AdminCreditAdjustment from './AdminCreditAdjustment';
import AdminModelControls from './AdminModelControls';
import AdminModelRouteControls from './AdminModelRouteControls';
import AdminModelPresentationControls from './AdminModelPresentationControls';
import AdminModelCapabilitiesControls from './AdminModelCapabilitiesControls';
import AdminModelCreate from './AdminModelCreate';
import { RemainingProvidersView, RemainingRuntimeView, RemainingAuditView } from './AdminRemainingViews';
import { RemainingPlansView } from './AdminRemainingPlans';
import AdminModelLifecycleControls from './AdminModelLifecycleControls';
import type {
  AdminAuditRow, AdminDataResult, AdminJobRow, AdminJobsData, AdminModelRow, AdminPaymentRow,
  AdminPaymentPlan, AdminProviderRow, AdminUserRow, AdminUsersData, CostAmount,
} from '@/lib/admin/types';
import { isMissingCustomerPricing } from '@/lib/admin/model-economics';
import { modelBrand } from '@/src/config/model-catalog';
import { ModelBrandIcon } from '@/components/ui/model-brand-icon';
import { MODEL_PLAN_CODES, type ModelPlanCode } from '@/lib/models/plan-entitlements';

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

function Pagination({ count, page, size, onPage, noun }: { count: number; page: number; size: number; onPage: (page: number) => void; noun: string }) {
  const pages = Math.max(1, Math.ceil(count / size));
  const current = Math.min(page, pages - 1);
  return <div className="flex items-center justify-between gap-3 border-t border-[var(--studio-border-subtle)] px-4 py-3 text-[11px] text-[var(--studio-text-secondary)]">
    <span>Showing {count ? current * size + 1 : 0}–{Math.min(count, (current + 1) * size)} of {count} {noun}</span>
    <div className="flex items-center gap-1"><button type="button" aria-label="Previous page" disabled={current === 0} onClick={() => onPage(current - 1)} className="h-8 min-w-8 rounded-lg border border-[var(--studio-border)] disabled:opacity-40">‹</button><span className="h-8 min-w-8 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-selected)] px-2 text-center leading-8 text-[var(--studio-text-primary)]">{current + 1}</span><button type="button" aria-label="Next page" disabled={current >= pages - 1} onClick={() => onPage(current + 1)} className="h-8 min-w-8 rounded-lg border border-[var(--studio-border)] disabled:opacity-40">›</button></div>
  </div>;
}

const adminTableClass = 'w-full table-fixed text-start text-[12px]';

function Cost({ value }: { value: CostAmount | null }) {
  const t = useTranslations('Admin.common');
  return value ? <span dir="ltr" className="tabular-nums">{t('minorUnits', { value: value.minor, currency: value.currency })}</span> : <span aria-label={t('unavailable')}>—</span>;
}

function formatOperatorCost(value: CostAmount | null): string {
  if (!value || !/^-?\d+$/.test(value.minor)) return '—';
  const minor = BigInt(value.minor);
  if (minor === 0n) return value.currency.toUpperCase() === 'USD' ? '$0' : `0 ${value.currency}`;
  const absolute = minor < 0n ? -minor : minor;
  const amount = `${minor < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
  return value.currency.toUpperCase() === 'USD' ? `$${amount}` : `${amount} ${value.currency}`;
}

function OperatorCost({ value }: { value: CostAmount | null }) {
  return <span dir="ltr" className="tabular-nums">{formatOperatorCost(value)}</span>;
}

function ProviderEconomics({ row }: { row: Pick<AdminModelRow, 'providerCost' | 'providerCostState'> }) {
  if (row.providerCostState === 'free') return <span>$0</span>;
  if (row.providerCostState === 'known') return <OperatorCost value={row.providerCost} />;
  return <span>—</span>;
}

function ModelOperatorCost({ row }: { row: Pick<AdminModelRow, 'providerCost' | 'providerCostState'> }) {
  return row.providerCost ? <OperatorCost value={row.providerCost} /> : row.providerCostState === 'free' ? <span>$0</span> : <span>—</span>;
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

function PaymentStatus({ value }: { value: string }) {
  return value === 'pending' ? <Badge tone="warning">Awaiting Review</Badge> : <Status value={value} />;
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

function WorkspaceDrawer({ title, subtitle, badges, icon, actions, compact = false, segmented = false, tabs, activeTab, onTab, onClose, children }: {
  title: string; subtitle?: string; badges?: React.ReactNode; icon?: React.ReactNode; actions?: React.ReactNode; compact?: boolean; segmented?: boolean; tabs: readonly string[];
  activeTab: string; onTab: (tab: string) => void; onClose: () => void; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  return <dialog ref={ref} onClose={onClose} onClick={(event) => { if (event.target === ref.current) ref.current?.close(); }} aria-label={title} className={`fixed inset-y-0 end-0 m-0 ms-auto h-dvh max-h-dvh w-full overflow-y-auto border-s border-[var(--studio-border)] bg-[var(--studio-card)] p-0 text-[var(--studio-text-primary)] shadow-[var(--studio-shadow)] backdrop:bg-[var(--studio-overlay)] ${compact ? 'max-w-[600px] lg:w-[42vw]' : 'max-w-[720px] lg:w-[52vw]'}`}>
    <div className="sticky top-0 z-20 border-b border-[var(--studio-border)] bg-[var(--studio-card)]"><div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6"><div className="flex min-w-0 items-start gap-3 text-start">{icon && <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--studio-border)] bg-[var(--studio-composer)] text-[var(--studio-text-primary)]">{icon}</div>}<div className="min-w-0"><h2 className="truncate text-[20px] font-semibold tracking-[-0.025em]">{title}</h2>{subtitle && <p className="mt-1 truncate text-[12px] text-[var(--studio-text-secondary)]">{subtitle}</p>}{badges && <div className="mt-2 flex flex-wrap gap-2">{badges}</div>}</div></div><div className="flex shrink-0 items-center gap-1">{actions}<button type="button" aria-label="Close details" onClick={() => ref.current?.close()} className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)]"><X className="h-4 w-4" /></button></div></div>
      <div role="tablist" aria-label={`${title} details`} className={`flex gap-1 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${segmented ? 'pb-3' : ''}`}>{tabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => onTab(tab)} className={segmented ? `h-9 shrink-0 rounded-lg border px-4 text-[12px] font-medium ${activeTab === tab ? 'border-[var(--studio-accent)] bg-[var(--studio-accent)] text-[var(--studio-accent-contrast)]' : 'border-[var(--studio-border-subtle)] text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)]'}` : `h-11 shrink-0 border-b-2 px-3 text-[12px] font-medium ${activeTab === tab ? 'border-[var(--studio-accent)] text-[var(--studio-text-primary)]' : 'border-transparent text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-primary)]'}`}>{tab}</button>)}</div></div>
    <div className="px-6 py-5">{children}</div>
  </dialog>;
}

function ModelDetailCard({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return <section className="rounded-xl border border-[var(--studio-border)] bg-white/[0.015] p-3.5"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-[14px] font-semibold text-white">{title}</h3>{onEdit && <button type="button" onClick={onEdit} className="h-8 rounded-lg border border-[var(--studio-border)] px-3 text-[11px] font-medium text-white hover:bg-white/[0.06]">Edit</button>}</div><div className="grid gap-2 sm:grid-cols-3">{children}</div></section>;
}

function ModelTile({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={`min-w-0 rounded-lg border border-[var(--studio-border-subtle)] bg-black/[0.12] px-3 py-2 ${wide ? 'sm:col-span-2' : ''}`}><p className="text-[10px] text-[var(--studio-text-secondary)]">{label}</p><div className={`mt-1 text-[12px] font-medium text-white ${wide ? 'break-words' : 'truncate'}`}>{children}</div></div>;
}

function WorkspaceField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-2 border-b border-[var(--studio-border-subtle)] py-2.5 text-[12px] last:border-0 sm:grid-cols-[160px_minmax(0,1fr)]"><span className="text-[var(--studio-text-secondary)]">{label}</span><div className="min-w-0 break-words font-medium text-white">{children}</div></div>;
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

export function ProvidersView({ result }: { result: AdminDataResult<AdminProviderRow[]> }) { return <RemainingProvidersView result={result} />; }

export function ModelsView({ result }: { result: AdminDataResult<AdminModelRow[]> }) {
  const [models, setModels] = useState(result.data);
  const [query, setQuery] = useState('');
  const [modality, setModality] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [pricingFilter, setPricingFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tab, setTab] = useState('Details');
  const [editSection, setEditSection] = useState<'identity' | 'routing' | 'pricing' | 'configuration' | null>(null);
  useEffect(() => setModels(result.data), [result.data]);
  const providers = [...new Set(models.flatMap((model) => [model.provider, ...model.routes.map((route) => route.providerId)]))].filter(Boolean).sort();
  const brandOf = (model: AdminModelRow) => model.category?.trim() || modelBrand(model.displayName, model.modality as 'chat' | 'image' | 'video', model.provider, model.modelId).name;
  const brands = [...new Set(models.map(brandOf))].sort();
  const statusOf = (model: AdminModelRow) => model.catalogOnly || model.availability === 'provider_config_required' ? 'unconfigured' : model.enabled ? 'enabled' : 'disabled';
  const filtered = models.filter((model) => {
    const search = query.trim().toLowerCase();
    const route = model.routes.find((item) => item.enabled && !item.fallback);
    if (search && ![model.displayName, brandOf(model), model.modelId, model.provider, route?.providerModelId, ...model.routes.map((item) => item.providerId)].some((value) => value?.toLowerCase().includes(search))) return false;
    if (modality !== 'all' && model.modality !== modality) return false;
    if (brandFilter !== 'all' && brandOf(model) !== brandFilter) return false;
    if (planFilter !== 'all' && !model.allowedPlans.includes(planFilter as ModelPlanCode)) return false;
    if (providerFilter !== 'all' && model.provider !== providerFilter && !model.routes.some((item) => item.providerId === providerFilter)) return false;
    if (statusFilter !== 'all' && statusOf(model) !== statusFilter) return false;
    if (visibilityFilter === 'visible' && !model.visibleInStudio || visibilityFilter === 'hidden' && model.visibleInStudio) return false;
    if (pricingFilter === 'missing' && !isMissingCustomerPricing(model) || pricingFilter === 'configured' && isMissingCustomerPricing(model)) return false;
    return true;
  });
  const selected = models.find((model) => model.key === selectedKey);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 25) - 1));
  const visibleModels = filtered.slice(currentPage * 25, (currentPage + 1) * 25);
  const route = selected?.routes.find((item) => item.enabled && !item.fallback) ?? selected?.routes[0];
  const providerName = selected?.providerOptions.find((item) => item.id === route?.providerId)?.name ?? route?.providerId ?? selected?.provider;
  const customerUnit = (model: AdminModelRow) => model.modality === 'chat' ? 'weighted units/request' : model.modality === 'image' ? 'credits/image' : 'credits/video';
  const customerCost = (model: AdminModelRow) => isMissingCustomerPricing(model) ? '—' : String(model.creditPrice) + ' ' + customerUnit(model);
  const saveConfig = (config: { modelKey: string; enabled: boolean; routingRole: AdminModelRow['priority']; customerCreditPrice: number | null; allowedPlans: AdminModelRow['allowedPlans']; updatedAt: string }) => setModels((current) => current.map((item) => item.key === config.modelKey ? { ...item, enabled: config.enabled, priority: config.routingRole, creditPrice: config.customerCreditPrice, allowedPlans: config.allowedPlans, updatedAt: config.updatedAt, persisted: true } : item));
  const selectClass = 'h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-2.5 text-[11.5px] text-white focus-visible:ring-2 focus-visible:ring-white/50';
  return <><PageHeader title="Models" description="Manage VANTRA models, backend mappings, pricing, plan access, and availability."><AdminModelCreate /></PageHeader>{!result.available && <Notice reason={result.reason} />}
    <label className="relative mb-4 block"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--studio-text-muted)]" /><span className="sr-only">Search models</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by visible model, brand, backend, or provider..." className="h-10 w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] ps-10 pe-3 text-[12px] text-white outline-none placeholder:text-[var(--studio-text-muted)] focus-visible:ring-2 focus-visible:ring-white/50" /></label>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div role="tablist" aria-label="Model modality" className="flex gap-0.5 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] p-0.5">{['all','chat','image','video'].map((value) => <button key={value} type="button" role="tab" aria-selected={modality === value} onClick={() => setModality(value)} className={modality === value ? 'h-8 rounded-md bg-white px-3 text-[11.5px] font-semibold text-black' : 'h-8 rounded-md px-3 text-[11.5px] text-[var(--studio-text-secondary)] hover:text-white'}>{value === 'all' ? 'All' : humanizeIdentifier(value)}</button>)}</div>
      <div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="model-brand-filter">Brand</label><select id="model-brand-filter" value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} className={selectClass}><option value="all">All brands</option>{brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select><label className="sr-only" htmlFor="model-plan-filter">Plan access</label><select id="model-plan-filter" value={planFilter} onChange={(event) => setPlanFilter(event.target.value)} className={selectClass}><option value="all">All plan access</option>{MODEL_PLAN_CODES.map((plan) => <option key={plan} value={plan}>{humanizeIdentifier(plan)}</option>)}</select><label className="sr-only" htmlFor="model-provider-filter">Provider</label><select id="model-provider-filter" value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)} className={selectClass}><option value="all">All providers</option>{providers.map((provider) => <option key={provider} value={provider}>{provider}</option>)}</select><label className="sr-only" htmlFor="model-status-filter">Status</label><select id="model-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={selectClass}><option value="all">All statuses</option><option value="enabled">Active</option><option value="disabled">Disabled</option><option value="unconfigured">Unconfigured</option></select><label className="sr-only" htmlFor="model-visibility-filter">Visibility</label><select id="model-visibility-filter" value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)} className={selectClass}><option value="all">All visibility</option><option value="visible">Visible</option><option value="hidden">Hidden</option></select><label className="sr-only" htmlFor="model-pricing-filter">Pricing</label><select id="model-pricing-filter" value={pricingFilter} onChange={(event) => setPricingFilter(event.target.value)} className={selectClass}><option value="all">All pricing</option><option value="configured">Configured</option><option value="missing">Missing customer cost</option></select></div></div>
    <p className="mb-3 text-[11.5px] text-[var(--studio-text-secondary)]">{filtered.length} models <span className="mx-1 text-[var(--studio-text-muted)]">·</span> {models.filter((model) => model.enabled).length} enabled <span className="mx-1 text-[var(--studio-text-muted)]">·</span> {models.filter((model) => !model.catalogOnly && isMissingCustomerPricing(model)).length} missing customer cost <span className="mx-1 text-[var(--studio-text-muted)]">—</span> {models.filter((model) => model.catalogOnly).length} catalog entries awaiting configuration</p>
    {filtered.length ? <div className="overflow-x-auto rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)]"><table className="w-full min-w-[1040px] table-fixed text-start text-[11.5px]"><colgroup><col className="w-[15%]" /><col className="w-[11%]" /><col className="w-[8%]" /><col className="w-[12%]" /><col className="w-[10%]" /><col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[11%]" /><col className="w-[9%]" /><col className="w-[6%]" /></colgroup><thead className="border-b border-[var(--studio-border)] bg-white/[0.025]"><tr>{['Visible Model','Brand','Modality','Backend','Provider','Provider Price','VANTRA Cost','Customer Cost','Plans','Status'].map((label) => <th key={label} className="px-2.5 py-2 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-[var(--studio-text-secondary)]">{label}</th>)}</tr></thead><tbody>{visibleModels.map((model) => { const primary = model.routes.find((item) => item.enabled && !item.fallback) ?? model.routes[0]; return <tr key={model.key} tabIndex={0} onClick={() => { setSelectedKey(model.key); setTab('Details'); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedKey(model.key); setTab('Details'); } }} className="cursor-pointer border-b border-[var(--studio-border-subtle)] last:border-0 hover:bg-white/[0.035] focus-visible:bg-white/[0.05]"><td className="px-2.5 py-2 font-semibold text-white" title={model.displayName}><div className="flex min-w-0 items-center gap-2"><ModelBrandIcon url={model.mediaUrl} name={brandOf(model)} size={20} /><span className="truncate">{model.displayName}</span></div></td><td className="truncate px-2.5 py-2" title={brandOf(model)}>{model.category?.trim() ? <span className="font-medium text-white">{brandOf(model)}</span> : <span className="text-[var(--studio-text-muted)]">{brandOf(model)} · auto</span>}</td><td className="px-2.5 py-2 text-[var(--studio-text-secondary)]">{humanizeIdentifier(model.modality)}</td><td className="truncate px-2.5 py-2" title={(primary?.providerModelId ?? model.modelId) || undefined}>{(primary?.providerModelId ?? model.modelId) || '—'}</td><td className="truncate px-2.5 py-2" title={(primary?.providerId ?? model.provider) || undefined}>{(primary?.providerId ?? model.provider) || '—'}</td><td className="px-2.5 py-2"><ProviderEconomics row={model} /></td><td className="px-2.5 py-2"><ModelOperatorCost row={model} /></td><td className="px-2.5 py-2 tabular-nums">{customerCost(model)}</td><td className="px-2.5 py-2"><div className="flex flex-wrap gap-1">{model.allowedPlans.length ? model.allowedPlans.map((plan) => <span key={plan} className="rounded-full border border-[var(--studio-border)] bg-white/[0.04] px-1.5 py-0.5 text-[9.5px] text-white">{humanizeIdentifier(plan)}</span>) : '—'}</div></td><td className="px-2.5 py-2">{model.catalogOnly ? <Badge>Unconfigured</Badge> : <Status value={model.archived ? 'archived' : model.enabled ? 'active' : 'disabled'} />}</td></tr>; })}</tbody></table><Pagination count={filtered.length} page={currentPage} size={25} onPage={setPage} noun="models" /></div> : <Empty label="No models match these filters." />}
    {selected && <WorkspaceDrawer segmented title={editSection ? 'Edit Model' : selected.displayName} subtitle={`${humanizeIdentifier(selected.modality)} · ${selected.catalogOnly ? 'Unconfigured' : selected.archived ? 'Archived' : selected.enabled ? 'Active' : 'Disabled'} · ${selected.catalogOnly ? 'Catalog only' : selected.visibleInStudio ? 'Visible in Studio' : 'Hidden from Studio'}`} icon={<ModelBrandIcon url={selected.mediaUrl} name={brandOf(selected)} size={24} />} actions={selected.catalogOnly ? undefined : <details className="relative"><summary aria-label="Model actions" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-[var(--studio-border)] text-[var(--studio-text-secondary)] hover:text-white [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" /></summary><div className="absolute end-0 top-10 z-30 w-44 rounded-lg border border-[var(--studio-border)] bg-[#202021] p-1 shadow-lg"><button type="button" onClick={() => { setTab('Details'); setEditSection('identity'); }} className="w-full rounded px-3 py-2 text-start text-[11px] hover:bg-white/[0.06]">Edit model</button><Link href={'/admin/jobs?model=' + encodeURIComponent(selected.modelId) + '&range=7d'} className="block rounded px-3 py-2 text-[11px] hover:bg-white/[0.06]">View backend jobs</Link></div></details>} tabs={selected.catalogOnly ? ['Details'] : editSection ? ['Details','Pricing','Plan Access','Advanced'] : ['Details','Plans','Usage','Cost History']} activeTab={editSection ? ({ identity: 'Details', pricing: 'Pricing', configuration: 'Plan Access', routing: 'Advanced' }[editSection]) : tab} onTab={(next) => { if (editSection) setEditSection(({ Details: 'identity', Pricing: 'pricing', 'Plan Access': 'configuration', Advanced: 'routing' } as const)[next as 'Details' | 'Pricing' | 'Plan Access' | 'Advanced']); else setTab(next); }} onClose={() => { setSelectedKey(null); setEditSection(null); }}>
      {selected.catalogOnly && <div className="space-y-4"><ModelDetailCard title="Catalog listing"><ModelTile label="Visible model">{selected.displayName}</ModelTile><ModelTile label="Brand">{brandOf(selected)}</ModelTile><ModelTile label="Modality">{humanizeIdentifier(selected.modality)}</ModelTile><ModelTile label="Backend route">—</ModelTile><ModelTile label="Customer price">—</ModelTile><ModelTile label="Plan access">—</ModelTile></ModelDetailCard><p className="text-[12px] leading-relaxed text-[var(--studio-text-secondary)]">No backend route, customer price, capabilities, or plan access has been configured for this catalog listing. Create a visible model ID, then configure those fields before enabling it.</p><AdminModelCreate key={selected.key} initial={{ displayName: selected.displayName, modality: selected.modality as 'chat' | 'image' | 'video' }} /></div>}
      {!selected.catalogOnly && !editSection && tab === 'Details' && <div className="space-y-3">
        <ModelDetailCard title="Model Identity" onEdit={() => setEditSection(editSection === 'identity' ? null : 'identity')}>
          <ModelTile label="Visible Model">{selected.displayName}</ModelTile><ModelTile label="Brand">{brandOf(selected)}{selected.category?.trim() ? '' : ' (inferred)'}</ModelTile><ModelTile label="Modality">{humanizeIdentifier(selected.modality)}</ModelTile><ModelTile label="Icon">{selected.mediaUrl ?? 'Default brand icon'}</ModelTile><ModelTile label="Availability note">{selected.availabilityLabel ?? '—'}</ModelTile>
        </ModelDetailCard>
        <ModelDetailCard title="Execution" onEdit={() => setEditSection(editSection === 'routing' ? null : 'routing')}>
          <ModelTile label="Backend">{route?.providerModelId ?? selected.modelId}</ModelTile><ModelTile label="Provider">{providerName ?? '—'}</ModelTile><ModelTile label="Provider Route">{route?.providerId ?? '—'}</ModelTile><ModelTile label="Primary Route">{selected.priority === 'primary' ? 'Yes' : 'No'}</ModelTile><ModelTile label="Fallback Route" wide>{selected.routes.find((item) => item.enabled && item.fallback)?.providerId ?? '—'}</ModelTile>{selected.modality === 'chat' && <ModelTile label="Chat metering">{selected.creditPrice != null ? `Metered · weight ${selected.creditPrice}` : 'Unconfigured weight'}</ModelTile>}
        </ModelDetailCard>
        <ModelDetailCard title="Pricing" onEdit={() => setEditSection(editSection === 'pricing' ? null : 'pricing')}>
          <ModelTile label="Provider Price"><ProviderEconomics row={selected} /></ModelTile><ModelTile label="VANTRA Cost"><ModelOperatorCost row={selected} /></ModelTile><ModelTile label="Customer Cost">{customerCost(selected)}</ModelTile><ModelTile label="Billing Type">{selected.modality === 'chat' ? 'Weighted units / request' : selected.modality === 'image' ? 'Per image' : 'Per video'}</ModelTile>
        </ModelDetailCard>
        <ModelDetailCard title="Internal" onEdit={() => setEditSection('identity')}><ModelTile label="Last Updated"><DateValue value={selected.updatedAt} /></ModelTile><ModelTile label="Notes" wide>{selected.shortDescription ?? '—'}</ModelTile></ModelDetailCard>
        <TechnicalDetails><TechnicalId label="Model key" value={selected.key} /><TechnicalId label="Backend model ID" value={selected.modelId} />{selected.providerCost && <p>Stored cost: {selected.providerCost.minor} minor units {selected.providerCost.currency}</p>}</TechnicalDetails><AdminModelLifecycleControls modelKey={selected.key} archived={selected.archived} />
      </div>}
      {editSection && <div className="space-y-4">
        {editSection === 'identity' && <><AdminModelPresentationControls model={selected} onSaved={(presentation) => setModels((current) => current.map((item) => item.key === selected.key ? { ...item, displayName: presentation.displayName, shortDescription: presentation.shortDescription, mediaUrl: presentation.mediaUrl, category: presentation.category, sortOrder: presentation.sortOrder, visibleInStudio: presentation.visibleInStudio, availabilityLabel: presentation.availabilityLabel, updatedAt: presentation.updatedAt, persisted: true } : item))} /><AdminModelCapabilitiesControls model={selected} onSaved={(capabilities, updatedAt) => setModels((current) => current.map((item) => item.key === selected.key ? { ...item, capabilities, updatedAt, persisted: true } : item))} /></>}
        {editSection === 'pricing' && <><p className="text-[12px] text-[var(--studio-text-secondary)]">Customer cost changes affect future usage. Historical jobs remain unchanged.</p><AdminModelControls model={selected} mode="pricing" onSaved={(config) => { saveConfig(config); setEditSection(null); }} /></>}
        {editSection === 'configuration' && <AdminModelControls model={selected} mode="plans" onSaved={(config) => { saveConfig(config); setEditSection(null); }} />}
        {editSection === 'routing' && <><p className="text-[12px] text-[var(--studio-text-secondary)]">Routing changes affect future requests. Recorded jobs remain historical.</p><AdminModelControls model={selected} mode="routing" onSaved={saveConfig} /><AdminModelRouteControls modelKey={selected.key} routes={selected.routes} providerOptions={selected.providerOptions} onCreated={(createdRoute) => setModels((current) => current.map((item) => item.key === selected.key ? { ...item, routes: [...item.routes, createdRoute] } : item))} onSaved={(savedRoute) => setModels((current) => current.map((item) => item.key === selected.key ? { ...item, routes: item.routes.map((itemRoute) => itemRoute.id === savedRoute.id ? { ...itemRoute, ...savedRoute } : itemRoute) } : item))} /></>}
        <div className="flex justify-end border-t border-[var(--studio-border)] pt-4"><button type="button" onClick={() => setEditSection(null)} className="h-9 rounded-lg border border-[var(--studio-border)] px-4 text-[12px]">Cancel</button></div>
      </div>}
      {!editSection && tab === 'Plans' && <div className="space-y-4"><ModelDetailCard title="Access" onEdit={() => setEditSection('configuration')}><ModelTile label="Visibility">{selected.visibleInStudio ? 'Visible' : 'Hidden'}</ModelTile><ModelTile label="Status"><Status value={selected.archived ? 'archived' : selected.enabled ? 'active' : 'disabled'} /></ModelTile>{['free','lite','pro','max'].map((plan) => <ModelTile key={plan} label={humanizeIdentifier(plan)}>{selected.allowedPlans.includes(plan as AdminModelRow['allowedPlans'][number]) ? 'Allowed' : 'Not allowed'}</ModelTile>)}</ModelDetailCard></div>}
      {!editSection && tab === 'Usage' && <div className="space-y-3">
        <section className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-card)] p-4">
          <div className="flex items-center justify-between gap-3"><h3 className="text-[15px] font-semibold">Usage Overview</h3><span className="rounded-lg border border-[var(--studio-border)] px-3 py-2 text-[11px] text-[var(--studio-text-secondary)]">Last 7 days</span></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{['Total Jobs', 'Successful Jobs', 'Failed Jobs', 'VANTRA Cost'].map((name) => <div key={name} className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-recessed)] p-3"><p className="text-[10px] text-[var(--studio-text-secondary)]">{name}</p><p className="mt-3 text-[18px] font-semibold text-[var(--studio-text-muted)]">—</p></div>)}</div>
        </section>
        <section className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-card)] p-4"><h3 className="text-[15px] font-semibold">Daily Usage</h3><div className="mt-4 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-[var(--studio-border)] text-center text-[12px] text-[var(--studio-text-secondary)]">Visible-model usage cannot be attributed from current job records.</div></section>
        <section className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-card)] p-4"><h3 className="text-[15px] font-semibold">Recent Jobs</h3><p className="mt-3 text-[12px] leading-relaxed text-[var(--studio-text-secondary)]">Multiple visible models can share one backend identifier, so these jobs cannot be attributed to this model reliably.</p><Link href={'/admin/jobs?model=' + encodeURIComponent(selected.modelId) + '&range=7d'} prefetch={false} className="mt-4 inline-flex min-h-9 items-center rounded-lg border border-[var(--studio-border)] px-3 text-[12px] font-semibold text-[var(--studio-text-primary)] hover:bg-[var(--studio-hover)]">View backend jobs in Jobs &amp; Usage</Link></section>
      </div>}
      {!editSection && tab === 'Cost History' && <div className="rounded-xl border border-[var(--studio-border)] bg-white/[0.015] p-4"><h3 className="text-[14px] font-semibold text-white">Recorded model changes</h3>{selected.audit.length ? selected.audit.map((item) => <div key={item.id} className="border-b border-[var(--studio-border-subtle)] py-3 text-[12px]"><p className="font-medium text-white">{humanizeIdentifier(item.action)}</p><p className="mt-1 text-[11px] text-[var(--studio-text-muted)]"><DateValue value={item.createdAt} /></p>{item.previousState?.customer_credit_price !== item.newState?.customer_credit_price && <p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]">Customer cost: {String(item.previousState?.customer_credit_price ?? '—')} → {String(item.newState?.customer_credit_price ?? '—')}</p>}</div>) : <Empty label="No recorded model changes." />}</div>}
    </WorkspaceDrawer>}</>;
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
  allowances: { plan_code: 'lite' | 'pro' | null; subscription_base: string | null; rollover: string | null; lite_videos: number | null };
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

function RemainingAllowance({ remaining, total }: { remaining: number | string | null; total?: number | string | null }) {
  const current = remaining === null ? null : Number(remaining);
  const allowance = total == null ? null : Number(total);
  const valid = current !== null && allowance !== null && Number.isSafeInteger(current)
    && Number.isSafeInteger(allowance) && allowance > 0 && current >= 0 && current <= allowance;
  return <div className="max-w-xs"><span className="tabular-nums">{remaining ?? '—'}{total != null && ` / ${total}`}</span>{valid && <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true"><div className="h-full rounded-full bg-emerald-300/75" style={{ width: `${current / allowance * 100}%` }} /></div>}</div>;
}

function storedBaseRemaining(subscription: string | null, rollover: string | null) {
  if (subscription === null || rollover === null) return null;
  try {
    const base = BigInt(subscription) - BigInt(rollover);
    return base >= 0n ? base.toString() : null;
  } catch { return null; }
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
  const [actionsOpen, setActionsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'email' | 'id' | 'failed' | null>(null);
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
    && (!item.ends_at || Date.parse(item.ends_at) > Date.now())) ?? null;
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
  const periodAllowances = data?.allowances.plan_code === plan ? data.allowances : null;
  const avatar = (user.displayName ?? user.email.split('@')[0]).split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U';
  const copyValue = async (value: string, field: 'email' | 'id') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(field);
    } catch {
      setCopyStatus('failed');
    }
  };
  const canLeave = () => {
    const form = drawerRef.current?.querySelector<HTMLFormElement>('form[data-credit-adjustment-state]');
    if (!form) return true;
    if (form.dataset.creditAdjustmentState === 'saving') return false;
    const fields = Array.from(form.querySelectorAll<HTMLInputElement>('input'));
    return fields.every((field) => !field.value.trim()) || window.confirm('Discard the unfinished credit adjustment?');
  };
  const closeDrawer = () => { if (canLeave()) drawerRef.current?.close(); };

  return <dialog ref={drawerRef} onClose={onClose} onCancel={(event) => { if (!canLeave()) event.preventDefault(); }} onClick={(event) => { if (event.target === drawerRef.current) closeDrawer(); }} aria-label={`User details for ${user.email}`} className="fixed inset-y-0 end-0 m-0 ms-auto h-dvh max-h-dvh w-full max-w-[960px] overflow-y-auto border-s border-[var(--studio-border)] bg-[#111112] p-0 text-white shadow-[0_0_36px_rgba(0,0,0,0.2)] backdrop:bg-black/65 lg:w-[58vw]">
    <div className="sticky top-0 z-20 border-b border-[var(--studio-border)] bg-[#111112]">
      <div className="flex items-start gap-4 px-6 pb-5 pt-6">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-[18px] font-medium text-white">{avatar}</span>
        <div className="min-w-0 flex-1 text-start"><h2 className="truncate text-[20px] font-semibold tracking-[-0.025em] text-white">{user.displayName ?? user.email}</h2>{user.displayName && <p className="mt-0.5 truncate text-[11.5px] text-[var(--studio-text-secondary)]">{user.email}</p>}<div className="mt-2 flex flex-wrap items-center gap-2"><Badge>{user.plan}</Badge><Status value={user.status} /></div></div>
        <div className="relative shrink-0">
          <button type="button" aria-label="User actions" aria-expanded={actionsOpen} onClick={() => setActionsOpen((current) => !current)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--studio-border)] text-[var(--studio-text-secondary)] hover:bg-white/[0.06] hover:text-white"><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></button>
          {actionsOpen && <div className="absolute end-0 top-11 z-30 w-52 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-1.5 shadow-xl">
            <button type="button" onClick={() => { setTab('credits'); setActionsOpen(false); }} className="flex min-h-9 w-full items-center rounded-md px-2.5 text-start text-[11.5px] font-medium text-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">Adjust Usage Balance</button>
            <button type="button" onClick={() => void copyValue(user.id, 'id')} className="flex min-h-9 w-full items-center rounded-md px-2.5 text-start text-[11.5px] font-medium text-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">{copyStatus === 'id' ? 'User ID copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy User ID'}</button>
            <div className="my-1 border-t border-[var(--studio-border-subtle)]" />
            <AdminUserActions userId={user.id} status={user.status} isOwner={user.isOwner} onChanged={(status) => { onStatusChanged(status); setActionsOpen(false); }} />
          </div>}
        </div>
        <button type="button" onClick={closeDrawer} aria-label="Close user details" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--studio-text-secondary)] hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <div role="tablist" aria-label="User details" className="flex gap-1 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{tabs.map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => { if (value === tab || canLeave()) { setTab(value); setActionsOpen(false); } }} className={`shrink-0 border-b-2 px-2.5 pb-3 pt-1 text-[11.5px] font-medium transition-colors ${tab === value ? 'border-white text-white' : 'border-transparent text-[var(--studio-text-secondary)] hover:text-white'}`}>{tabLabels[value]}</button>)}</div>
    </div>

    <div className="px-6 pb-8">
      {tab === 'overview' && <div>
        <UserOverviewSection icon={<UserRound className="h-5 w-5" />} title="Account" description="Basic information and account status.">
          <UserOverviewField label="Email"><span className="flex items-center justify-between gap-2"><span className="break-all">{user.email}</span><button type="button" onClick={() => void copyValue(user.email, 'email')} aria-label="Copy email" title={copyStatus === 'email' ? 'Copied' : 'Copy email'} className="shrink-0 rounded p-1.5 text-[var(--studio-text-secondary)] hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"><Copy className="h-3.5 w-3.5" /></button></span></UserOverviewField>
          <UserOverviewField label="User ID"><span className="flex items-center justify-between gap-2"><span className="truncate font-mono text-[11px]" title={user.id}>{user.id}</span><button type="button" onClick={() => void copyValue(user.id, 'id')} aria-label="Copy User ID" title={copyStatus === 'id' ? 'Copied' : 'Copy User ID'} className="shrink-0 rounded p-1.5 text-[var(--studio-text-secondary)] hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"><Copy className="h-3.5 w-3.5" /></button></span></UserOverviewField>
          <UserOverviewField label="Joined"><DateValue value={user.createdAt} /></UserOverviewField>
          <UserOverviewField label="Last active"><DateValue value={user.lastSignInAt} /></UserOverviewField>
          <UserOverviewField label="Email status"><div><Badge tone={user.emailConfirmed ? 'success' : 'warning'}>{user.emailConfirmed ? 'Verified' : 'Unconfirmed'}</Badge><p className="mt-1 text-[11px] font-normal text-[var(--studio-text-muted)]">{user.emailConfirmed ? 'Email address confirmed.' : 'Email address has not been confirmed.'}</p></div></UserOverviewField>
          <UserOverviewField label="Account status"><Status value={user.status} /></UserOverviewField>
        </UserOverviewSection>
        <UserOverviewSection icon={<CreditCard className="h-5 w-5" />} title="Subscription" description="Plan and manual billing details.">
          <UserOverviewField label="Plan">{user.plan}</UserOverviewField>
          <UserOverviewField label="Access">{plan === 'free' ? 'One-time trial' : currentEntitlement ? humanizeIdentifier(currentEntitlement.status) : data ? 'No active paid period' : 'Loading…'}</UserOverviewField>
          <UserOverviewField label="Current period">{plan === 'free' ? 'One-time allowance' : currentEntitlement ? <><DateValue value={currentEntitlement.starts_at} /> – <DateValue value={currentEntitlement.ends_at} /></> : data ? '—' : 'Loading…'}</UserOverviewField>
          {plan !== 'free' && <UserOverviewField label="Period ends">{currentEntitlement ? <DateValue value={currentEntitlement.ends_at} /> : data ? '—' : 'Loading…'}</UserOverviewField>}
          <UserOverviewField label="Billing">{plan === 'free' ? 'No payment required' : 'Manual payment'}</UserOverviewField>
        </UserOverviewSection>
        <UserOverviewSection icon={<ImageIcon className="h-5 w-5" />} title="Media" description="Current stored allowances and balances.">
          {plan === 'free' ? <>
            <UserOverviewField label="Images remaining"><RemainingAllowance remaining={usageBalances.free_image_remaining} total={5} /></UserOverviewField>
            <UserOverviewField label="Videos remaining"><RemainingAllowance remaining={usageBalances.free_video_remaining} total={1} /></UserOverviewField>
            <p className="pt-3 text-[11px] text-[var(--studio-text-muted)]">Free includes a one-time trial allowance of 5 images and 1 video.</p>
          </> : plan === 'lite' ? <>
            <UserOverviewField label="Subscription Credits"><RemainingAllowance remaining={usageBalances.subscription_balance} total={periodAllowances?.subscription_base} /></UserOverviewField>
            <UserOverviewField label="Included Videos remaining"><RemainingAllowance remaining={usageBalances.lite_video_remaining} total={periodAllowances?.lite_videos} /></UserOverviewField>
            {isPositiveStoredBalance(usageBalances.purchased_balance) && <UserOverviewField label="Purchased Credits"><RemainingAllowance remaining={usageBalances.purchased_balance} /></UserOverviewField>}
            <p className="pt-3 text-[11px] text-[var(--studio-text-muted)]">Included videos are separate from Subscription Credits.</p>
          </> : plan === 'pro' ? <>
            <UserOverviewField label="Subscription Credits"><RemainingAllowance remaining={storedBaseRemaining(usageBalances.subscription_balance, usageBalances.subscription_rollover_balance)} total={periodAllowances?.subscription_base} /></UserOverviewField>
            <UserOverviewField label="Rollover Credits"><RemainingAllowance remaining={usageBalances.subscription_rollover_balance} total={periodAllowances?.rollover && BigInt(periodAllowances.rollover) > 0n ? periodAllowances.rollover : null} /></UserOverviewField>
            <UserOverviewField label="Purchased Credits"><RemainingAllowance remaining={usageBalances.purchased_balance} /></UserOverviewField>
          </> : <>
            <UserOverviewField label="Current Credits"><RemainingAllowance remaining={usageBalances.balance} /></UserOverviewField>
            <UserOverviewField label="Subscription Credits"><RemainingAllowance remaining={usageBalances.subscription_balance} /></UserOverviewField>
            <UserOverviewField label="Rollover Credits"><RemainingAllowance remaining={usageBalances.subscription_rollover_balance} /></UserOverviewField>
            <UserOverviewField label="Purchased Credits"><RemainingAllowance remaining={usageBalances.purchased_balance} /></UserOverviewField>
          </>}
        </UserOverviewSection>
        <details className="group border-b border-[var(--studio-border-subtle)] py-5"><summary className="flex cursor-pointer list-none items-center gap-3 text-start [&::-webkit-details-marker]:hidden"><ChevronRight className="h-4 w-4 text-[var(--studio-text-secondary)] transition-transform group-open:rotate-90" aria-hidden="true" /><span><strong className="block text-[12px] font-semibold text-white">Technical details</strong><span className="mt-0.5 block text-[10.5px] text-[var(--studio-text-muted)]">IDs and raw account references</span></span></summary><div className="mt-4 rounded-xl border border-[var(--studio-border-subtle)] bg-black/15 p-3"><TechnicalId label={t('common.userId')} value={user.id} /><p className="mt-2 text-[11px] text-[var(--studio-text-secondary)]">Credit balance: <span className="tabular-nums text-white">{balance ?? '—'}</span></p><p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]">Payment records: <span className="tabular-nums text-white">{user.paymentOrderCount}</span></p></div></details>
      </div>}
      {tab === 'security' && <div className="space-y-4 py-6"><p className="text-[12px] text-[var(--studio-text-secondary)]">{t('users.securityHelp')}</p><AdminUserActions userId={user.id} status={user.status} isOwner={user.isOwner} onChanged={onStatusChanged} /></div>}
      {tab !== 'overview' && tab !== 'security' && (error ? <div className="pt-6"><Notice reason="query_failed" /></div> : !data ? <div role="status" aria-label={t('users.loading')} className="space-y-3 py-8 animate-pulse"><div className="h-12 rounded bg-white/[0.05]" /><div className="h-12 rounded bg-white/[0.04]" /><div className="h-12 rounded bg-white/[0.03]" /></div> : <div className="space-y-2 py-6 text-[12px]">
        {tab === 'subscription' && <><div className="mb-4 border-b border-[var(--studio-border-subtle)] pb-4"><h3 className="text-[13px] font-semibold text-white">Subscription history</h3><p className="mt-1 text-[11px] text-[var(--studio-text-muted)]">Paid periods are activated through manual payments.</p></div>{data.entitlements.length ? data.entitlements.map((item) => <div key={item.id} className="grid gap-2 border-b border-[var(--studio-border-subtle)] py-3 sm:grid-cols-[minmax(0,1fr)_auto]"><div><p className="font-semibold text-white">{item.plan_name}</p><p className="mt-1 text-[var(--studio-text-muted)]"><DateValue value={item.starts_at} /> – <DateValue value={item.ends_at} /></p></div><div><Status value={item.status} /></div></div>) : <Empty label="No paid subscription periods recorded." />}</>}
        {tab === 'credits' && <><div className="grid gap-x-6 border-b border-[var(--studio-border-subtle)] pb-5 sm:grid-cols-2"><UserOverviewField label={t('users.balance')}><span className="tabular-nums">{balance ?? '—'}</span></UserOverviewField><UserOverviewField label="Subscription"><span className="tabular-nums">{usageBalances.subscription_balance ?? '—'}</span></UserOverviewField><UserOverviewField label="Rollover"><span className="tabular-nums">{usageBalances.subscription_rollover_balance ?? '—'}</span></UserOverviewField><UserOverviewField label="Purchased"><span className="tabular-nums">{usageBalances.purchased_balance ?? '—'}</span></UserOverviewField></div><div className="pt-4"><AdminCreditAdjustment userId={user.id} onAdjusted={(result) => { setBalance(result.balance); onCreditChanged(result.balance); setData((current) => current ? { ...current, balances: current.balances ? { ...current.balances, balance: result.balance } : null, ledger: [result.transaction, ...current.ledger.filter((item) => item.id !== result.transaction.id)] } : current); void fetch(`/api/admin/users/${user.id}/detail`).then((response) => response.ok ? response.json() : null).then((fresh: UserDetailData | null) => { if (fresh) setData(fresh); }).catch(() => {}); }} /></div><h3 className="pt-2 text-[12px] font-semibold text-white">Ledger history</h3>{data.ledger.length ? data.ledger.map((item) => <div key={item.id} className="flex justify-between gap-3 border-b border-[var(--studio-border-subtle)] py-2"><div><strong>{t.has(`status.${item.transaction_type}`) ? t(`status.${item.transaction_type}`) : item.transaction_type}</strong><p className="text-[var(--studio-text-muted)]">{item.reason}</p></div><div className="shrink-0 text-end tabular-nums">{item.amount}<p className="text-[var(--studio-text-muted)]"><DateValue value={item.created_at} /></p></div></div>) : <Empty />}</>}
        {tab === 'payments' && (data.payments.length ? data.payments.map((item) => <div key={item.id} className="flex justify-between gap-3 border-b border-[var(--studio-border-subtle)] py-2"><div><strong>{item.plan_name}</strong><div className="mt-1"><Status value={item.status} /></div></div><div className="shrink-0 text-end tabular-nums">{item.amount_dzd} DZD<p className="text-[var(--studio-text-muted)]"><DateValue value={item.created_at} /></p></div></div>) : <Empty />)}
        {tab === 'jobs' && (data.jobs.length ? data.jobs.map((item) => <div key={item.id} className="flex justify-between gap-3 border-b border-[var(--studio-border-subtle)] py-2"><div><strong>{humanizeIdentifier(item.model_id)}</strong><p className="text-[var(--studio-text-muted)]">{humanizeIdentifier(item.modality)} · {humanizeIdentifier(item.state)}</p><TechnicalDetails><TechnicalId label={t('common.modelId')} value={item.model_id} /></TechnicalDetails></div><div className="shrink-0 text-end tabular-nums">{item.credits_charged ?? '—'}<p className="text-[var(--studio-text-muted)]"><DateValue value={item.created_at} /></p></div></div>) : <Empty />)}
        {tab === 'audit' && (data.audit.length ? data.audit.map((item) => <div key={item.id} className="flex justify-between gap-3 border-b border-[var(--studio-border-subtle)] py-2"><strong>{t.has(`audit.actions.${item.action}`) ? t(`audit.actions.${item.action}`) : humanizeIdentifier(item.action)}</strong><DateValue value={item.created_at} /></div>) : <Empty />)}
      </div>)}
    </div>
  </dialog>;
}

export function JobsView({ result, filters }: { result: AdminDataResult<AdminJobsData>; filters: { q?: string; status?: string; modality?: string; provider?: string; model?: string; range?: string; cursor?: string; seen?: string } }) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.q ?? '');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tab, setTab] = useState('Overview');
  const selected = selectedIndex == null ? null : result.data.jobs[selectedIndex];
  const control = 'h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 text-[12px] text-white outline-none focus-visible:border-white/40';
  const update = (key: string, value: string) => {
    const params = new URLSearchParams();
    for (const [name, current] of Object.entries(filters)) if (current && name !== 'cursor' && name !== 'seen') params.set(name, current);
    if (value && value !== 'all') params.set(key, value); else params.delete(key);
    router.replace(`/admin/jobs?${params.toString()}`);
  };
  useEffect(() => { if (search === (filters.q ?? '')) return; const timer = window.setTimeout(() => update('q', search), 300); return () => window.clearTimeout(timer); }, [search, filters.q]);
  const options = (key: 'provider' | 'model') => [...new Set(result.data.jobs.map((job) => key === 'provider' ? job.provider : job.modelId).filter((value): value is string => Boolean(value)))].sort();
  const nextParams = new URLSearchParams(Object.entries(filters).filter(([key, value]) => key !== 'cursor' && Boolean(value)) as [string, string][]);
  if (result.data.nextCursor) { nextParams.set('cursor', result.data.nextCursor); nextParams.set('seen', String((Number(filters.seen) || 0) + result.data.jobs.length)); }
  const section = 'border-b border-[var(--studio-border-subtle)] pb-5';
  const label = 'mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white';
  const usage = (job: AdminJobRow) => job.creditsCharged == null ? '—' : `${job.creditsCharged} credits`;
  return <><PageHeader title="Jobs & Usage" description="Monitor AI requests, usage, failures, credits, and provider costs." compact />
    {!result.available && <Notice reason={result.reason} />}
    <div className="relative mb-3"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--studio-text-muted)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by job ID, user, or model..." aria-label="Search jobs" className={`${control} h-11 w-full ps-10`} /></div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div role="tablist" aria-label="Job modality" className="flex gap-0.5 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] p-0.5">{['all','chat','image','video'].map((value) => <button key={value} type="button" role="tab" aria-selected={(filters.modality ?? 'all') === value} onClick={() => update('modality', value)} className={`h-8 rounded-md px-3 text-[12px] ${(filters.modality ?? 'all') === value ? 'bg-white text-black' : 'text-[var(--studio-text-secondary)] hover:text-white'}`}>{humanizeIdentifier(value)}</button>)}</div><div className="flex flex-wrap gap-2">
      <select aria-label="Status" value={filters.status ?? 'all'} onChange={(event) => update('status', event.target.value)} className={control}><option value="all">All statuses</option>{['reserved','streaming','completed','failed','cancelled','pending','processing'].map((value) => <option key={value} value={value}>{humanizeIdentifier(value)}</option>)}</select>
      <select aria-label="Provider" value={filters.provider ?? 'all'} onChange={(event) => update('provider', event.target.value)} className={control}><option value="all">All providers</option>{options('provider').map((value) => <option key={value} value={value}>{value}</option>)}{filters.provider && !options('provider').includes(filters.provider) && <option value={filters.provider}>{filters.provider}</option>}</select>
      <select aria-label="Model" value={filters.model ?? 'all'} onChange={(event) => update('model', event.target.value)} className={control}><option value="all">All models</option>{options('model').map((value) => <option key={value} value={value}>{value}</option>)}{filters.model && !options('model').includes(filters.model) && <option value={filters.model}>{filters.model}</option>}</select>
      <select aria-label="Range" value={filters.range ?? '7d'} onChange={(event) => update('range', event.target.value)} className={control}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All time</option></select><Link href="/admin/jobs" className="self-center px-2 text-[11px] text-[var(--studio-text-secondary)] underline hover:text-white">Clear filters</Link></div></div>
    <p className="mb-2 text-[11px] text-[var(--studio-text-muted)]">{result.data.total} jobs</p>
    {result.data.jobs.length ? <TableFrame><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-start text-[12px]"><thead><tr>{['Job','User','Model','Provider','Status','Usage','VANTRA Cost','Time'].map((name) => <th key={name}>{name}</th>)}</tr></thead><tbody>{result.data.jobs.map((job, index) => <tr key={`${job.source}:${job.id}:${index}`} tabIndex={0} role="button" onClick={() => { setSelectedIndex(index); setTab('Overview'); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedIndex(index); setTab('Overview'); } }} className="cursor-pointer border-b border-[var(--studio-border-subtle)] focus-visible:outline focus-visible:outline-white/50"><td className="font-medium text-white"><div className="flex items-center gap-2">{job.modality === 'video' ? <Video className="h-4 w-4 shrink-0 text-[var(--studio-text-secondary)]" /> : job.modality === 'image' ? <ImageIcon className="h-4 w-4 shrink-0 text-[var(--studio-text-secondary)]" /> : <MessageCircle className="h-4 w-4 shrink-0 text-[var(--studio-text-secondary)]" />}<div>{humanizeIdentifier(job.modality)}<span className="block truncate text-[10px] text-[var(--studio-text-muted)]">{job.id.slice(0, 8)}</span></div></div></td><td className="max-w-[180px] truncate">{job.userEmail ?? '—'}</td><td className="max-w-[160px] truncate">{job.vantraModelName ?? job.modelName ?? job.modelId}</td><td>{job.provider ?? '—'}</td><td><Status value={job.status} /></td><td className="tabular-nums">{usage(job)}</td><td><OperatorCost value={job.providerCost} /></td><td><DateValue value={job.createdAt} compact /></td></tr>)}</tbody></table></div></TableFrame> : <Empty label="No jobs match these filters." />}
    <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--studio-text-muted)]"><span>{(Number(filters.seen) || 0) + result.data.jobs.length} / {result.data.total}</span>{result.data.nextCursor && <Link href={`/admin/jobs?${nextParams}`} prefetch={false} className="rounded-lg border border-[var(--studio-border)] px-3 py-2 text-white">Next page</Link>}</div>
    {selected && <WorkspaceDrawer compact title={`${humanizeIdentifier(selected.modality)} job`} subtitle={`#${selected.id.slice(0, 8)}`} icon={selected.modality === 'video' ? <Video className="h-5 w-5" /> : selected.modality === 'image' ? <ImageIcon className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />} badges={<><Badge>{selected.vantraModelName ?? selected.modelName ?? selected.modelId}</Badge><Status value={selected.status} /><span className="self-center text-[11px] text-[var(--studio-text-secondary)]">{selected.userEmail ?? '—'}</span></>} tabs={['Overview','Routing','Usage & Cost','Timeline']} activeTab={tab} onTab={setTab} onClose={() => setSelectedIndex(null)}>
      {tab === 'Overview' && <div className="space-y-5"><section className={section}><h3 className={label}>Job</h3><WorkspaceField label="Type">{humanizeIdentifier(selected.modality)}</WorkspaceField><WorkspaceField label="Status"><Status value={selected.status} /></WorkspaceField><WorkspaceField label="Created"><DateValue value={selected.createdAt} /></WorkspaceField><WorkspaceField label="Completed / updated"><DateValue value={selected.completedAt ?? selected.updatedAt} /></WorkspaceField>{selected.latencyMs != null && <WorkspaceField label="Latency">{selected.latencyMs} ms</WorkspaceField>}</section>
        <section className={section}><h3 className={label}>User</h3><WorkspaceField label="Email">{selected.userEmail ?? '—'}</WorkspaceField><Link href={`/admin/users?q=${encodeURIComponent(selected.userEmail ?? selected.userId)}`} className="mt-2 inline-block text-[11px] text-white underline">Open user</Link></section>
        <section className={section}><h3 className={label}>Model</h3><WorkspaceField label="VANTRA Model">{selected.vantraModelName ?? 'Not recorded separately'}</WorkspaceField><WorkspaceField label="Backend Model">{selected.modelId}</WorkspaceField></section>
        {selected.error && <section className={section}><h3 className={label}>Error</h3><p className="break-words text-[12px] text-red-100">{selected.error}</p></section>}
        {selected.prompt && <section><h3 className={label}>Request details</h3><p className="break-words text-[12px] text-[var(--studio-text-secondary)]">{selected.prompt}</p></section>}<TechnicalDetails><TechnicalId label="Job ID" value={selected.id} /><TechnicalId label="User ID" value={selected.userId} />{selected.usageMetadata && <pre className="mt-2 whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(selected.usageMetadata, null, 2)}</pre>}</TechnicalDetails></div>}
      {tab === 'Routing' && <div><WorkspaceField label="VANTRA Model">{selected.vantraModelName ?? 'Not recorded separately'}</WorkspaceField><WorkspaceField label="Backend Model">{selected.modelId}</WorkspaceField><WorkspaceField label="Provider">{selected.provider ?? '—'}</WorkspaceField><WorkspaceField label="Provider model">{selected.providerModelId ?? '—'}</WorkspaceField>{selected.attempts.length > 0 && <section className="mt-5"><h3 className={label}>Provider attempts</h3>{selected.attempts.map((attempt, index) => <div key={`${attempt.startedAt}:${index}`} className="border-b border-[var(--studio-border-subtle)] py-2 text-[12px]"><span className="font-medium">{attempt.provider}</span> · {humanizeIdentifier(attempt.state)} · <DateValue value={attempt.startedAt} />{attempt.error && <p className="text-red-100">{attempt.error}</p>}</div>)}</section>}</div>}
      {tab === 'Usage & Cost' && <div><WorkspaceField label="Credits / usage">{usage(selected)}</WorkspaceField><WorkspaceField label="VANTRA Cost"><OperatorCost value={selected.providerCost} /></WorkspaceField><WorkspaceField label="Reservation state">{selected.reservationState ? humanizeIdentifier(selected.reservationState) : '—'}</WorkspaceField><TechnicalDetails>{selected.providerCost && <p>Stored cost: {selected.providerCost.minor} minor units {selected.providerCost.currency}</p>}{selected.usageMetadata ? <pre className="whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(selected.usageMetadata, null, 2)}</pre> : <p>No additional usage metadata recorded.</p>}</TechnicalDetails></div>}
      {tab === 'Timeline' && <div className="space-y-4"><div className="border-s border-white/20 ps-4"><p className="font-medium">Created</p><DateValue value={selected.createdAt} /></div>{selected.attempts.map((attempt, index) => <div key={`${attempt.startedAt}:${index}`} className="border-s border-white/20 ps-4"><p className="font-medium">{attempt.provider} · {humanizeIdentifier(attempt.state)}</p><DateValue value={attempt.startedAt} /></div>)}{selected.completedAt && <div className="border-s border-white/20 ps-4"><p className="font-medium">{humanizeIdentifier(selected.status)}</p><DateValue value={selected.completedAt} /></div>}<TechnicalDetails><TechnicalId label="Job ID" value={selected.id} /><TechnicalId label="User ID" value={selected.userId} />{selected.usageMetadata && <pre className="mt-2 whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(selected.usageMetadata, null, 2)}</pre>}</TechnicalDetails></div>}
    </WorkspaceDrawer>}</>;
}

export function RuntimeLimitsView({ result }: { result: AdminDataResult<AdminProviderRow[]> }) { return <RemainingRuntimeView result={result} />; }
export function AuditView({ result }: { result: AdminDataResult<AdminAuditRow[]> }) { return <RemainingAuditView result={result} />; }
export function PlansPricingView({ result }: { result: AdminDataResult<AdminPaymentPlan[]> }) { return <RemainingPlansView result={result} />; }

export function PaymentsView({ result }: { result: AdminDataResult<AdminPaymentRow[]>; initialStatus?: string }) {
  const locale = useLocale();
  const [payments, setPayments] = useState(result.data);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  const [method, setMethod] = useState('all');
  const [range, setRange] = useState('30d');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState('Overview');
  useEffect(() => setPayments(result.data), [result.data]);
  const selected = payments.find((payment) => payment.id === selectedId);
  const plans = [...new Set(payments.map((payment) => payment.planName))].sort();
  const methods = [...new Set(payments.map((payment) => payment.paymentMethod))].sort();
  const statuses = [...new Set(payments.map((payment) => payment.status))].sort();
  const filtered = payments.filter((payment) => {
    const text = `${payment.id} ${payment.userEmail} ${payment.paymentReference} ${payment.customerReference ?? ''}`.toLowerCase();
    const stamp = payment.submittedAt ?? payment.createdAt;
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 0;
    return (!query || text.includes(query.toLowerCase())) && (kind === 'all' || payment.orderKind === kind)
      && (status === 'all' || payment.status === status) && (plan === 'all' || payment.planName === plan)
      && (method === 'all' || payment.paymentMethod === method)
      && (!days || new Date(stamp).getTime() >= Date.now() - days * 86_400_000);
  });
  const pending = filtered.filter((payment) => payment.status === 'pending').length;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 8) - 1));
  const visiblePayments = filtered.slice(currentPage * 8, (currentPage + 1) * 8);
  const control = 'h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 text-[12px] text-white outline-none focus-visible:border-white/40';
  const section = 'rounded-xl border border-[var(--studio-border)] bg-white/[0.015] p-4';
  const label = 'mb-3 text-[13px] font-semibold text-white';
  const money = (payment: AdminPaymentRow) => <span dir="ltr" className="tabular-nums">{payment.amountDzd.toLocaleString(locale)} DA</span>;
  const fulfillment = (payment: AdminPaymentRow) => payment.resultingCreditTransactionId || payment.resultingEntitlementId ? 'Completed' : 'No completed grant recorded';
  return <><PageHeader title="Payments" description="Review customer payments, subscriptions, top-ups, and fulfillment status." compact />
    {!result.available && <Notice reason={result.reason} />}
    <div className="relative mb-4"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--studio-text-muted)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by user, payment ID, VANTRA reference, or proof reference..." aria-label="Search payments" className={`${control} h-11 w-full ps-10`} /></div>
    <div role="tablist" aria-label="Payment type" className="mb-3 flex w-fit gap-0.5 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] p-0.5">{[['all','All'],['subscription','Subscriptions'],['credit_pack','Top-ups']].map(([value, title]) => <button key={value} type="button" role="tab" aria-selected={kind === value} onClick={() => setKind(value)} className={`h-9 rounded-md px-4 text-[12px] ${kind === value ? 'bg-white font-semibold text-black' : 'text-[var(--studio-text-secondary)] hover:text-white'}`}>{title}</button>)}</div>
    <div className="mb-4 flex flex-wrap gap-2">
      <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)} className={control}><option value="all">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{humanizeIdentifier(value)}</option>)}</select>
      <select aria-label="Plan" value={plan} onChange={(event) => setPlan(event.target.value)} className={control}><option value="all">All plans</option>{plans.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select aria-label="Method" value={method} onChange={(event) => setMethod(event.target.value)} className={control}><option value="all">All methods</option>{methods.map((value) => <option key={value} value={value}>{humanizeIdentifier(value)}</option>)}</select>
      <select aria-label="Range" value={range} onChange={(event) => setRange(event.target.value)} className={control}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All time</option></select><button type="button" onClick={() => { setQuery(''); setKind('all'); setStatus('all'); setPlan('all'); setMethod('all'); setRange('30d'); }} className="self-center px-2 text-[11px] text-[var(--studio-text-secondary)] underline hover:text-white">Clear filters</button></div>
    <p className="mb-2 text-[11px] text-[var(--studio-text-muted)]">{filtered.length} payments · {pending} awaiting review{payments.length >= 200 ? ' · latest 200 loaded' : ''}</p>
    {filtered.length ? <TableFrame><div className="overflow-x-auto"><table className="w-full min-w-[940px] text-start text-[12px]"><thead><tr>{['Payment','User','Purchase','Amount','Method','Proof','Status','Submitted'].map((name) => <th key={name}>{name}</th>)}</tr></thead><tbody>{visiblePayments.map((payment) => <tr key={payment.id} tabIndex={0} role="button" onClick={() => { setSelectedId(payment.id); setTab('Overview'); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(payment.id); setTab('Overview'); } }} className="cursor-pointer border-b border-[var(--studio-border-subtle)] focus-visible:outline focus-visible:outline-white/50 [&_td]:!py-3"><td className="font-medium text-white">{payment.paymentReference}<span className="block truncate text-[10px] font-normal text-[var(--studio-text-muted)]">{payment.id}</span></td><td className="max-w-[180px] truncate">{payment.userEmail}</td><td>{payment.planName}<span className="block text-[10px] text-[var(--studio-text-muted)]">{payment.orderKind === 'subscription' ? 'Subscription' : 'Top-up'}</span></td><td>{money(payment)}</td><td>{humanizeIdentifier(payment.paymentMethod)}</td><td>{payment.proofUrl ? <span className="text-emerald-200">Attached</span> : '—'}</td><td><PaymentStatus value={payment.status} /></td><td><DateValue value={payment.submittedAt ?? payment.createdAt} compact /></td></tr>)}</tbody></table></div><Pagination count={filtered.length} page={currentPage} size={8} onPage={setPage} noun="payments" /></TableFrame> : <Empty label="No payments match these filters." />}
    {selected && <WorkspaceDrawer compact title={`Payment ${selected.paymentReference}`} subtitle={selected.userEmail} badges={<><Badge>{selected.planName}</Badge><PaymentStatus value={selected.status} /></>} actions={<details className="relative"><summary aria-label="Payment actions" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-[var(--studio-border)] text-[var(--studio-text-secondary)] hover:text-white [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" /></summary><div className="absolute end-0 top-10 z-30 w-36 rounded-lg border border-[var(--studio-border)] bg-[#202021] p-1"><Link href={`/admin/users?q=${encodeURIComponent(selected.userEmail)}`} className="block rounded px-3 py-2 text-[11px] hover:bg-white/[0.06]">Open user</Link>{selected.proofUrl && <a href={selected.proofUrl} target="_blank" rel="noreferrer" className="block rounded px-3 py-2 text-[11px] hover:bg-white/[0.06]">Open proof</a>}</div></details>} tabs={['Overview','Proof','Fulfillment','History']} activeTab={tab} onTab={setTab} onClose={() => setSelectedId(null)}>
      {tab === 'Overview' && <div className="space-y-3"><section className={section}><h3 className={label}>Payment</h3><WorkspaceField label="Payment ID">{selected.id}</WorkspaceField><WorkspaceField label="Status"><PaymentStatus value={selected.status} /></WorkspaceField><WorkspaceField label="Amount">{money(selected)}</WorkspaceField><WorkspaceField label="Method">{humanizeIdentifier(selected.paymentMethod)}</WorkspaceField><WorkspaceField label="VANTRA reference">{selected.paymentReference}</WorkspaceField><WorkspaceField label="Submitted"><DateValue value={selected.submittedAt} /></WorkspaceField><WorkspaceField label="Customer reference">{selected.customerReference ?? '—'}</WorkspaceField></section>
        <section className={section}><h3 className={label}>Customer</h3><WorkspaceField label="Email">{selected.userEmail}</WorkspaceField><WorkspaceField label="User ID">{selected.userId}</WorkspaceField><Link href={`/admin/users?q=${encodeURIComponent(selected.userEmail)}`} className="mt-2 inline-block text-[11px] text-white underline">Open user</Link></section>
        <section className={section}><h3 className={label}>Purchase</h3><WorkspaceField label="Type">{selected.orderKind === 'subscription' ? 'Subscription' : 'Top-up'}</WorkspaceField><WorkspaceField label="Plan">{selected.planName}</WorkspaceField><WorkspaceField label="Price">{money(selected)}</WorkspaceField>{selected.creditsAmount != null && <WorkspaceField label="Credits">{selected.creditsAmount}</WorkspaceField>}{selected.entitlementSnapshot && <><p className="mt-3 text-[11px] font-semibold text-[var(--studio-text-secondary)]">Recorded order entitlement</p>{Object.entries(selected.entitlementSnapshot).filter(([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean').map(([key, value]) => <WorkspaceField key={key} label={humanizeIdentifier(key)}>{String(value)}</WorkspaceField>)}<TechnicalDetails><pre className="whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(selected.entitlementSnapshot, null, 2)}</pre></TechnicalDetails></>}</section>
        <section className={section}><h3 className={label}>Review</h3><WorkspaceField label="Review status"><PaymentStatus value={selected.status} /></WorkspaceField><WorkspaceField label="Reviewed by">{selected.reviewedBy ?? '—'}</WorkspaceField><WorkspaceField label="Reviewed at"><DateValue value={selected.reviewedAt} /></WorkspaceField><WorkspaceField label="Review note">{selected.reviewNote ?? '—'}</WorkspaceField></section>{selected.status === 'pending' && selected.submittedAt && <div className="sticky bottom-0 z-10 -mx-6 border-t border-[var(--studio-border)] bg-[var(--studio-card)] px-6 py-3"><AdminPaymentActions paymentId={selected.id} creditsAmount={selected.creditsAmount} onResolved={(nextStatus) => setPayments((current) => current.map((payment) => payment.id === selected.id ? { ...payment, status: nextStatus } : payment))} /></div>}</div>}
      {tab === 'Proof' && <div className="space-y-4"><section><h3 className="text-[14px] font-semibold">Payment proof</h3><p className="mt-1 text-[12px] text-[var(--studio-text-secondary)]">Image or document provided by the customer.</p>{selected.proofUrl ? <>{/\.(png|jpe?g|webp|gif)$/i.test(selected.proofStoragePath ?? '') && <div className="mt-3 flex min-h-[260px] items-center justify-center overflow-hidden rounded-xl border border-[var(--studio-border)] bg-[var(--studio-recessed)] p-2"><img src={selected.proofUrl} alt="Submitted payment proof" className="max-h-[480px] max-w-full rounded-lg object-contain" /></div>}<a href={selected.proofUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] px-3 text-[12px] font-medium"><ExternalLink className="h-3.5 w-3.5" />Open full size</a></> : <div className="mt-3"><Empty label="No payment proof was submitted or its preview is unavailable." /></div>}</section><section className="border-t border-[var(--studio-border)] pt-4"><h3 className="text-[13px] font-semibold">Proof details</h3><WorkspaceField label="Payment method">{humanizeIdentifier(selected.paymentMethod)}</WorkspaceField><WorkspaceField label="Submitted reference">{selected.customerReference ?? '—'}</WorkspaceField><WorkspaceField label="Uploaded"><DateValue value={selected.submittedAt} /></WorkspaceField>{selected.proofStoragePath && <TechnicalDetails><TechnicalId label="Stored file" value={selected.proofStoragePath} /></TechnicalDetails>}</section></div>}
      {tab === 'Fulfillment' && <div className="space-y-5">{selected.status === 'approved' && <div className={selected.resultingCreditTransactionId || selected.resultingEntitlementId ? 'rounded-xl border border-emerald-400/30 bg-emerald-400/[0.08] p-4 text-emerald-200' : 'rounded-xl border border-red-400/30 bg-red-400/[0.08] p-4 text-red-200'}><h3 className="text-[14px] font-semibold">{selected.resultingCreditTransactionId || selected.resultingEntitlementId ? 'Payment approved and fulfillment completed' : 'Payment approved; no completed fulfillment is recorded'}</h3><p className="mt-1 text-[12px]">This status comes from the saved order and resulting grant record.</p></div>}<section className="border-t border-[var(--studio-border)] pt-4"><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--studio-text-secondary)]">Fulfillment Status</h3><WorkspaceField label="Payment status"><PaymentStatus value={selected.status} /></WorkspaceField><WorkspaceField label="Fulfillment status">{fulfillment(selected)}</WorkspaceField><WorkspaceField label="Action">{selected.orderKind === 'subscription' ? 'Activate purchased entitlement' : 'Grant purchased credits'}</WorkspaceField><WorkspaceField label="Purchased credits">{selected.creditsAmount ?? '—'}</WorkspaceField></section><section className="border-t border-[var(--studio-border)] pt-4"><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--studio-text-secondary)]">Server Record</h3><WorkspaceField label="Order snapshot">{selected.entitlementSnapshot ? 'Recorded' : 'Not recorded'}</WorkspaceField><WorkspaceField label="Entitlement write">{selected.resultingEntitlementId ? 'Recorded' : 'Not recorded'}</WorkspaceField><WorkspaceField label="Ledger transaction">{selected.resultingCreditTransactionId ? 'Recorded' : 'Not recorded'}</WorkspaceField><TechnicalDetails>{selected.resultingEntitlementId && <TechnicalId label="Entitlement ID" value={selected.resultingEntitlementId} />}{selected.resultingCreditTransactionId && <TechnicalId label="Transaction ID" value={selected.resultingCreditTransactionId} />}</TechnicalDetails><p className="mt-3 text-[11px] text-[var(--studio-text-muted)]">Separate fulfillment attempts, error codes, and timestamps are not stored on this order.</p></section></div>}
      {tab === 'History' && <div className="space-y-3"><section className={section}><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--studio-text-secondary)]">Review State</h3><WorkspaceField label="Payment status"><PaymentStatus value={selected.status} /></WorkspaceField><WorkspaceField label="Reviewed by">{selected.reviewedBy ?? '—'}</WorkspaceField><WorkspaceField label="Reviewed at"><DateValue value={selected.reviewedAt} /></WorkspaceField><WorkspaceField label="Review note">{selected.reviewNote ?? '—'}</WorkspaceField><WorkspaceField label="Fulfillment result">{fulfillment(selected)}</WorkspaceField></section><section className={section}><h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--studio-text-secondary)]">Timeline</h3>{selected.audit.length ? selected.audit.slice().reverse().map((event) => <div key={event.id} className="relative ms-1 border-s border-[var(--studio-border-strong)] py-2 ps-5 text-[12px] before:absolute before:-start-[4px] before:top-4 before:h-2 before:w-2 before:rounded-full before:bg-[var(--studio-success)]"><p className="font-medium text-[var(--studio-text-primary)]">{humanizeIdentifier(event.action)}</p><p className="mt-1 text-[var(--studio-text-muted)]"><DateValue value={event.createdAt} /></p>{event.actorUserId && <TechnicalDetails><TechnicalId label="Actor ID" value={event.actorUserId} /></TechnicalDetails>}</div>) : <Empty label="No payment audit events recorded." />}</section></div>}
    </WorkspaceDrawer>}</>;
}
