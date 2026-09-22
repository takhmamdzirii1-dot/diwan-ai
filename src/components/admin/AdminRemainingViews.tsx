'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import RunwareProviderTest, { type ProviderTestCopy } from '@/src/components/internal/RunwareProviderTest';
import type { AdminAuditRow, AdminDataResult, AdminProviderRow, CostAmount } from '@/lib/admin/types';
import AdminProviderControls from './AdminProviderControls';
import AdminProviderCreate from './AdminProviderCreate';
import { ProviderOverview, ProviderRoutes, ProviderUsage, ProviderDiagnostics, ProviderSafetySummary, ProviderRuntimeHistory, ProviderFallbackPanel } from './AdminProviderInsights';

const dash = '—';
const control = 'h-10 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 text-[12px] text-[var(--studio-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]';
const card = 'rounded-xl border border-[var(--studio-border)] bg-[var(--studio-card)]';
const label = 'text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--studio-text-muted)]';
const table = 'w-full table-fixed text-left text-[12px] [&_th]:h-10 [&_th]:px-3 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.07em] [&_th]:text-[var(--studio-text-secondary)] [&_td]:px-3 [&_td]:py-3';

function money(value: CostAmount | null) {
  if (!value || !/^-?\d+$/.test(value.minor)) return dash;
  const amount = BigInt(value.minor);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const formatted = `${negative ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
  return value.currency === 'USD' ? `$${formatted}` : `${formatted} ${value.currency}`;
}
function date(value: string | null) { return value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : dash; }
function pill(value: string, tone: 'neutral' | 'success' | 'warning' | 'danger' = 'neutral') {
  const classes = { neutral: 'border-[var(--studio-border)] bg-[var(--studio-surface-raised)] text-[var(--studio-text-secondary)]', success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200', warning: 'border-amber-400/25 bg-amber-400/10 text-amber-200', danger: 'border-red-400/25 bg-red-400/10 text-red-200' };
  return <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 text-[11px] font-medium ${classes[tone]}`}>{value}</span>;
}
function providerStatus(row: AdminProviderRow) {
  if (row.archived || !row.enabled || row.emergencyDisabled) return pill('Disabled');
  if (row.status === 'misconfigured') return pill('Misconfigured', 'warning');
  if (row.status === 'unavailable') return pill('Unavailable', 'danger');
  return pill('Ready', 'success');
}
function heading(title: string, subtitle: string, action?: React.ReactNode) { return <header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-[28px] font-semibold tracking-[-0.035em] text-[var(--studio-text-primary)]">{title}</h1><p className="mt-1 text-[13px] text-[var(--studio-text-secondary)]">{subtitle}</p></div>{action}</header>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className={`${card} p-4`}><h3 className={`${label} mb-3`}>{title}</h3><div className="divide-y divide-[var(--studio-border-subtle)]">{children}</div></section>; }
function Field({ name, children }: { name: string; children: React.ReactNode }) { return <div className="grid grid-cols-[42%_1fr] gap-3 py-2.5 text-[12px]"><span className="text-[var(--studio-text-secondary)]">{name}</span><span className="min-w-0 break-words font-medium text-[var(--studio-text-primary)]">{children}</span></div>; }
function Drawer({ title, subtitle, tabs, active, onTab, onClose, children }: { title: string; subtitle?: string; tabs: string[]; active: string; onTab: (tab: string) => void; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [onClose]);
  return <div className="fixed inset-0 z-[70] bg-[var(--studio-overlay)]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside role="dialog" aria-modal="true" aria-label={title} className="ms-auto flex h-full w-full max-w-[560px] flex-col border-s border-[var(--studio-border)] bg-[var(--studio-card)] text-[var(--studio-text-primary)] shadow-[var(--studio-shadow)]"><header className="border-b border-[var(--studio-border)]"><div className="flex items-start justify-between gap-3 px-6 pb-4 pt-6"><div className="min-w-0"><h2 className="truncate text-[20px] font-semibold tracking-tight">{title}</h2>{subtitle && <p className="mt-1 text-[12px] text-[var(--studio-text-secondary)]">{subtitle}</p>}</div><button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)]"><X className="h-4 w-4" /></button></div><nav aria-label={`${title} sections`} className="flex gap-5 overflow-x-auto px-6">{tabs.map((tab) => <button key={tab} type="button" aria-current={active === tab ? 'page' : undefined} onClick={() => onTab(tab)} className={`h-11 shrink-0 border-b-2 text-[12px] font-medium ${active === tab ? 'border-[var(--studio-accent)] text-[var(--studio-text-primary)]' : 'border-transparent text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-primary)]'}`}>{tab}</button>)}</nav></header><div className="flex-1 space-y-4 overflow-y-auto p-6">{children}</div></aside></div>;
}
function Pager({ count, page, setPage, size = 10 }: { count: number; page: number; setPage: (page: number) => void; size?: number }) { const pages = Math.max(1, Math.ceil(count / size)); return <div className="flex items-center justify-between border-t border-[var(--studio-border)] px-4 py-3 text-[11px] text-[var(--studio-text-secondary)]"><span>Showing {count ? page * size + 1 : 0}–{Math.min(count, (page + 1) * size)} of {count}</span><div className="flex items-center gap-2"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg border border-[var(--studio-border)] px-2 py-1 disabled:opacity-40">Previous</button><span>{page + 1} / {pages}</span><button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-lg border border-[var(--studio-border)] px-2 py-1 disabled:opacity-40">Next</button></div></div>; }
function NoData({ text }: { text: string }) { return <div className={`${card} px-6 py-12 text-center text-[13px] text-[var(--studio-text-secondary)]`}>{text}</div>; }

export function RemainingProvidersView({ result }: { result: AdminDataResult<AdminProviderRow[]> }) {
  const t = useTranslations('Admin');
  const [providers, setProviders] = useState(result.data);
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('all'); const [capability, setCapability] = useState('all'); const [range, setRange] = useState('all'); const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [tab, setTab] = useState('Overview'); const [editing, setEditing] = useState(false);
  useEffect(() => setProviders(result.data), [result.data]);
  const selected = providers.find((item) => item.id === selectedId);
  const capabilities = [...new Set(providers.flatMap((item) => item.modalities))].sort();
  const filtered = providers.filter((item) => { const days = range === '7d' ? 7 : range === '30d' ? 30 : 0; return `${item.name} ${item.id} ${item.modalities.join(' ')}`.toLowerCase().includes(query.toLowerCase()) && (status === 'all' || item.status === status) && (capability === 'all' || item.modalities.includes(capability)) && (!days || (item.lastActivityAt != null && new Date(item.lastActivityAt).getTime() >= Date.now() - days * 86400000)); });
  const update = (config: { providerId: string; displayName: string } & Partial<AdminProviderRow>) => setProviders((items) => items.map((item) => item.id === config.providerId ? { ...item, ...config, name: config.displayName } : item));
  const providerTestCopy: ProviderTestCopy = { provider: t('providerTest.provider'), prompt: t('providerTest.prompt'), promptPlaceholder: t('providerTest.promptPlaceholder'), generate: t('providerTest.generate'), generating: t('providerTest.generating'), result: t('providerTest.result'), resultAlt: t('providerTest.resultAlt'), summary: t('providerTest.summary'), summaryHelp: t('providerTest.summaryHelp'), emptyTitle: t('providerTest.emptyTitle'), emptyDescription: t('providerTest.emptyDescription'), genericError: t('providerTest.genericError') };
  return <>{heading('Providers', 'Manage provider connections, routes, activity and diagnostics.', <AdminProviderCreate />)}{!result.available && <NoData text="Provider data is unavailable." />}
    <div className={`${card} mb-4 p-3`}><label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-[var(--studio-text-muted)]" /><input aria-label="Search providers" placeholder="Search providers" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} className={`${control} w-full pl-9`} /></label><div className="mt-3 flex flex-wrap gap-2"><select aria-label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className={control}><option value="all">All statuses</option>{['ready','disabled','misconfigured','unavailable'].map((value) => <option key={value} value={value}>{value}</option>)}</select><select aria-label="Capability" value={capability} onChange={(event) => { setCapability(event.target.value); setPage(0); }} className={control}><option value="all">All capabilities</option>{capabilities.map((value) => <option key={value} value={value}>{value}</option>)}</select><select aria-label="Activity range" value={range} onChange={(event) => { setRange(event.target.value); setPage(0); }} className={control}><option value="all">Any activity</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select><button type="button" onClick={() => { setQuery(''); setStatus('all'); setCapability('all'); setRange('all'); setPage(0); }} className="px-2 text-[12px] text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-primary)]">Clear filters</button></div></div>
    <p className="mb-3 text-[12px] text-[var(--studio-text-secondary)]">{filtered.length} providers · {providers.filter((row) => row.enabled && !row.emergencyDisabled).length} routing enabled · {providers.filter((row) => row.status === 'unavailable' || row.status === 'misconfigured').length} need attention</p>
    {filtered.length ? <div className={`${card} overflow-x-auto`}><table className={`${table} min-w-[900px]`}><thead className="border-b border-[var(--studio-border)]"><tr><th className="w-[23%]">Provider</th><th className="w-[12%]">Health</th><th className="w-[8%]">Models</th><th className="w-[13%]">Success Rate</th><th className="w-[13%]">VANTRA Spend</th><th className="w-[17%]">Limit / Balance</th><th>Last Failure</th></tr></thead><tbody>{filtered.slice(page * 10, (page + 1) * 10).map((row) => <tr key={row.id} tabIndex={0} onClick={() => { setSelectedId(row.id); setTab('Overview'); setEditing(false); }} onKeyDown={(event) => { if (event.key === 'Enter') { setSelectedId(row.id); setTab('Overview'); } }} className="cursor-pointer border-b border-[var(--studio-border-subtle)] last:border-0 hover:bg-[var(--studio-hover)]"><td><p className="font-semibold text-[var(--studio-text-primary)]">{row.name}</p><p className="mt-0.5 text-[11px] capitalize text-[var(--studio-text-muted)]">{row.modalities.join(' · ') || dash}</p></td><td>{providerStatus(row)}</td><td>{new Set(row.associatedModels.map((route) => route.key)).size}</td><td>{row.requestCount === 0 ? 'No traffic' : row.metricsComplete && row.terminalAttempts > 0 ? <><strong>{(row.successfulAttempts / row.terminalAttempts * 100).toFixed(1)}%</strong><p className="text-[10px] text-[var(--studio-text-muted)]">{row.successfulAttempts.toLocaleString()} / {row.terminalAttempts.toLocaleString()}</p></> : dash}</td><td>{row.metricsComplete && row.accumulatedCosts.length ? row.accumulatedCosts.map((amount) => <div key={amount.currency}>{money(amount)}</div>) : dash}</td><td>{row.dailySpendLimitMinor != null && row.spendCurrency ? `${money({ minor: row.dailySpendLimitMinor, currency: row.spendCurrency })} / day` : dash}</td><td>{date(row.lastFailureAt)}</td></tr>)}</tbody></table><Pager count={filtered.length} page={page} setPage={setPage} /></div> : <NoData text="No providers match these filters." />}
    {selected && <Drawer
      title={selected.name}
      subtitle={`${selected.modalities.join(' · ') || 'Provider'} · ${selected.status}`}
      tabs={['Overview', 'Models & Routes', 'Usage & Cost', 'Diagnostics']}
      active={tab}
      onTab={(value) => { setTab(value); setEditing(false); }}
      onClose={() => setSelectedId(null)}
    >
      {tab === 'Overview' && (editing
        ? <><button type="button" onClick={() => setEditing(false)} className="mb-3 h-9 rounded-lg border border-[var(--studio-border)] px-3 text-[12px]">Cancel editing</button><AdminProviderControls provider={selected} mode="identity" onSaved={update} /></>
        : <><div className="flex justify-end"><button type="button" onClick={() => setEditing(true)} className="mb-3 h-9 rounded-lg border border-[var(--studio-border)] px-3 text-[12px] hover:bg-[var(--studio-hover)]">Edit Provider</button></div><ProviderOverview row={selected} /></>)}
      {tab === 'Models & Routes' && <ProviderRoutes row={selected} />}
      {tab === 'Usage & Cost' && <ProviderUsage row={selected} />}
      {tab === 'Diagnostics' && <><ProviderDiagnostics row={selected} />{selected.id === 'runware' && <div className="mt-4"><RunwareProviderTest copy={providerTestCopy} /></div>}</>}
    </Drawer>}</>;
}

export function RemainingRuntimeView({ result }: { result: AdminDataResult<AdminProviderRow[]> }) {
  const [providers, setProviders] = useState(result.data);
  const [tab, setTab] = useState('Chat Limits');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState('Overview');
  useEffect(() => setProviders(result.data), [result.data]);
  const selected = providers.find((row) => row.id === selectedId);
  const visible = providers.filter((row) => row.name.toLowerCase().includes(query.toLowerCase()) || row.id.toLowerCase().includes(query.toLowerCase()));
  const update = (config: { providerId: string; displayName: string } & Partial<AdminProviderRow>) =>
    setProviders((items) => items.map((item) => item.id === config.providerId ? { ...item, ...config, name: config.displayName } : item));
  const open = (row: AdminProviderRow, view = 'Overview') => { setSelectedId(row.id); setDrawerTab(view); };
  const todaySpend = (row: AdminProviderRow) => {
    const minor = row.dailyUsage.at(-1)?.spendUsdMinor;
    return row.metricsComplete && minor != null ? money({ minor, currency: 'USD' }) : dash;
  };
  return <>
    {heading('Limits & Fallback', 'Control chat allowances, provider routing and safety settings.')}
    {!result.available && <NoData text="Runtime data is unavailable. The layout remains ready for configured providers." />}
    <nav aria-label="Limits sections" className="mb-5 flex flex-wrap gap-6 border-b border-[var(--studio-border)]">
      {['Chat Limits', 'Provider Routing', 'Fallback', 'Safety & Capacity'].map((value) =>
        <button type="button" key={value} onClick={() => setTab(value)} className={`h-11 border-b-2 text-[12px] font-medium ${tab === value ? 'border-[var(--studio-accent)] text-[var(--studio-text-primary)]' : 'border-transparent text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-primary)]'}`}>{value}</button>)}
    </nav>

    {tab === 'Chat Limits' && <>
      <div className={`${card} overflow-x-auto`}>
        <div className="border-b border-[var(--studio-border)] p-5"><h2 className="text-[16px] font-semibold">Chat Limits</h2><p className="mt-1 text-[12px] text-[var(--studio-text-secondary)]">Internal VANTRA weighted units, not API tokens.</p></div>
        <table className={`${table} min-w-[680px]`}><thead><tr><th>Plan</th><th>5-hour limit</th><th>Weekly limit</th><th>Fallback</th><th>Status</th></tr></thead>
          <tbody>{[
            ['Free', '120', '800', 'Disabled', 'Configured'],
            ['Lite', '200', '1,300', 'Disabled', 'Configured'],
            ['Pro', '250', '3,000', 'Not configured', 'Configured'],
            ['Max', dash, dash, dash, 'Frozen'],
          ].map((row) => <tr key={row[0]} className="border-t border-[var(--studio-border-subtle)]"><td className="font-semibold">{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td>{pill(row[4], row[4] === 'Configured' ? 'success' : 'neutral')}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className={`${card} p-4`}><h3 className="text-[13px] font-semibold">Weighted units</h3><p className="mt-2 text-[12px] text-[var(--studio-text-secondary)]">Chat limits use internal VANTRA units. They do not represent provider API tokens.</p></div>
        <div className={`${card} p-4`}><h3 className="text-[13px] font-semibold">Time windows</h3><p className="mt-2 text-[12px] text-[var(--studio-text-secondary)]">The displayed allowances apply per five-hour and weekly window where configured.</p></div>
        <div className={`${card} p-4`}><h3 className="text-[13px] font-semibold">Fallback policy</h3><p className="mt-2 text-[12px] text-[var(--studio-text-secondary)]">Automatic fallback routing is not enabled. Provider route flags remain visible for inspection.</p></div>
      </div>
    </>}

    {tab === 'Provider Routing' && <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p className="text-[12px] text-[var(--studio-text-secondary)]">{visible.length} providers · runtime configuration</p><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-[var(--studio-text-muted)]" /><input aria-label="Search routing providers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search provider" className={`${control} pl-9`} /></label></div>
      <div className={`${card} overflow-x-auto`}><table className={`${table} min-w-[850px]`}><thead className="border-b border-[var(--studio-border)]"><tr><th>Provider</th><th>Routing</th><th>Priority</th><th>Daily Limit</th><th>Usage Today</th><th>Emergency Stop</th><th>Health</th></tr></thead>
        <tbody>{visible.map((row) => <tr key={row.id} tabIndex={0} onClick={() => open(row)} onKeyDown={(event) => { if (event.key === 'Enter') open(row); }} className="cursor-pointer border-t border-[var(--studio-border-subtle)] hover:bg-[var(--studio-hover)] focus-visible:bg-[var(--studio-hover)]"><td className="font-semibold">{row.name}</td><td>{pill(row.enabled && !row.emergencyDisabled ? 'Enabled' : 'Disabled', row.enabled && !row.emergencyDisabled ? 'success' : 'neutral')}</td><td>{row.priority}</td><td>{row.dailySpendLimitMinor != null && row.spendCurrency ? `${money({ minor: row.dailySpendLimitMinor, currency: row.spendCurrency })} / day` : 'No limit'}</td><td>{todaySpend(row)}</td><td>{pill(row.emergencyDisabled ? 'On' : 'Off', row.emergencyDisabled ? 'danger' : 'neutral')}</td><td>{providerStatus(row)}</td></tr>)}</tbody>
      </table>{!visible.length && <p className="p-8 text-center text-[12px] text-[var(--studio-text-secondary)]">No providers match this search.</p>}</div>
    </>}

    {tab === 'Fallback' && <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,1fr)]">
      <section className={`${card} p-5`}><div className="flex items-start justify-between gap-3"><div><h2 className="text-[16px] font-semibold">Fallback configuration</h2><p className="mt-1 text-[12px] text-[var(--studio-text-secondary)]">Reserved for a future automatic routing policy.</p></div>{pill('Not configured')}</div><div className="mt-6 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--studio-border)] bg-[var(--studio-recessed)] px-6 text-center"><p className="text-[14px] font-semibold">No fallback policy configured</p><p className="mt-2 max-w-sm text-[12px] text-[var(--studio-text-secondary)]">Automatic fallback routing is not enabled yet. Existing fallback-marked model routes are shown separately and do not activate failover.</p></div></section>
      <section className={`${card} p-5`}><h2 className="text-[16px] font-semibold">Route markers</h2><p className="mt-1 text-[12px] text-[var(--studio-text-secondary)]">Stored route flags only.</p><div className="mt-4 divide-y divide-[var(--studio-border-subtle)]">{providers.map((row) => <div key={row.id} className="flex justify-between gap-3 py-2.5 text-[12px]"><span>{row.name}</span><span className="text-[var(--studio-text-secondary)]">{row.associatedModels.filter((route) => route.fallback).length} marked</span></div>)}{!providers.length && <p className="py-6 text-[12px] text-[var(--studio-text-secondary)]">No provider routes recorded.</p>}</div></section>
    </div>}

    {tab === 'Safety & Capacity' && <div className="space-y-4">
      <ProviderSafetySummary rows={providers} />
      <section className={`${card} overflow-x-auto`}><div className="border-b border-[var(--studio-border)] px-4 py-3"><h2 className="text-[15px] font-semibold">Provider safeguards</h2><p className="mt-1 text-[11px] text-[var(--studio-text-secondary)]">Actual routing, limits and stop states from runtime configuration.</p></div><table className={`${table} min-w-[760px]`}><thead><tr><th>Provider</th><th>Routing</th><th>Emergency Stop</th><th>Priority</th><th>Daily Limit</th><th>Capacity State</th></tr></thead><tbody>{providers.map((row) => <tr key={row.id} tabIndex={0} onClick={() => open(row, 'Runtime & Limits')} onKeyDown={(event) => { if (event.key === 'Enter') open(row, 'Runtime & Limits'); }} className="cursor-pointer border-t border-[var(--studio-border-subtle)] hover:bg-[var(--studio-hover)]"><td className="font-semibold">{row.name}</td><td>{pill(row.enabled ? 'Enabled' : 'Disabled', row.enabled ? 'success' : 'neutral')}</td><td>{pill(row.emergencyDisabled ? 'On' : 'Off', row.emergencyDisabled ? 'danger' : 'neutral')}</td><td>{row.priority}</td><td>{row.dailySpendLimitMinor && row.spendCurrency ? money({ minor: row.dailySpendLimitMinor, currency: row.spendCurrency }) : 'No limit'}</td><td>{row.status === 'unavailable' ? pill('Unavailable', 'danger') : row.status === 'misconfigured' ? pill('Needs setup', 'warning') : dash}</td></tr>)}</tbody></table></section>
    </div>}

    {selected && <Drawer title={selected.name} subtitle="Runtime provider configuration" tabs={['Overview', 'Runtime & Limits', 'Fallback Role', 'History']} active={drawerTab} onTab={setDrawerTab} onClose={() => setSelectedId(null)}>
      {drawerTab === 'Overview' && <div className="space-y-3"><Section title="Provider"><Field name="Routing">{pill(selected.enabled && !selected.emergencyDisabled ? 'Enabled' : 'Disabled', selected.enabled && !selected.emergencyDisabled ? 'success' : 'neutral')}</Field><Field name="Health">{providerStatus(selected)}</Field><Field name="Priority">{selected.priority}</Field></Section><Section title="Runtime snapshot"><Field name="Daily limit">{selected.dailySpendLimitMinor && selected.spendCurrency ? money({ minor: selected.dailySpendLimitMinor, currency: selected.spendCurrency }) : 'No limit'}</Field><Field name="Recorded spend today">{todaySpend(selected)}</Field><Field name="Emergency stop">{selected.emergencyDisabled ? 'On' : 'Off'}</Field><Field name="Last activity">{date(selected.lastActivityAt)}</Field></Section></div>}
      {drawerTab === 'Runtime & Limits' && <><div className="rounded-lg border border-blue-400/20 bg-blue-400/5 p-3 text-[11px] text-blue-200">Changes control future routing. Completed jobs remain unchanged. Limits are entered in currency units.</div><AdminProviderControls provider={selected} mode="runtime" onSaved={update} /></>}
      {drawerTab === 'Fallback Role' && <ProviderFallbackPanel row={selected} />}
      {drawerTab === 'History' && <ProviderRuntimeHistory row={selected} />}
    </Drawer>}
  </>;
}
function stateChanges(row: AdminAuditRow) { const before = row.previousState ?? {}; const after = row.newState ?? {}; return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map((key) => ({ key, before: before[key], after: after[key] })); }
function readable(value: unknown, key: string) { if (value == null) return dash; if (typeof value === 'boolean') return /enabled|active|disabled|emergency|visible|configured/i.test(key) ? value ? 'Enabled' : 'Disabled' : value ? 'Yes' : 'No'; if (typeof value === 'string' || typeof value === 'number') return String(value); return dash; }
function auditCategory(row: AdminAuditRow) { if (row.resourceType.includes('payment') || row.resourceType.includes('plan')) return 'Payments'; if (row.resourceType.includes('provider')) return 'Providers'; if (row.resourceType.includes('model')) return 'Models'; if (row.resourceType.includes('user')) return 'Users'; return 'Other'; }
export function RemainingAuditView({ result }: { result: AdminDataResult<AdminAuditRow[]> }) {
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('all'); const [action, setAction] = useState('all'); const [resource, setResource] = useState('all'); const [actor, setActor] = useState('all'); const [range, setRange] = useState('30d'); const [page, setPage] = useState(0); const [selected, setSelected] = useState<AdminAuditRow | null>(null);
  const actions = [...new Set(result.data.map((row) => row.action))].sort(); const resources = [...new Set(result.data.map((row) => row.resourceType))].sort(); const actors = [...new Set(result.data.map((row) => row.actor).filter((value): value is string => Boolean(value)))].sort();
  const filtered = useMemo(() => result.data.filter((row) => { const days = range === '7d' ? 7 : range === '30d' ? 30 : 0; const haystack = `${row.action} ${row.actor ?? ''} ${row.resource} ${row.resourceType} ${row.resourceId} ${row.id}`.toLowerCase(); return haystack.includes(query.toLowerCase()) && (category === 'all' || auditCategory(row) === category) && (action === 'all' || row.action === action) && (resource === 'all' || row.resourceType === resource) && (actor === 'all' || row.actor === actor) && (!days || new Date(row.createdAt).getTime() >= Date.now() - days * 86400000); }).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [result.data,query,category,action,resource,actor,range]);
  return <>{heading('Audit Log', 'Review recorded Admin and payment actions.', pill('Read-only'))}{!result.available && <NoData text="Audit data is unavailable." />}<div className={`${card} mb-4 p-3`}><label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-[var(--studio-text-muted)]" /><input aria-label="Search audit log" placeholder="Search actions, actors, resources, users, IDs" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} className={`${control} w-full pl-9`} /></label><div className="mt-3 flex flex-wrap gap-2">{[['Category',category,setCategory,['Payments','Providers','Models','Users','Other']],['Action',action,setAction,actions],['Resource',resource,setResource,resources],['Actor',actor,setActor,actors]] .map(([name,value,set,values]) => <select key={name as string} aria-label={name as string} value={value as string} onChange={(event) => { (set as (value: string) => void)(event.target.value); setPage(0); }} className={control}><option value="all">All {String(name).toLowerCase()}s</option>{(values as string[]).map((item) => <option key={item} value={item}>{item}</option>)}</select>)}<select aria-label="Date range" value={range} onChange={(event) => { setRange(event.target.value); setPage(0); }} className={control}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All loaded</option></select></div></div><p className="mb-3 text-[12px] text-[var(--studio-text-secondary)]">{filtered.length} recorded events</p>
    {filtered.length ? <div className={`${card} overflow-x-auto`}><table className={`${table} min-w-[800px]`}><thead><tr><th className="w-[19%]">Time</th><th className="w-[23%]">Actor</th><th className="w-[22%]">Action</th><th className="w-[20%]">Resource</th><th>Change</th></tr></thead><tbody>{filtered.slice(page*10,(page+1)*10).map((row) => { const changes = stateChanges(row); return <tr key={`${row.resourceType}:${row.id}`} tabIndex={0} onClick={() => setSelected(row)} onKeyDown={(event) => { if (event.key === 'Enter') setSelected(row); }} className="cursor-pointer border-t border-[var(--studio-border-subtle)] hover:bg-[var(--studio-hover)]"><td>{date(row.createdAt)}</td><td className="truncate">{row.actor ?? dash}</td><td className="font-medium">{row.action.replaceAll('_',' ')}</td><td className="truncate">{row.resource || row.resourceType}</td><td className="truncate text-[var(--studio-text-secondary)]">{changes.length === 1 ? `${changes[0].key.replaceAll('_',' ')}: ${readable(changes[0].before,changes[0].key)} → ${readable(changes[0].after,changes[0].key)}` : changes.length > 1 ? `${changes.length} fields changed` : row.detail ?? dash}</td></tr>; })}</tbody></table><Pager count={filtered.length} page={page} setPage={setPage} /></div> : <NoData text="No audit events match these filters." />}
    {selected && <Drawer title={selected.action.replaceAll('_',' ')} subtitle={date(selected.createdAt)} tabs={['Event Details']} active="Event Details" onTab={() => {}} onClose={() => setSelected(null)}><Section title="Event"><Field name="Action">{selected.action.replaceAll('_',' ')}</Field><Field name="Actor">{selected.actor ?? dash}</Field><Field name="Time">{date(selected.createdAt)}</Field><Field name="Category">{auditCategory(selected)}</Field></Section><Section title="Resource"><Field name="Type">{selected.resourceType.replaceAll('_',' ')}</Field><Field name="Resource">{selected.resource || dash}</Field><Field name="Identifier">{selected.resourceId || dash}</Field></Section><Section title="Change">{stateChanges(selected).length ? stateChanges(selected).map(({key,before,after}) => <Field key={key} name={key.replaceAll('_',' ')}>{readable(before,key)} → {readable(after,key)}</Field>) : <Field name="Description">{selected.detail ?? dash}</Field>}</Section><details className={`${card} p-3 text-[11px]`}><summary className="cursor-pointer text-[var(--studio-text-secondary)]">Technical details</summary><pre className="mt-3 whitespace-pre-wrap break-all">{JSON.stringify({ id: selected.id, resourceId: selected.resourceId, previousState: selected.previousState, newState: selected.newState }, null, 2)}</pre></details></Drawer>}</>;
}
