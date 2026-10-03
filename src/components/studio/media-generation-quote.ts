'use client';

import { useEffect, useState } from 'react';

export type GenerationQuote = { status: 'loading' | 'unknown' } | {
  status: 'ready'; credits: number; balance: number; included: boolean; canGenerate: boolean;
};
export function parseGenerationQuote(value: unknown): GenerationQuote {
  if (!value || typeof value !== 'object') return { status: 'unknown' };
  const q = value as Record<string, unknown>;
  if (typeof q.credits !== 'number' || !Number.isSafeInteger(q.credits) || q.credits < 0
    || typeof q.balance !== 'number' || !Number.isFinite(q.balance) || q.balance < 0
    || typeof q.canGenerate !== 'boolean') return { status: 'unknown' };
  return { status: 'ready', credits: q.credits, balance: q.balance, canGenerate: q.canGenerate,
    included: q.credits === 0 && typeof q.allowanceRemaining === 'number' && q.allowanceRemaining > 0 };
}

/** Refresh the existing authoritative quote whenever the selected options change.
 * The current catalog charges a flat model price; never invent option multipliers. */
export function useGenerationQuote(modality: 'image' | 'video', modelId: string | undefined, options: string, accountId?: string, generating = false) {
  const key = JSON.stringify([modality, modelId, options, accountId, generating]);
  const [snapshot, setSnapshot] = useState<{ key: string; quote: GenerationQuote }>();
  useEffect(() => {
    if (!modelId) return;
    const controller = new AbortController();
    void fetch(`/api/generate/media/quote?modality=${modality}&modelId=${encodeURIComponent(modelId)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => response.ok ? parseGenerationQuote(await response.json()) : { status: 'unknown' } as GenerationQuote)
      .then(quote => { if (!controller.signal.aborted) setSnapshot({ key, quote }); })
      .catch(() => { if (!controller.signal.aborted) setSnapshot({ key, quote: { status: 'unknown' } }); });
    return () => controller.abort();
  }, [key, modality, modelId]);
  return !modelId ? { status: 'unknown' } as GenerationQuote
    : snapshot?.key === key ? snapshot.quote : { status: 'loading' } as GenerationQuote;
}

export function generationAction({ prompt, modelId, available, generating, sourceMissing, quote }: {
  prompt: string; modelId?: string; available: boolean; generating: boolean; sourceMissing?: boolean; quote: GenerationQuote;
}) {
  const reason = generating ? 'generating' : !prompt.trim() ? 'prompt' : !modelId ? 'model'
    : sourceMissing ? 'source' : quote.status !== 'ready' ? quote.status : !available ? 'unavailable' : null;
  const insufficient = quote.status === 'ready' && !quote.included && quote.balance < quote.credits;
  return { reason: reason ?? (quote.status === 'ready' && !quote.canGenerate && !insufficient ? 'unavailable' : null),
    insufficient, canGenerate: reason === null && quote.status === 'ready' && quote.canGenerate && !insufficient };
}
