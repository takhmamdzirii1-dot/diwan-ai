'use client';

import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { supabase } from '@/src/lib/supabase/client';
import { VantraLogo, VantraWordmark } from '../VantraLogo';

export default function ResetPasswordForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t('passwordTooShort'));
      return;
    }
    if (password !== confirmation) {
      setError(t('passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setComplete(true);
    } catch {
      setError(t('invalidResetLink'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-20">
      <section className="w-full max-w-[440px] rounded-3xl border border-white/10 bg-[#0E1016] p-7 shadow-2xl sm:p-8" aria-labelledby="reset-password-title">
        <a href={`/${locale}`} className="mb-7 inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50" aria-label="VANTRA">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <VantraLogo tone="dark" className="h-6 w-6" />
          </span>
          <VantraWordmark tone="white" className="h-[13px] w-[76px]" />
        </a>

        <h1 id="reset-password-title" className="text-2xl font-semibold tracking-tight text-white">{t('newPasswordTitle')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{t('newPasswordSubtitle')}</p>

        {complete ? (
          <div className="mt-7 space-y-5">
            <p role="status" className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.05] p-4 text-sm text-white/80">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              {t('passwordUpdated')}
            </p>
            <button type="button" onClick={() => router.replace('/studio/chat')} className="vantra-btn-submit">
              {t('returnToStudio')}
              <ArrowRight className={`h-4 w-4 ${locale === 'ar' ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold text-white/80">{t('newPassword')}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35" aria-hidden="true" />
                <input id="new-password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-[14px] border border-white/12 bg-[#050608] ps-12 pe-4 text-sm text-white outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-white focus-visible:ring-1 focus-visible:ring-white motion-reduce:transition-none" />
              </div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-semibold text-white/80">{t('confirmPassword')}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35" aria-hidden="true" />
                <input id="confirm-password" type="password" required minLength={6} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-12 w-full rounded-[14px] border border-white/12 bg-[#050608] ps-12 pe-4 text-sm text-white outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-white focus-visible:ring-1 focus-visible:ring-white motion-reduce:transition-none" />
              </div>
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
            <button type="submit" disabled={loading} className="vantra-btn-submit">
              {loading ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : t('updatePassword')}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
