'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';

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
  const input = 'h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40';
  return <div className="mb-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3">
    <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] px-3 text-[12px] font-semibold text-white"><Plus className="h-4 w-4" aria-hidden="true" />Add provider</button>
    {open && <div className="mt-3 grid gap-2 sm:grid-cols-2"><input aria-label="Provider slug" placeholder="provider-slug" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} className={input} /><input aria-label="Display name" placeholder="Display name" value={name} onChange={(event) => setName(event.target.value)} className={input} /><input aria-label="HTTPS base endpoint" placeholder="https://api.example.com/v1" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} className={`${input} sm:col-span-2`} /><p className="text-[11px] text-[var(--studio-text-muted)] sm:col-span-2">OpenAI-compatible chat only. Credentials are read from the derived Vercel environment variable and are never stored here.</p><button type="button" disabled={saving || !valid} onClick={create} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 text-[12px] font-semibold text-black disabled:opacity-45">{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Create disabled provider</button>{error && <p role="alert" className="text-[11px] text-red-200">{error}</p>}</div>}
  </div>;
}
