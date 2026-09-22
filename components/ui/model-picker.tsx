'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronRight, LockKeyhole, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { StudioAvailability, StudioModality } from '@/src/config/studio-registry';
import { modelBrand, modelIconUrl } from '@/src/config/model-catalog';
import { ModelBrandIcon } from './model-brand-icon';
import { isHierarchicalAllowedPlans, MODEL_PLAN_CODES, type ModelPlanCode } from '@/lib/models/plan-entitlements';

export interface ChatModelOption {
  id: string;
  name: string;
  availability: StudioAvailability;
  enabled: boolean;
  requiresAuth?: boolean;
  iconUrl?: string;
  provider?: string;
  brand?: string;
  allowedPlans?: readonly ModelPlanCode[];
  visionInput?: boolean;
  fileInput?: boolean;
  creditCost?: number;
  requiredPlan?: ModelPlanCode | null;
}

type RecentByModality = Record<StudioModality, string[]>;
const RECENT_KEY = 'vantra_recent_models_v1';
const MAX_RECENT = 3;
const emptyRecent = (): RecentByModality => ({ chat: [], image: [], video: [] });

function readRecent(): RecentByModality {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '{}') as Partial<RecentByModality>;
    return Object.fromEntries((['chat', 'image', 'video'] as const).map((modality) => [
      modality, Array.isArray(stored[modality]) ? stored[modality].filter((id): id is string => typeof id === 'string').slice(0, MAX_RECENT) : [],
    ])) as RecentByModality;
  } catch { return emptyRecent(); }
}

function brandIcon(model: ChatModelOption, modality: StudioModality) {
  return model.iconUrl ?? modelIconUrl(modelBrand(model.name, modality, model.provider, model.id, model.brand));
}

export function ModelPicker({ models, selectedModel, onSelect, onSignInClick, dropdownPosition = 'top', menuLabel, emptyLabel, modality = 'chat' }: {
  models: ChatModelOption[];
  selectedModel: string;
  onSelect: (id: string) => void;
  onSignInClick?: () => void;
  dropdownPosition?: 'top' | 'bottom';
  menuLabel?: string;
  emptyLabel?: string;
  modality?: StudioModality;
}) {
  const t = useTranslations('studio.models');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [recent, setRecent] = useState<RecentByModality>(emptyRecent);
  const [anchor, setAnchor] = useState<{ top: number; left: number; height: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const visibleModels = useMemo(() => models.filter((model) => model.enabled && ['available', 'beta'].includes(model.availability)), [models]);
  const current = visibleModels.find((model) => model.id === selectedModel) ?? visibleModels[0];

  useEffect(() => setRecent(readRecent()), []);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const update = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(408, innerWidth - 32);
      const above = rect.top - 24;
      const below = innerHeight - rect.bottom - 24;
      const placeAbove = dropdownPosition === 'top' ? above >= 280 || above >= below : below < 280 && above > below;
      const height = Math.min(540, Math.max(220, placeAbove ? above : below));
      setAnchor({ top: placeAbove ? rect.top - height - 8 : rect.bottom + 8,
        left: Math.max(16, Math.min(rect.left, innerWidth - width - 16)), height });
    };
    update();
    requestAnimationFrame(() => searchInput.current?.focus());
    const closeOnOutside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
      if (event.key !== 'Tab') return;
      const controls = [...(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])') ?? [])];
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, dropdownPosition]);

  const groups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const matches = visibleModels.filter((model) => {
      const brand = modelBrand(model.name, modality, model.provider, model.id, model.brand).name;
      return !term || `${model.name} ${brand}`.toLocaleLowerCase().includes(term);
    });
    const byBrand = new Map<string, ChatModelOption[]>();
    matches.forEach((model) => {
      const brand = modelBrand(model.name, modality, model.provider, model.id, model.brand).name;
      byBrand.set(brand, [...(byBrand.get(brand) ?? []), model]);
    });
    // Stable alphabetical brand order — never reordered by selection or state.
    return { term, matches, groups: [...byBrand.entries()].sort(([a], [b]) => a.localeCompare(b)) };
  }, [visibleModels, modality, search]);
  const recentModels = recent[modality].map((id) => visibleModels.find((model) => model.id === id)).filter((model): model is ChatModelOption => Boolean(model));
  const close = useCallback(() => { setOpen(false); setSearch(''); trigger.current?.focus(); }, []);
  const pick = (model: ChatModelOption) => {
    if (!model.enabled || model.requiredPlan || !['available', 'beta'].includes(model.availability)) return;
    if (model.requiresAuth && onSignInClick) { close(); onSignInClick(); return; }
    onSelect(model.id);
    const latest = readRecent();
    const next = { ...latest, [modality]: [model.id, ...latest[modality].filter((id) => id !== model.id)].slice(0, MAX_RECENT) };
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* Preference is optional. */ }
    close();
  };
  const tier = (plans: readonly ModelPlanCode[]) => {
    if (!plans.length) return null;
    if (!isHierarchicalAllowedPlans(plans)) return null;
    return MODEL_PLAN_CODES.find((plan) => plans.includes(plan)) ?? null;
  };
  const row = (model: ChatModelOption, variant: 'nested' | 'flat' = 'nested') => {
    const brand = modelBrand(model.name, modality, model.provider, model.id, model.brand);
    const icon = brandIcon(model, modality);
    const selectable = model.enabled && !model.requiredPlan && ['available', 'beta'].includes(model.availability);
    const plans = model.allowedPlans ?? [];
    const access = tier(plans);
    return <button key={model.id} type="button" disabled={!selectable} onClick={() => pick(model)}
      aria-current={selectedModel === model.id ? 'true' : undefined}
      className={`flex min-h-12 w-full items-center gap-2.5 rounded-lg border px-2.5 text-start text-[12.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] sm:min-h-11 ${selectable ? 'hover:bg-[var(--studio-hover)]' : 'cursor-not-allowed'} ${selectedModel === model.id ? 'border-[var(--studio-border-strong)] bg-[var(--studio-selected)]' : 'border-transparent'}`}>
      <ModelBrandIcon url={icon} name={brand.name} />
      {variant === 'flat'
        ? <span className="min-w-0 flex-1"><span className={`block truncate font-medium ${selectable ? 'text-[var(--studio-text-primary)]' : 'text-[var(--studio-text-secondary)]'}`}>{model.name}</span><span className="block truncate text-[10.5px] text-[var(--studio-text-muted)]">{brand.name}</span></span>
        : <span className={`min-w-0 flex-1 truncate font-medium ${selectable ? 'text-[var(--studio-text-primary)]' : 'text-[var(--studio-text-secondary)]'}`}>{model.name}</span>}
      {model.requiredPlan && <LockKeyhole aria-label={t('requiresPlan', { plan: model.requiredPlan })} className="h-3.5 w-3.5 shrink-0 text-[var(--studio-text-secondary)]" />}
      {access ? <span className="shrink-0 rounded-md border border-[var(--studio-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--studio-text-secondary)]">{t(`picker.plan.${access}`)}</span>
        : plans.length ? <span className="flex shrink-0 gap-0.5">{MODEL_PLAN_CODES.filter((plan) => plans.includes(plan)).map((plan) => <span key={plan} className="rounded border border-[var(--studio-border)] px-1 text-[9px] text-[var(--studio-text-secondary)]">{t(`picker.plan.${plan}`)}</span>)}</span>
          : <span className="shrink-0 text-[10px] text-[var(--studio-text-muted)]">{t('picker.unconfigured')}</span>}
      {selectedModel === model.id && <Check className="h-4 w-4 shrink-0 text-[var(--studio-text-primary)]" aria-hidden="true" />}
    </button>;
  };
  const picker = <>
    <div className="fixed inset-0 z-[109] bg-[var(--studio-overlay)] sm:hidden" onClick={close} aria-hidden="true" />
    <div ref={panel} role="dialog" aria-label={menuLabel ?? t('menuLabel')}
      style={{ backgroundColor: 'color-mix(in srgb, var(--studio-popover) 96%, transparent)',
        ...(anchor && typeof window !== 'undefined' && window.innerWidth >= 640
          ? { top: anchor.top, left: anchor.left, maxHeight: anchor.height } : {}) }}
      className="fixed inset-x-0 bottom-0 z-[110] flex max-h-[min(85dvh,620px)] flex-col overflow-hidden rounded-t-2xl border border-[var(--studio-border)] bg-[var(--studio-popover)] text-[var(--studio-text-primary)] shadow-lg sm:inset-x-auto sm:bottom-auto sm:w-[min(408px,calc(100vw-32px))] sm:rounded-2xl sm:max-h-[540px]">
      <div className="shrink-0 border-b border-[var(--studio-border)] bg-[var(--studio-popover)] p-3">
        <div className="mb-2 flex items-center justify-between sm:hidden"><span className="text-sm font-semibold">{menuLabel ?? t('menuLabel')}</span><button type="button" onClick={close} aria-label={t('picker.close')} className="flex h-9 w-9 items-center justify-center rounded-lg"><X className="h-4 w-4" /></button></div>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 focus-within:border-[var(--studio-border-strong)]"><Search className="h-4 w-4 shrink-0 text-[var(--studio-text-muted)]" /><span className="sr-only">{t('picker.search')}</span><input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('picker.search')} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--studio-text-muted)]" /></label>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 [scrollbar-width:thin]">
        {groups.term ? <section aria-label={t('picker.allModels')}>
          {groups.matches.length ? groups.matches.map((model) => row(model, 'flat'))
            : <p className="px-3 py-6 text-center text-[12px] text-[var(--studio-text-muted)]">{t('picker.noResults')}</p>}
        </section> : <>{recentModels.length > 0 && <section className="pb-2"><h3 className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('picker.recent')}</h3>{recentModels.map((model) => row(model))}</section>}
        <section><h3 className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('picker.allModels')}</h3>
          {groups.groups.length ? groups.groups.map(([brandName, items]) => {
            const openGroup = expanded.includes(brandName);
            const icon = brandIcon(items[0], modality);
            return <div key={brandName} className="mt-0.5"><button type="button" aria-expanded={openGroup} onClick={() => setExpanded((current) => openGroup ? current.filter((name) => name !== brandName) : [...current, brandName])} className="flex h-11 w-full items-center gap-2 rounded-lg px-2 text-start hover:bg-[var(--studio-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] sm:h-9">
              <ModelBrandIcon url={icon} name={brandName} size={20} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{brandName}</span><span className="shrink-0 text-[11px] text-[var(--studio-text-muted)]">{t('picker.modelsCount', { count: items.length })}</span><ChevronRight className={`h-4 w-4 shrink-0 text-[var(--studio-text-muted)] transition-transform duration-150 ${openGroup ? 'rotate-90' : ''}`} />
            </button>{openGroup && <div className="ms-2 rounded-lg border-s border-[var(--studio-border-subtle)] bg-black/10 py-1 pe-1 ps-1">{items.map((model) => row(model))}</div>}</div>;
          }) : <p className="px-3 py-6 text-center text-[12px] text-[var(--studio-text-muted)]">{emptyLabel ?? t('noModels')}</p>}
        </section></>}
      </div>
    </div>
  </>;
  return <div className="relative inline-flex min-w-0 items-center">
    <button ref={trigger} type="button" onClick={() => { setSearch(''); setExpanded([]); setOpen((value) => !value); }} disabled={!current} aria-haspopup="dialog" aria-expanded={open} aria-label={`${t('label')}: ${current?.name ?? t('label')}`}
      className="inline-flex h-9 max-w-[230px] items-center gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-2.5 text-[12px] text-[var(--studio-text-primary)] hover:border-[var(--studio-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] disabled:opacity-50">
      {current && <ModelBrandIcon url={brandIcon(current, modality)} name={modelBrand(current.name, modality, current.provider, current.id, current.brand).name} size={20} />}<span className="truncate font-medium">{current?.name ?? emptyLabel ?? t('label')}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--studio-text-muted)]" />
    </button>
    {open && typeof document !== 'undefined' && createPortal(picker, document.querySelector('.studio-overlay-root') ?? document.body)}
  </div>;
}
