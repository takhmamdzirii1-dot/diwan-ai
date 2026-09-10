'use client';

import { useState } from 'react';
import { AlertCircle, ImageIcon, Loader2 } from 'lucide-react';

export type ProviderTestCopy = {
  provider: string;
  prompt: string;
  promptPlaceholder: string;
  generate: string;
  generating: string;
  result: string;
  resultAlt: string;
  summary: string;
  summaryHelp: string;
  emptyTitle: string;
  emptyDescription: string;
  genericError: string;
};

type TestResponse = {
  provider?: string;
  model?: string;
  imageUrl?: string;
  summary?: Record<string, unknown>;
  error?: string;
  requestId?: string | null;
};

export default function RunwareProviderTest({ copy }: { copy: ProviderTestCopy }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestResponse | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/internal/providers/runware/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'runware', prompt: normalizedPrompt }),
      });
      const payload = (await response.json().catch(() => ({}))) as TestResponse;
      if (!response.ok || !payload.imageUrl) {
        setError(payload.error || copy.genericError);
        if (payload.requestId) setResult({ requestId: payload.requestId });
        return;
      }
      setResult(payload);
    } catch {
      setError(copy.genericError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] p-5 sm:p-6"
      >
        <div className="space-y-5">
          <label className="block space-y-2 text-start">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--studio-text-muted)]">
              {copy.provider}
            </span>
            <select
              defaultValue="runware"
              disabled={loading}
              aria-label={copy.provider}
              className="h-11 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3.5 text-[13px] text-white outline-none transition-[border-color,background-color] duration-150 focus-visible:border-[var(--studio-border-strong)] focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:text-[var(--studio-text-disabled)] motion-reduce:transition-none"
            >
              <option value="runware">Runware</option>
            </select>
          </label>

          <label className="block space-y-2 text-start">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--studio-text-muted)]">
              {copy.prompt}
            </span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={copy.promptPlaceholder}
              maxLength={2000}
              rows={8}
              disabled={loading}
              className="w-full resize-y rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-3.5 text-[13px] leading-relaxed text-white outline-none transition-[border-color,background-color] duration-150 placeholder:text-[var(--studio-text-muted)] focus-visible:border-[var(--studio-border-strong)] focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:text-[var(--studio-text-disabled)] motion-reduce:transition-none"
            />
          </label>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-[12px] leading-relaxed text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-[13px] font-semibold text-black transition-[background-color,transform] duration-150 hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--studio-bg)] motion-reduce:transition-none"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {loading ? copy.generating : copy.generate}
          </button>
        </div>
      </form>

      <section
        aria-label={copy.result}
        aria-busy={loading}
        className="flex min-h-[380px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--studio-border-subtle)] bg-white/[0.012]"
      >
        <div className="border-b border-[var(--studio-border-subtle)] px-5 py-4 text-start">
          <h2 className="text-[13px] font-medium text-white/85">{copy.result}</h2>
        </div>

        {result?.imageUrl ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-1 items-center justify-center bg-black p-4 sm:p-6">
              <img
                src={result.imageUrl}
                alt={copy.resultAlt}
                className="max-h-[58dvh] w-auto max-w-full rounded-xl object-contain"
              />
            </div>
            <details className="border-t border-[var(--studio-border-subtle)] p-4 text-start">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--studio-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                {copy.summary}
              </summary>
              <p className="mt-2 text-[10.5px] leading-relaxed text-white/40">{copy.summaryHelp}</p>
              <pre dir="ltr" className="mt-3 max-h-40 overflow-auto rounded-xl border border-[var(--studio-border)] bg-black/40 p-3 text-[11px] leading-relaxed text-white/65">
                {JSON.stringify(result.summary ?? result, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-white/35 motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <ImageIcon className="h-9 w-9 text-white/20" aria-hidden="true" />
            )}
            <p className="mt-4 text-[14px] font-medium text-white/75">{loading ? copy.generating : copy.emptyTitle}</p>
            {!loading && <p className="mt-1.5 max-w-sm text-[12px] leading-relaxed text-[var(--studio-text-muted)]">{copy.emptyDescription}</p>}
            {result?.requestId && (
              <code dir="ltr" className="mt-4 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[10px] text-white/45">
                {result.requestId}
              </code>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
