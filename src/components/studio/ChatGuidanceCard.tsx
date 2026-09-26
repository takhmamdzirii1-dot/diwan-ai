'use client';

import type { ChatGuidance, GuidanceAction } from '@/lib/chat/contextual-guidance';
import { guidanceActionLabel } from '@/lib/chat/contextual-guidance';

export default function ChatGuidanceCard({ guidance, locale, onAction }: {
  guidance: ChatGuidance; locale: string; onAction: (action: GuidanceAction) => void;
}) {
  return <div role={guidance.kind === 'recoverable_error' ? 'alert' : 'status'} dir={locale.startsWith('ar') ? 'rtl' : 'ltr'}
    className="rounded-xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] px-3 py-2.5 text-sm text-[var(--studio-text-primary)]">
    <p className="text-sm leading-relaxed text-[var(--studio-text-primary)]">{guidance.message}</p>
    {guidance.actions.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{guidance.actions.slice(0, 3).map((action) =>
      <button key={action} type="button" onClick={() => onAction(action)}
        className="rounded-lg border border-[var(--studio-border-strong)] px-2.5 py-1.5 text-xs font-medium text-[var(--studio-text-primary)] hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
        {guidanceActionLabel(action, locale)}
      </button>)}</div>}
  </div>;
}
