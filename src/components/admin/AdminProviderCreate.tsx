'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X } from 'lucide-react';

const providerError = (code: string) => ({
  PROVIDER_ENDPOINT_UNSAFE: 'Use a public HTTPS endpoint. Private, local, link-local and metadata networks are blocked.',
  PROVIDER_ENDPOINT_INVALID: 'Enter a valid HTTPS base endpoint.',
  PROVIDER_IDENTITY_EXISTS: 'That provider slug already exists.',
  PROVIDER_CREATE_FAILED: 'The provider could not be created.',
}[code] ?? 'The provider could not be created.');

const input = 'mt-1.5 h-10 w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 text-[12px] text-[var(--studio-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]';
const card = 'rounded-xl border border-[var(--studio-border)] bg-[var(--studio-card)] p-4';

export default function AdminProviderCreate() {
  const router = useRouter();
  const firstInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[a-z0-9][a-z0-9_-]{1,63}$/.test(slug) && Boolean(name.trim()) && endpoint.startsWith('https://');

  useEffect(() => {
    if (!open) return;
    firstInput.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) setOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, saving]);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug, displayName: name.trim(), adapterType: 'openai-compatible-chat',
          baseEndpoint: endpoint.trim(),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'PROVIDER_CREATE_FAILED');
      setSlug('');
      setName('');
      setEndpoint('');
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(providerError(cause instanceof Error ? cause.message : 'PROVIDER_CREATE_FAILED'));
    } finally {
      setSaving(false);
    }
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--studio-accent)] px-3.5 text-[12px] font-semibold text-[var(--studio-accent-contrast)]">
      <Plus className="h-4 w-4" aria-hidden="true" />Add Provider
    </button>
    {open && <div className="fixed inset-0 z-[80] bg-[var(--studio-overlay)]" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false); }}>
      <aside role="dialog" aria-modal="true" aria-label="Add Provider" className="ms-auto flex h-full w-full max-w-[560px] flex-col border-s border-[var(--studio-border)] bg-[var(--studio-card)] text-[var(--studio-text-primary)] shadow-[var(--studio-shadow)]">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--studio-border)] px-6 py-5">
          <div><h2 className="text-[20px] font-semibold tracking-tight">Add Provider</h2><p className="mt-1 text-[12px] text-[var(--studio-text-secondary)]">Set up a provider identity and secure endpoint.</p></div>
          <button type="button" aria-label="Close" disabled={saving} onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-[var(--studio-hover)] disabled:opacity-40"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <section className={card}>
            <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--studio-text-secondary)]">Provider identity</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[12px]">Provider name<input ref={firstInput} className={input} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Display name" /></label>
              <label className="text-[12px]">Route identifier<input className={input} maxLength={64} value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="provider-slug" /><span className="mt-1 block text-[10px] text-[var(--studio-text-muted)]">Unique; cannot be changed later.</span></label>
              <label className="text-[12px]">Adapter<input className={input} readOnly value="OpenAI-compatible chat" /></label>
              <label className="text-[12px]">Capabilities<input className={input} readOnly value="Chat" /></label>
              <label className="text-[12px] sm:col-span-2">HTTPS base endpoint<input className={input} value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://api.example.com/v1" maxLength={500} /></label>
            </div>
          </section>
          <section className={card}>
            <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--studio-text-secondary)]">Credential & initial state</h3>
            <div className="grid grid-cols-[42%_1fr] gap-3 border-b border-[var(--studio-border-subtle)] py-2 text-[12px]"><span className="text-[var(--studio-text-secondary)]">Credential</span><span>Checked after creation</span></div>
            <div className="grid grid-cols-[42%_1fr] gap-3 border-b border-[var(--studio-border-subtle)] py-2 text-[12px]"><span className="text-[var(--studio-text-secondary)]">Credential action</span><span>Configure the derived Vercel environment variable securely</span></div>
            <div className="grid grid-cols-[42%_1fr] gap-3 py-2 text-[12px]"><span className="text-[var(--studio-text-secondary)]">Initial routing state</span><span>Disabled until reviewed</span></div>
          </section>
          <section className={card}><h3 className="text-[12px] font-semibold">Notes</h3><p className="mt-2 text-[11px] leading-relaxed text-[var(--studio-text-secondary)]">This provider type supports chat. Notes and credential uploads are not stored by the current Admin API. Credentials never appear in this drawer.</p></section>
          {error && <p role="alert" className="rounded-lg border border-red-400/25 bg-red-400/5 p-3 text-[12px] text-red-200">{error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-[var(--studio-border)] p-4">
          <button type="button" disabled={saving} onClick={() => setOpen(false)} className="h-10 rounded-lg border border-[var(--studio-border)] px-4 text-[12px] disabled:opacity-40">Cancel</button>
          <button type="button" disabled={saving || !valid} onClick={() => void create()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--studio-accent)] px-4 text-[12px] font-semibold text-[var(--studio-accent-contrast)] disabled:opacity-45">{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Create disabled provider</button>
        </footer>
      </aside>
    </div>}
  </>;
}