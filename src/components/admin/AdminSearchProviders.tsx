import { adminSearchProviderRows } from '@/lib/web/search-health.server';

const fmt = (value: string | null) => value
  ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export default async function AdminSearchProviders() {
  const { available, providers } = await adminSearchProviderRows();
  return <section className="mt-5 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-card)] p-4">
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <div><h2 className="text-[16px] font-semibold text-[var(--studio-text-primary)]">Web search providers</h2>
        <p className="text-[12px] text-[var(--studio-text-secondary)]">On-demand search health; no connection polling or inferred provider quota.</p></div>
      {!available && <span className="text-[12px] text-[var(--studio-text-secondary)]">Telemetry unavailable; install the search health migration.</span>}
    </div>
    <div className="grid gap-2 lg:grid-cols-2">{providers.map((provider) => <div key={provider.id}
      className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3 text-[12px]">
      <div className="flex items-center justify-between gap-3"><strong className="text-[var(--studio-text-primary)]">{provider.name}</strong>
        <span className="text-[var(--studio-text-secondary)]">{provider.status}</span></div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[var(--studio-text-secondary)] sm:grid-cols-4">
        <span>Requests <strong className="tabular-nums text-[var(--studio-text-primary)]">{available ? provider.requests : '—'}</strong></span>
        <span>Successes <strong className="tabular-nums text-[var(--studio-text-primary)]">{available ? provider.successes : '—'}</strong></span>
        <span>Failures <strong className="tabular-nums text-[var(--studio-text-primary)]">{available ? provider.failures : '—'}</strong></span>
        <span>Rate limits <strong className="tabular-nums text-[var(--studio-text-primary)]">{available ? provider.rateLimits : '—'}</strong></span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--studio-text-secondary)]">
        <span>Last success: {fmt(provider.lastSuccessAt)}</span><span>Last failure: {fmt(provider.lastFailureAt)}</span>
        {provider.lastFailureCategory && <span>Issue: {provider.lastFailureCategory.replaceAll('_', ' ')}</span>}
      </div>
      {provider.budget != null && <p className="mt-2 text-[11px] text-[var(--studio-text-secondary)]">
        VANTRA request budget: <span className="tabular-nums">{available ? provider.requests : '—'} / {provider.budget}</span>
        {provider.budgetState !== 'none' && available ? ` · ${provider.budgetState}` : ''}</p>}
    </div>)}</div>
  </section>;
}
