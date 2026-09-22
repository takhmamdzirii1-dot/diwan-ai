'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import type { AdminDataResult, AdminPaymentPlan } from '@/lib/admin/types';

type Draft = { name: string; description: string; priceDzd: string; unifiedCredits: string; includedVideoAllowance: string; active: boolean; featured: boolean; displayOrder: string; publicVisible: boolean; eligibilityRequired: boolean };
const card = 'rounded-xl border border-[var(--studio-border)] bg-[var(--studio-card)]';
const input = 'mt-1.5 h-10 w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 text-[12px] text-[var(--studio-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]';
const label = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-secondary)]';
function draftOf(plan: AdminPaymentPlan): Draft { return { name: plan.name, description: plan.description ?? '', priceDzd: String(plan.priceDzd), unifiedCredits: String(plan.slug === 'lite' ? plan.subscriptionCreditAllowance ?? plan.unifiedCredits : plan.unifiedCredits), includedVideoAllowance: plan.includedVideoAllowance == null ? '' : String(plan.includedVideoAllowance), active: plan.active, featured: plan.featured, displayOrder: String(plan.displayOrder), publicVisible: plan.publicVisible ?? false, eligibilityRequired: plan.eligibilityRequired ?? false }; }
function pair(name: string, value: React.ReactNode) { return <div className="flex justify-between gap-3 border-b border-[var(--studio-border-subtle)] py-2.5 text-[12px] last:border-0"><span className="text-[var(--studio-text-secondary)]">{name}</span><span className="text-right font-medium text-[var(--studio-text-primary)]">{value}</span></div>; }
function section(title: string, children: React.ReactNode) { return <section className={`${card} p-4`}><h3 className={`${label} mb-2`}>{title}</h3>{children}</section>; }
function badge(text: string, positive = false) { return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${positive ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-[var(--studio-border)] text-[var(--studio-text-secondary)]'}`}>{text}</span>; }

function PlanCard({ plan, onOpen }: { plan: AdminPaymentPlan; onOpen: () => void }) {
  const credits = plan.slug === 'lite' ? plan.subscriptionCreditAllowance ?? plan.unifiedCredits : plan.unifiedCredits;
  return <button type="button" onClick={onOpen} className={`${card} flex min-h-[280px] flex-col p-5 text-left hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]`}>
    <div className="flex items-start justify-between gap-2"><h3 className="text-[15px] font-semibold uppercase tracking-wide">{plan.name}</h3>{badge(plan.frozen || plan.slug === 'max' ? 'Frozen' : plan.publicVisible ? 'Public' : 'Hidden', Boolean(plan.publicVisible && !plan.frozen))}</div>
    <p className="mt-5 text-[28px] font-semibold tabular-nums tracking-tight">{plan.priceDzd.toLocaleString()} DA{plan.slug !== 'free' && <span className="ml-1 text-[11px] font-normal text-[var(--studio-text-muted)]">/ month</span>}</p>
    <p className="mt-1 min-h-8 text-[11px] text-[var(--studio-text-secondary)]">{plan.description ?? 'Current production catalog'}</p>
    <div className="mt-3 space-y-2 border-t border-[var(--studio-border-subtle)] pt-3 text-[12px]">{plan.slug === 'free' ? <><p>5 image generations · one-time</p><p>1 video generation · one-time</p><p>Standard Chat</p></> : <><p>{credits.toLocaleString()} catalog credits</p>{plan.slug === 'lite' && <p>{plan.includedVideoAllowance ?? '—'} premium videos / month</p>}{plan.slug === 'pro' && <p>Up to 600 rollover under current billing rules</p>}</>}<p className="text-[var(--studio-text-secondary)]">{plan.active ? 'Available for purchase' : 'Not purchasable'}</p></div>
    <div className="mt-auto flex justify-between border-t border-[var(--studio-border-subtle)] pt-4 text-[11px] font-semibold"><span>{plan.featured ? 'Recommended' : 'View plan'}</span><span aria-hidden="true">↗</span></div>
  </button>;
}

function PlanHistory({ plan }: { plan: AdminPaymentPlan }) {
  const events = plan.history ?? [];
  return section('Recorded changes', <>{events.length ? events.map((event) => {
    const before = event.previousState ?? {};
    const after = event.newState ?? {};
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    const value = (key: string, raw: unknown) => raw == null ? '—' : typeof raw === 'boolean' ? raw ? 'Yes' : 'No' : key === 'price_dzd' && typeof raw === 'number' ? `${raw.toLocaleString()} DA` : typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '—';
    return <div key={event.id} className="border-b border-[var(--studio-border-subtle)] py-3 last:border-0"><div className="flex justify-between gap-2 text-[11px]"><strong>{event.action.replaceAll('_', ' ')}</strong><time dateTime={event.at} className="text-[var(--studio-text-muted)]">{new Date(event.at).toLocaleString('en')}</time></div>{keys.length ? keys.map((key) => <p key={key} className="mt-1 text-[11px] text-[var(--studio-text-secondary)]">{key.replaceAll('_', ' ')}: <span className="text-[var(--studio-text-primary)]">{value(key, before[key])} → {value(key, after[key])}</span></p>) : <p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]">Creation or metadata update recorded.</p>}</div>;
  }) : <p className="py-6 text-center text-[12px] text-[var(--studio-text-secondary)]">No plan changes are present in the loaded Admin audit history.</p>}<p className="mt-2 text-[11px] text-[var(--studio-text-muted)]">Historical orders retain their original snapshots.</p></>);
}

function PlanDrawerContent({ plan, draft, tab, edit, onDraft }: { plan: AdminPaymentPlan; draft: Draft; tab: string; edit: boolean; onDraft: (patch: Partial<Draft>) => void }) {
  const editable = edit && !plan.frozen && plan.slug !== 'max' && plan.slug !== 'free';
  const field = (title: string, key: keyof Draft, type = 'text') => <label className="text-[12px] text-[var(--studio-text-secondary)]">{title}<input type={type} className={input} value={String(draft[key])} onChange={(event) => onDraft({ [key]: event.target.value })} /></label>;
  const toggle = (title: string, key: 'active' | 'featured' | 'publicVisible' | 'eligibilityRequired') => <label className="flex items-center justify-between gap-3 border-b border-[var(--studio-border-subtle)] py-2.5 text-[12px]"><span>{title}</span><input type="checkbox" checked={draft[key]} onChange={(event) => onDraft({ [key]: event.target.checked })} className="h-4 w-4 accent-[var(--studio-accent)]" /></label>;
  if (tab === 'History') return <PlanHistory plan={plan} />;
  if (tab === 'Overview') return <div className="space-y-4">
    {section('Plan', <>{pair('Name', plan.name)}{pair('Code', plan.planCode ?? plan.slug)}{pair('Type', plan.kind === 'subscription' ? 'Subscription' : 'One-time credit pack')}{pair('Price', `${plan.priceDzd.toLocaleString()} DA`)}{pair('Status', badge(plan.active ? 'Available' : 'Unavailable', plan.active))}</>)}
    {section('Entitlements', <>{pair('Catalog credits', plan.unifiedCredits.toLocaleString())}{plan.slug === 'free' && <>{pair('Image generations', '5 one-time')}{pair('Video generations', '1 one-time')}</>}{plan.includedVideoAllowance != null && pair('Included premium videos', plan.includedVideoAllowance)}{plan.slug === 'pro' && pair('Rollover cap', '600 subscription credits')}</>)}
    {section('Purchase & visibility', <>{pair('Public visibility', plan.publicVisible == null ? '—' : plan.publicVisible ? 'Public' : 'Hidden')}{pair('Eligibility', plan.eligibilityRequired == null ? '—' : plan.eligibilityRequired ? 'Required' : 'Open')}{pair('Recommended', plan.featured ? 'Yes' : 'No')}</>)}
    {section('Catalog', <>{pair('Created', plan.createdAt ? new Date(plan.createdAt).toLocaleString('en') : '—')}{pair('Last updated', plan.updatedAt ? new Date(plan.updatedAt).toLocaleString('en') : '—')}{pair('Access period', plan.accessPeriodDays == null ? '—' : `${plan.accessPeriodDays} days`)}</>)}
    {editable && section('Edit identity & price', <div className="grid gap-3 sm:grid-cols-2">{field('Name', 'name')}{field('Price (DA)', 'priceDzd', 'number')}</div>)}
  </div>;
  if (tab === 'Entitlements') return <div className="space-y-4">
    {section('Credits & allowances', <>{pair('Credits', (plan.slug === 'lite' ? plan.subscriptionCreditAllowance ?? plan.unifiedCredits : plan.unifiedCredits).toLocaleString())}{pair('Included premium videos', plan.includedVideoAllowance ?? '—')}{pair('Rollover', plan.slug === 'pro' ? 'Up to 600 subscription credits' : '—')}{pair('Chat level', plan.slug === 'lite' ? 'Extended Chat' : plan.slug === 'pro' ? 'High-usage Chat' : plan.slug === 'free' ? 'Standard Chat' : '—')}</>)}
    {plan.kind === 'credit_pack' && section('Top-up', <>{pair('Type', 'One-time')}{pair('Recurring allowance', 'Separate from subscriptions')}</>)}
    {editable && section('Edit entitlements', <div className="grid gap-3 sm:grid-cols-2">{field('Credits', 'unifiedCredits', 'number')}{plan.slug === 'lite' && field('Premium videos', 'includedVideoAllowance', 'number')}</div>)}
  </div>;
  if (tab === 'Purchase & Visibility') return <div className="space-y-4">
    {section('Purchase', <>{pair('Availability', badge(plan.active ? 'Available' : 'Unavailable', plan.active))}{pair('Public visibility', plan.publicVisible == null ? '—' : plan.publicVisible ? 'Public' : 'Hidden')}{pair('Eligibility', plan.eligibilityRequired == null ? '—' : plan.eligibilityRequired ? 'Required' : 'Open')}{pair('Historical orders', 'Original snapshots retained')}</>)}
    {editable && section('Edit purchase settings', <>{toggle('Available for purchase', 'active')}{toggle('Public visibility', 'publicVisible')}{toggle('Eligibility required', 'eligibilityRequired')}</>)}
    {plan.frozen && <p className="text-[12px] text-[var(--studio-text-secondary)]">This plan is frozen in the current production catalog.</p>}
  </div>;
  return <div className="space-y-4">
    {section('Presentation', <>{pair('Description', plan.description ?? '—')}{pair('Recommended', plan.featured ? 'Yes' : 'No')}{pair('Display order', plan.displayOrder)}</>)}
    {editable && section('Edit presentation', <><label className="text-[12px] text-[var(--studio-text-secondary)]">Description<textarea className={`${input} min-h-24 py-2`} maxLength={500} value={draft.description} onChange={(event) => onDraft({ description: event.target.value })} /></label><div className="mt-3 grid gap-3 sm:grid-cols-2">{field('Display order', 'displayOrder', 'number')}{toggle('Recommended', 'featured')}</div></>)}
  </div>;
}

export function RemainingPlansView({ result }: { result: AdminDataResult<AdminPaymentPlan[]> }) {
  const router = useRouter();
  const [plans, setPlans] = useState(result.data);
  const [tab, setTab] = useState('Plans'); const [selectedId, setSelectedId] = useState<string | null>(null); const [drawerTab, setDrawerTab] = useState('Overview'); const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null); const [confirm, setConfirm] = useState<string[] | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false); const [newSlug, setNewSlug] = useState(''); const [newName, setNewName] = useState(''); const [newPrice, setNewPrice] = useState(''); const [newCredits, setNewCredits] = useState('');
  useEffect(() => setPlans(result.data), [result.data]);
  const selected = plans.find((plan) => plan.id === selectedId);
  const subscriptions = useMemo(() => plans.filter((plan) => plan.kind === 'subscription').sort((a,b) => a.displayOrder - b.displayOrder), [plans]);
  const packs = useMemo(() => plans.filter((plan) => plan.kind === 'credit_pack').sort((a,b) => a.displayOrder - b.displayOrder), [plans]);
  const open = (plan: AdminPaymentPlan) => { setSelectedId(plan.id); setDrawerTab('Overview'); setDraft(draftOf(plan)); setEdit(false); setError(null); };
  const close = () => { setSelectedId(null); setConfirm(null); setEdit(false); };
  const updateDraft = (patch: Partial<Draft>) => setDraft((current) => current ? { ...current, ...patch } : current);
  const changes = selected && draft ? [
    selected.priceDzd !== Number(draft.priceDzd) ? `Price: ${selected.priceDzd} DA → ${draft.priceDzd} DA` : null,
    (selected.slug === 'lite' ? selected.subscriptionCreditAllowance ?? selected.unifiedCredits : selected.unifiedCredits) !== Number(draft.unifiedCredits) ? `Credits: ${selected.slug === 'lite' ? selected.subscriptionCreditAllowance ?? selected.unifiedCredits : selected.unifiedCredits} → ${draft.unifiedCredits}` : null,
    selected.slug === 'lite' && selected.includedVideoAllowance !== Number(draft.includedVideoAllowance) ? `Included videos: ${selected.includedVideoAllowance ?? '—'} → ${draft.includedVideoAllowance}` : null,
    selected.active !== draft.active ? `Availability: ${selected.active ? 'Available' : 'Unavailable'} → ${draft.active ? 'Available' : 'Unavailable'}` : null,
    selected.publicVisible !== draft.publicVisible ? `Visibility: ${selected.publicVisible ? 'Public' : 'Hidden'} → ${draft.publicVisible ? 'Public' : 'Hidden'}` : null,
    selected.eligibilityRequired !== draft.eligibilityRequired ? `Eligibility: ${selected.eligibilityRequired ? 'Required' : 'Open'} → ${draft.eligibilityRequired ? 'Required' : 'Open'}` : null,
    selected.featured !== draft.featured ? `Recommended: ${selected.featured ? 'Yes' : 'No'} → ${draft.featured ? 'Yes' : 'No'}` : null,
    selected.name !== draft.name ? `Name: ${selected.name} → ${draft.name}` : null,
    (selected.description ?? '') !== draft.description ? 'Description changed' : null,
    selected.displayOrder !== Number(draft.displayOrder) ? `Display order: ${selected.displayOrder} → ${draft.displayOrder}` : null,
  ].filter((item): item is string => Boolean(item)) : [];
  const save = async () => {
    if (!selected || !draft || busy) return;
    const positive = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
    if (!draft.name.trim() || !positive(draft.priceDzd) || !positive(draft.unifiedCredits) || !/^-?\d+$/.test(draft.displayOrder) || !Number.isSafeInteger(Number(draft.displayOrder)) || (selected.slug === 'lite' && (!/^\d+$/.test(draft.includedVideoAllowance) || Number(draft.includedVideoAllowance) > 4))) { setError('Enter a valid name, positive price and credits, and a valid display order. Lite videos must be 0–4.'); return; }
    setBusy(true); setError(null);
    try {
      const amount = Number(draft.unifiedCredits);
      const response = await fetch(`/api/admin/payments/plans/${selected.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: selected.slug, name: draft.name.trim(), description: draft.description.trim() || null, kind: selected.kind, priceDzd: Number(draft.priceDzd), unifiedCredits: amount, subscriptionCreditAllowance: selected.slug === 'lite' ? amount : null, includedVideoAllowance: selected.slug === 'lite' ? Number(draft.includedVideoAllowance) : null, active: draft.active, featured: draft.featured, displayOrder: Number(draft.displayOrder), publicVisible: draft.publicVisible, eligibilityRequired: draft.eligibilityRequired }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.plan) throw new Error(body.error ?? 'Plan update failed.');
      setPlans((items) => items.map((item) => item.id === selected.id ? body.plan as AdminPaymentPlan : item)); setDraft(draftOf(body.plan)); setEdit(false); setConfirm(null); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Plan update failed.'); setConfirm(null); } finally { setBusy(false); }
  };
  const createPack = async () => {
    if (busy) return;
    if (!/^[a-z0-9_]{1,80}$/.test(newSlug) || !newName.trim() || !/^\d+$/.test(newPrice) || !Number.isSafeInteger(Number(newPrice)) || Number(newPrice) <= 0 || !/^\d+$/.test(newCredits) || !Number.isSafeInteger(Number(newCredits)) || Number(newCredits) <= 0) { setError('Enter a valid slug, name, positive price and positive credits.'); return; }
    setBusy(true); setError(null);
    try { const response = await fetch('/api/admin/payments/plans', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: newSlug, name: newName.trim(), description: null, kind: 'credit_pack', priceDzd: Number(newPrice), unifiedCredits: Number(newCredits), subscriptionCreditAllowance: null, includedVideoAllowance: null, active: false, displayOrder: packs.length + subscriptions.length, featured: false }) }); const body = await response.json().catch(() => ({})); if (!response.ok || !body.plan) throw new Error(body.error ?? 'Credit pack could not be created.'); setPlans((items) => [...items, body.plan as AdminPaymentPlan]); setCreating(false); setNewSlug(''); setNewName(''); setNewPrice(''); setNewCredits(''); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Credit pack could not be created.'); } finally { setBusy(false); }
  };
  return <><header className="mb-6"><h1 className="text-[28px] font-semibold tracking-[-0.035em] text-[var(--studio-text-primary)]">Plans & Pricing</h1><p className="mt-1 text-[13px] text-[var(--studio-text-secondary)]">Manage current catalog values for future purchases and billing cycles.</p></header>{!result.available && <p className={`${card} mb-4 p-4 text-[12px] text-amber-200`}>Plan catalog data is unavailable.</p>}
    <nav className="mb-5 flex gap-6 border-b border-[var(--studio-border)]">{['Plans','Credit Packs','Rules'].map((value) => <button key={value} type="button" onClick={() => setTab(value)} className={`h-11 border-b-2 text-[12px] font-medium ${tab === value ? 'border-[var(--studio-accent)] text-[var(--studio-text-primary)]' : 'border-transparent text-[var(--studio-text-secondary)]'}`}>{value}</button>)}</nav>
    {tab === 'Plans' && <div className="space-y-5">
      <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-[17px] font-semibold">Subscription plans</h2><p className="mt-1 text-[12px] text-[var(--studio-text-secondary)]">Current catalog prices and allowances. Historical orders keep their snapshots.</p></div>{badge(`${subscriptions.length} plans`)}</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{subscriptions.map((plan) => <PlanCard key={plan.id} plan={plan} onOpen={() => open(plan)} />)}</div>
      {!subscriptions.length && <div className={`${card} p-8 text-center text-[12px] text-[var(--studio-text-secondary)]`}>No subscription plans are recorded in the current catalog.</div>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        {section('Credit Packs (Top-ups)', <><p className="mb-3 text-[11px] text-[var(--studio-text-secondary)]">One-time credits separate from recurring allowances.</p><div className="overflow-x-auto"><table className="w-full min-w-[450px] text-left text-[11px]"><thead className="border-b border-[var(--studio-border)] text-[9px] uppercase tracking-wide text-[var(--studio-text-secondary)]"><tr><th className="py-2">Pack</th><th>Price</th><th>Credits</th><th>Status</th></tr></thead><tbody>{packs.slice(0, 5).map((pack) => <tr key={pack.id} onClick={() => open(pack)} className="cursor-pointer border-b border-[var(--studio-border-subtle)] hover:bg-[var(--studio-hover)]"><td className="py-2.5 font-medium">{pack.name}</td><td>{pack.priceDzd.toLocaleString()} DA</td><td>{pack.unifiedCredits.toLocaleString()}</td><td>{badge(pack.active ? 'Active' : 'Inactive', pack.active)}</td></tr>)}</tbody></table>{!packs.length && <p className="py-6 text-center text-[11px] text-[var(--studio-text-secondary)]">No credit packs recorded.</p>}</div><button type="button" onClick={() => setTab('Credit Packs')} className="mt-3 text-[11px] text-[var(--studio-text-secondary)] underline">View all packs</button></>)}
        {section('Global Rules', <>{pair('Currency', 'DZD')}{pair('Order snapshots', 'Preserved')}{pair('Top-up eligibility', 'Active paid plan')}{pair('Price changes', 'Future purchases')}<button type="button" onClick={() => setTab('Rules')} className="mt-3 text-[11px] text-[var(--studio-text-secondary)] underline">View all rules</button></>)}
      </div>
    </div>}
    {tab === 'Credit Packs' && <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[17px] font-semibold">Credit Packs</h2><p className="mt-1 text-[12px] text-[var(--studio-text-secondary)]">One-time top-ups require an active paid-plan entitlement.</p></div><button type="button" onClick={() => { setCreating(true); setError(null); }} className="flex h-10 items-center gap-2 rounded-lg bg-[var(--studio-accent)] px-3 text-[12px] font-semibold text-[var(--studio-accent-contrast)]"><Plus className="h-4 w-4" />Add Pack</button></div>
      <div className={`${card} overflow-x-auto`}><table className="w-full min-w-[780px] text-left text-[12px]"><thead className="border-b border-[var(--studio-border)] text-[10px] uppercase tracking-wide text-[var(--studio-text-secondary)]"><tr><th className="px-4 py-3">Pack</th><th>Price (DA)</th><th>Credits</th><th>Eligible plan</th><th>Limit</th><th>Type</th><th>Status</th></tr></thead><tbody>{packs.map((pack) => <tr key={pack.id} tabIndex={0} onClick={() => open(pack)} onKeyDown={(event) => { if (event.key === 'Enter') open(pack); }} className="cursor-pointer border-b border-[var(--studio-border-subtle)] hover:bg-[var(--studio-hover)]"><td className="px-4 py-3 font-semibold">{pack.name}</td><td>{pack.priceDzd.toLocaleString()}</td><td>{pack.unifiedCredits.toLocaleString()}</td><td>Active paid plan</td><td>—</td><td>One-time</td><td>{badge(pack.active ? 'Active' : 'Inactive', pack.active)}</td></tr>)}</tbody></table>{!packs.length && <p className="p-8 text-center text-[12px] text-[var(--studio-text-secondary)]">No credit packs are recorded in the current catalog.</p>}</div>
    </div>}
    {tab === 'Rules' && <div className="grid gap-4 lg:grid-cols-2">
      {section('Purchase rules', <>{pair('Currency', 'DZD · Algerian dinar')}{pair('Credit packs', 'Active paid-plan entitlement required')}{pair('Lite eligibility', 'Existing paid-plan entitlement required')}{pair('Frozen Max', 'Current production behavior retained')}</>)}
      {section('Snapshot & rollover rules', <>{pair('Historical orders', 'Original prices and entitlements preserved')}{pair('Top-ups', 'Separate from recurring allowance')}{pair('Pro rollover', 'Up to 600 subscription credits')}{pair('Top-ups in rollover', 'Excluded')}{pair('Changes', 'Future purchases or cycles only')}</>)}
    </div>}    {(selected || creating) && <div className="fixed inset-0 z-[70] bg-[var(--studio-overlay)]" onMouseDown={(event) => { if (event.target === event.currentTarget) { close(); setCreating(false); } }}>
      <aside role="dialog" aria-modal="true" aria-label={selected?.name ?? 'Add Credit Pack'} className="ms-auto flex h-full w-full max-w-[580px] flex-col border-s border-[var(--studio-border)] bg-[var(--studio-card)] text-[var(--studio-text-primary)] shadow-[var(--studio-shadow)]">
        <header className="border-b border-[var(--studio-border)]">
          <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-6">
            <div><div className="mb-2 flex items-center gap-2">{selected && badge(selected.kind === 'subscription' ? 'Subscription' : 'Credit pack')}{selected && badge(selected.active ? 'Available' : 'Unavailable', selected.active)}</div><h2 className="text-[20px] font-semibold">{selected?.name ?? 'Add Credit Pack'}</h2><p className="mt-1 text-[12px] text-[var(--studio-text-secondary)]">{selected ? `${selected.priceDzd.toLocaleString()} DA · ${selected.slug}` : 'Create a one-time top-up in the current catalog'}</p></div>
            <button type="button" aria-label="Close" onClick={() => { close(); setCreating(false); }} className="rounded-lg p-2 hover:bg-[var(--studio-hover)]"><X className="h-4 w-4" /></button>
          </div>
          {selected && <nav className="flex gap-4 overflow-x-auto px-6">{['Overview','Entitlements','Purchase & Visibility','Presentation','History'].map((value) => <button key={value} type="button" onClick={() => { setDrawerTab(value); setEdit(false); }} className={`h-11 shrink-0 border-b-2 text-[12px] ${drawerTab === value ? 'border-[var(--studio-accent)] font-semibold' : 'border-transparent text-[var(--studio-text-secondary)]'}`}>{value}</button>)}</nav>}
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {selected && draft && <>
            {drawerTab !== 'History' && !selected.frozen && selected.slug !== 'max' && selected.slug !== 'free' && <div className="flex justify-end"><button type="button" onClick={() => { if (edit) setDraft(draftOf(selected)); setEdit(!edit); setError(null); }} className="h-9 rounded-lg border border-[var(--studio-border)] px-3 text-[12px] hover:bg-[var(--studio-hover)]">{edit ? 'Cancel editing' : 'Edit section'}</button></div>}
            <PlanDrawerContent plan={selected} draft={draft} tab={drawerTab} edit={edit} onDraft={updateDraft} />
            {(selected.frozen || selected.slug === 'max' || selected.slug === 'free') && <p className="text-[12px] text-[var(--studio-text-secondary)]">{selected.slug === 'free' ? 'Free access is defined by current production policy and is read-only here.' : 'Max uses current production configuration and is frozen here.'}</p>}
          </>}
          {creating && <div className="space-y-4">
            {section('Pack identity', <div className="grid gap-3 sm:grid-cols-2"><label className="text-[12px]">Name<input className={input} value={newName} onChange={(event) => setNewName(event.target.value)} /></label><label className="text-[12px]">Slug<input className={input} value={newSlug} onChange={(event) => setNewSlug(event.target.value.toLowerCase())} /></label>{pair('Type', 'One-time credit pack')}</div>)}
            {section('Price & credits', <div className="grid gap-3 sm:grid-cols-2"><label className="text-[12px]">Price (DA)<input type="number" min="1" className={input} value={newPrice} onChange={(event) => setNewPrice(event.target.value)} /></label><label className="text-[12px]">Credits<input type="number" min="1" className={input} value={newCredits} onChange={(event) => setNewCredits(event.target.value)} /></label></div>)}
            {section('Purchase state', <>{pair('Initial availability', 'Inactive')}{pair('Eligibility', 'Active paid-plan entitlement')}<p className="mt-2 text-[11px] text-[var(--studio-text-secondary)]">Review the new pack before enabling purchases. Historical orders retain their original snapshots.</p></>)}
          </div>}
          {error && <p role="alert" className="text-[12px] text-red-200">{error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-[var(--studio-border)] p-4"><button type="button" onClick={() => { close(); setCreating(false); }} className="h-10 rounded-lg border border-[var(--studio-border)] px-4 text-[12px]">Cancel</button>{creating ? <button type="button" disabled={busy} onClick={createPack} className="h-10 rounded-lg bg-[var(--studio-accent)] px-4 text-[12px] font-semibold text-[var(--studio-accent-contrast)] disabled:opacity-45">Create Pack</button> : selected && edit && !selected.frozen && selected.slug !== 'max' && selected.slug !== 'free' ? <button type="button" disabled={busy || changes.length === 0} onClick={() => setConfirm(changes)} className="h-10 rounded-lg bg-[var(--studio-accent)] px-4 text-[12px] font-semibold text-[var(--studio-accent-contrast)] disabled:opacity-45">Save Changes</button> : null}</footer>
      </aside>
    </div>}    {confirm && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--studio-overlay)] p-4"><div role="alertdialog" aria-modal="true" aria-label="Confirm plan change" className={`${card} w-full max-w-[460px] p-6 shadow-[var(--studio-shadow)]`}><h2 className="text-[18px] font-semibold">Confirm plan change</h2><p className="mt-2 text-[12px] text-[var(--studio-text-secondary)]">These values affect future purchases or billing cycles only. Historical orders retain their original snapshots.</p><div className="mt-4 space-y-2 rounded-lg border border-[var(--studio-border)] p-3 text-[12px]">{confirm.map((item) => <p key={item}>{item}</p>)}</div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirm(null)} className="h-10 rounded-lg border border-[var(--studio-border)] px-4 text-[12px]">Cancel</button><button type="button" disabled={busy} onClick={save} className="h-10 rounded-lg bg-[var(--studio-accent)] px-4 text-[12px] font-semibold text-[var(--studio-accent-contrast)] disabled:opacity-45">Confirm Changes</button></div></div></div>}</>;
}
