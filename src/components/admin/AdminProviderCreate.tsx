'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X } from 'lucide-react';

const providerError = (code: string) => ({
  PROVIDER_ENDPOINT_UNSAFE: 'Use a public HTTPS endpoint. Private, local, link-local and metadata networks are blocked.',
  PROVIDER_ENDPOINT_INVALID: 'Enter a valid HTTPS base endpoint.',
  PROVIDER_IDENTITY_EXISTS: 'That provider slug already exists.',
  PROVIDER_CREATE_FAILED: 'The provider could not be created.',
}[code] ?? 'The provider could not be created.');

export default function AdminProviderCreate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[a-z0-9][a-z0-9_-]{1,63}$/.test(slug) && Boolean(name.trim()) && endpoint.startsWith('https://');
  const create = async () => {
    setSaving(true); setError(null);
    try {
      const response = await fetch('/api/admin/providers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, displayName: name.trim(), adapterType: 'openai-compatible-chat', baseEndpoint: endpoint.trim() }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'PROVIDER_CREATE_FAILED');
      setSlug(''); setName(''); setEndpoint(''); setOpen(false); router.refresh();
    } catch (cause) { setError(providerError(cause instanceof Error ? cause.message : 'PROVIDER_CREATE_FAILED')); }
    finally { setSaving(false); }
  };
  const input = 'h-10 w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 text-[12px] text-[var(--studio-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]';
  return <><button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--studio-accent)] px-3.5 text-[12px] font-semibold text-[var(--studio-accent-contrast)]"><Plus className="h-4 w-4" aria-hidden="true" />Add Provider</button>
    {open && <div className="fixed inset-0 z-[80] bg-[var(--studio-overlay)]" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><aside role="dialog" aria-modal="true" aria-label="Add Provider" className="ms-auto flex h-full w-full max-w-[520px] flex-col border-s border-[var(--studio-border)] bg-[var(--studio-card)] text-[var(--studio-text-primary)] shadow-[var(--studio-shadow)]"><header className="flex items-center justify-between border-b border-[var(--studio-border)] px-6 py-5"><div><h2 className="text-[20px] font-semibold">Add Provider</h2><p className="mt-1 text-[12px] text-[var(--studio-text-secondary)]">Create an OpenAI-compatible chat provider.</p></div><button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-[var(--studio-hover)]"><X className="h-4 w-4" /></button></header><div className="flex-1 space-y-4 overflow-y-auto p-6"><section className="space-y-3 rounded-xl border border-[var(--studio-border)] p-4"><h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--studio-text-secondary)]">Provider</h3><label className="block text-[12px]">Display name<input className={`${input} mt-1.5`} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block text-[12px]">Slug<input className={`${input} mt-1.5`} value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} /></label><label className="block text-[12px]">HTTPS base endpoint<input className={`${input} mt-1.5`} value={endpoint} placeholder="https://api.example.com/v1" onChange={(event) => setEndpoint(event.target.value)} /></label></section><p className="text-[12px] leading-relaxed text-[var(--studio-text-secondary)]">The provider starts disabled. Credentials are read from the derived Vercel environment variable and are never stored here.</p>{error && <p role="alert" className="text-[12px] text-red-200">{error}</p>}</div><footer className="flex justify-end gap-2 border-t border-[var(--studio-border)] p-4"><button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg border border-[var(--studio-border)] px-4 text-[12px]">Cancel</button><button type="button" disabled={saving || !valid} onClick={create} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--studio-accent)] px-4 text-[12px] font-semibold text-[var(--studio-accent-contrast)] disabled:opacity-45">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Create Provider</button></footer></aside></div>}</>;
}
