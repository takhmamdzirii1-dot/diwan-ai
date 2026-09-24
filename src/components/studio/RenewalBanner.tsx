'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarClock, X } from 'lucide-react';
import { trackFunnelEvent } from '@/src/lib/funnel-analytics';
import { renewalReminderState } from '@/lib/subscription/renewal';
import type { ModelPlanCode } from '@/lib/models/plan-entitlements';

const firedForEndsAt = new Set<string>();

/**
 * Slim, dismissible renewal reminder for active paid plans nearing expiry.
 * Derived from the exact subscription expiration timestamp. Fires
 * renewal_reminder_shown once per period; never mentions auto-renew.
 */
export default function RenewalBanner({ planCode, planEndsAt, onRenew }: {
  planCode: ModelPlanCode;
  planEndsAt: string | null;
  onRenew: () => void;
}) {
  const t = useTranslations('payments');
  const [dismissed, setDismissed] = useState<string | null>(null);
  const reminder = useMemo(
    () => renewalReminderState({ planCode, planEndsAt }),
    [planCode, planEndsAt]
  );
  const visible = reminder !== null && dismissed !== reminder.expiresAt;

  useEffect(() => {
    if (!visible || !reminder) return;
    if (firedForEndsAt.has(reminder.expiresAt)) return;
    firedForEndsAt.add(reminder.expiresAt);
    void trackFunnelEvent('renewal_reminder_shown', reminder.expiresAt, {
      kind: reminder.kind,
      daysLeft: reminder.daysLeft,
    });
  }, [visible, reminder]);

  if (!visible || !reminder) return null;
  const date = new Date(reminder.expiresAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
  return (
    <div role="status" className="pointer-events-auto mx-auto flex w-full max-w-4xl items-center gap-2.5 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3.5 py-2.5 text-start shadow-lg">
      <CalendarClock className="h-4 w-4 shrink-0 text-[var(--studio-text-secondary)]" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate text-[12px] text-[var(--studio-text-secondary)]">
        <button type="button" onClick={onRenew} className="font-semibold text-[var(--studio-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]">
          {t('renewNow')}
        </button>
        <span className="ms-1.5">{t('renewsOn', { date })}</span>
      </p>
      <button type="button" onClick={() => setDismissed(reminder.expiresAt)} aria-label={t('close')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--studio-text-muted)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
