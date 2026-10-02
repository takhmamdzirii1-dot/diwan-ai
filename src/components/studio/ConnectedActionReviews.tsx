'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Review = { id: string; appId: string; status: string; summary: string; arguments: Record<string, unknown>; expiresAt: string;
  result: { text: string } | null };

/** Exact server-stored target/content are reviewed here, never a client "confirmed" flag in Chat. */
export default function ConnectedActionReviews() {
  const t = useTranslations('studio.settings.connectedActionReviews');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/connected-apps/reviews', { cache: 'no-store', signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error('unavailable');
      return response.json() as Promise<{ reviews: Review[] }>;
    }).then(value => setReviews(value.reviews)).catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, []);
  const resolve = async (id: string, approve: boolean) => {
    if (busy) return; setBusy(id); setError(false);
    try {
      const response = await fetch('/api/connected-apps/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: id, approve }) });
      if (!response.ok) throw new Error('unavailable');
      const value = await response.json() as { status: string; result?: Review['result'] };
      setReviews(current => current.map(row => row.id === id ? { ...row, status: value.status, result: value.result ?? null } : row));
    } catch { setError(true); } finally { setBusy(null); }
  };
  if (!reviews.length && !error) return null;
  return <section className="space-y-3" aria-label={t('title')}>
    <h3 className="text-sm font-medium text-[var(--studio-text-primary)]">{t('title')}</h3>
    <p className="text-xs text-[var(--studio-text-secondary)]">{t('description')}</p>
    {reviews.map(review => <article key={review.id} className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-4">
      <p dir="auto" className="text-sm text-[var(--studio-text-primary)]">{review.summary}</p>
      <details className="mt-2 text-xs text-[var(--studio-text-secondary)]"><summary className="cursor-pointer">{t('content')}</summary>
        <dl className="mt-2 space-y-2">{Object.entries(review.arguments).filter(([key]) => key !== 'operation').map(([key, value]) => <div key={key}>
          <dt className="font-medium" dir="auto">{key}</dt><dd dir="auto" className="whitespace-pre-wrap break-words select-text">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
        </div>)}</dl></details>
      <p className="mt-2 text-xs text-[var(--studio-text-secondary)]">{t(['pending', 'executing', 'completed', 'failed', 'unknown', 'cancelled'].includes(review.status) ? review.status : 'notExecuted')}</p>
      {review.result && <p dir="auto" className="mt-2 whitespace-pre-wrap break-words select-text text-xs text-[var(--studio-text-primary)]">{review.result.text}</p>}
      {review.status === 'pending' && Date.parse(review.expiresAt) > Date.now() && <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy !== null} onClick={() => void resolve(review.id, true)} type="button"
          className="min-h-9 rounded-lg border border-[var(--studio-border-strong)] px-3 text-xs text-[var(--studio-text-primary)] hover:bg-[var(--studio-hover)] focus-visible:outline focus-visible:outline-2 disabled:opacity-50">{busy === review.id ? t('working') : t('approve')}</button>
        <button disabled={busy !== null} onClick={() => void resolve(review.id, false)} type="button"
          className="min-h-9 rounded-lg border border-[var(--studio-border)] px-3 text-xs text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] disabled:opacity-50">{t('cancel')}</button>
      </div>}
    </article>)}
    {error && <p role="alert" className="text-xs text-[var(--studio-text-primary)]">{t('error')}</p>}
  </section>;
}
