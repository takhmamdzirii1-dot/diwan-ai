'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type Review = { id: string; status: string; summary: string; arguments: Record<string, unknown>;
  expiresAt: string; result: { text: string } | null; resultUrl?: string | null; error?: string | null };

/** The model supplies only a reference; never approve a model-authored payload. */
export default function ConnectedReviewCard({ reviewId }: { reviewId: string }) {
  const t = useTranslations('studio.settings.connectedActionReviews');
  const locale = useLocale();
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/connected-apps/reviews?reviewId=${encodeURIComponent(reviewId)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('unavailable');
        const value = await response.json() as { reviews: Review[] };
        const owned = value.reviews.find(item => item.id === reviewId);
        if (!owned) throw new Error('unavailable');
        setReview(owned);
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [reviewId]);
  const resolve = async (approve: boolean) => {
    if (busy || review?.status !== 'pending') return;
    setBusy(true); setError(false);
    try {
      const response = await fetch('/api/connected-apps/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, approve }) });
      if (!response.ok) throw new Error('unavailable');
      // Reload the same owned snapshot, including a concurrent resolution from Settings.
      const latest = await fetch(`/api/connected-apps/reviews?reviewId=${encodeURIComponent(reviewId)}`, { cache: 'no-store' });
      if (!latest.ok) throw new Error('unavailable');
      const value = await latest.json() as { reviews: Review[] };
      setReview(value.reviews.find(item => item.id === reviewId) ?? null);
    } catch { setError(true); } finally { setBusy(false); }
  };
  const pending = review?.status === 'pending' && Date.parse(review.expiresAt) > Date.now();
  return <article data-connected-review={reviewId} aria-label={t('title')}
    className="my-3 w-full max-w-xl rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4 text-[var(--studio-text-primary)]">
    {review ? <>
      <h3 dir="auto" className="text-sm font-medium">{review.summary}</h3>
      <dl className="mt-3 space-y-2 text-xs select-text">{Object.entries(review.arguments).filter(([key]) => key !== 'operation').map(([key, value]) =>
        <div key={key}><dt dir="auto" className="text-[var(--studio-text-secondary)]">{key}</dt>
          <dd dir="auto" className="whitespace-pre-wrap break-words">{typeof value === 'string' ? value : JSON.stringify(value)}</dd></div>)}</dl>
      <p role="status" className="mt-3 text-xs">{t(['pending', 'executing', 'completed', 'failed', 'unknown', 'cancelled'].includes(review.status) ? review.status : 'notExecuted')}</p>
      {pending && <div className="mt-3 flex gap-2">{[true, false].map(approve => <button type="button" key={String(approve)} disabled={busy}
        onClick={() => void resolve(approve)} className="min-h-10 rounded-lg border border-[var(--studio-border)] px-4 text-xs hover:bg-[var(--studio-hover)] focus-visible:outline focus-visible:outline-2 disabled:opacity-50">
        {busy ? t('working') : t(approve ? 'approve' : 'cancel')}</button>)}</div>}
      {review.result && <p dir="auto" className="mt-2 text-xs select-text whitespace-pre-wrap">{review.result.text}</p>}
      {review.status === 'completed' && review.resultUrl && <a href={review.resultUrl} target="_blank" rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-[var(--studio-border)] px-3 text-xs underline">
        {locale.startsWith('ar') ? 'فتح' : locale.startsWith('fr') ? 'Ouvrir' : 'Open'}</a>}
    </> : !error && <p role="status" className="text-xs">{t('working')}</p>}
    {error && <p role="alert" className="mt-2 text-xs">{t('error')}</p>}
  </article>;
}
