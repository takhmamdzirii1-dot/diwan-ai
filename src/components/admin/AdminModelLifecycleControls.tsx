'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminModelLifecycleControls({ modelKey, archived }: { modelKey: string; archived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const run = async (action: 'archive' | 'delete') => {
    setBusy(true); setFeedback(null);
    try {
      const response = await fetch('/api/admin/models', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ modelKey, action }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'MODEL_LIFECYCLE_UPDATE_FAILED');
      setFeedback(`Model ${action}d.`); router.refresh();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'MODEL_LIFECYCLE_UPDATE_FAILED';
      setFeedback(({
        MODEL_REFERENCED_ARCHIVE_REQUIRED: 'This model has routes or history. Archive it instead.',
        MODEL_CODE_REGISTERED_ARCHIVE_REQUIRED: 'Built-in models cannot be deleted. Archive it instead.',
        MODEL_LIFECYCLE_UPDATE_FAILED: 'The model lifecycle change could not be saved.',
      } as Record<string, string>)[code] ?? code);
    }
    finally { setBusy(false); }
  };
  return <div className="mt-3 grid gap-2 rounded-lg border border-[var(--studio-border-subtle)] p-3 sm:grid-cols-2"><button type="button" disabled={busy || archived} onClick={() => run('archive')} className="h-9 rounded-lg border border-amber-300/25 px-3 text-[11.5px] font-semibold text-amber-100 disabled:opacity-45">Archive</button><button type="button" disabled={busy} onClick={() => run('delete')} className="h-9 rounded-lg border border-red-300/25 px-3 text-[11.5px] font-semibold text-red-100 disabled:opacity-45">Delete if unused</button>{feedback && <p role="status" className="text-[11px] text-[var(--studio-text-secondary)] sm:col-span-2">{feedback}</p>}</div>;
}
