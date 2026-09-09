import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import DocumentLocale from '@/src/components/DocumentLocale';
import RunwareProviderTest, { type ProviderTestCopy } from '@/src/components/internal/RunwareProviderTest';
import { VantraLogo } from '@/src/components/VantraLogo';
import { isOwnerUser } from '@/lib/auth/owner';
import { createClient } from '@/src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Provider Test — VANTRA',
  robots: { index: false, follow: false },
};

const COPY: Record<'en' | 'fr' | 'ar', ProviderTestCopy & { title: string; description: string; internal: string }> = {
  en: {
    title: 'Image provider test',
    description: 'Owner-only Runware connectivity and response test.',
    internal: 'Internal tool',
    provider: 'Provider',
    prompt: 'Prompt',
    promptPlaceholder: 'Describe one image to generate…',
    generate: 'Generate test image',
    generating: 'Generating…',
    result: 'Result',
    resultAlt: 'Runware provider test result',
    summary: 'Response summary',
    emptyTitle: 'No test result yet',
    emptyDescription: 'Run one controlled request to inspect the provider response.',
    genericError: 'The provider test failed. Check the server logs for the request details.',
  },
  fr: {
    title: 'Test du fournisseur d’images',
    description: 'Test privé de la connexion Runware et de sa réponse.',
    internal: 'Outil interne',
    provider: 'Fournisseur',
    prompt: 'Prompt',
    promptPlaceholder: 'Décrivez une image à générer…',
    generate: 'Générer l’image test',
    generating: 'Génération…',
    result: 'Résultat',
    resultAlt: 'Résultat du test Runware',
    summary: 'Résumé de la réponse',
    emptyTitle: 'Aucun résultat pour le moment',
    emptyDescription: 'Lancez une requête contrôlée pour examiner la réponse du fournisseur.',
    genericError: 'Le test a échoué. Consultez les journaux serveur pour les détails de la requête.',
  },
  ar: {
    title: 'اختبار مزوّد الصور',
    description: 'اختبار خاص بالمالك لاتصال Runware واستجابته.',
    internal: 'أداة داخلية',
    provider: 'المزوّد',
    prompt: 'الوصف',
    promptPlaceholder: 'صِف صورة واحدة لإنشائها…',
    generate: 'إنشاء صورة اختبارية',
    generating: 'جارٍ الإنشاء…',
    result: 'النتيجة',
    resultAlt: 'نتيجة اختبار Runware',
    summary: 'ملخص الاستجابة',
    emptyTitle: 'لا توجد نتيجة اختبار بعد',
    emptyDescription: 'نفّذ طلباً مضبوطاً لمراجعة استجابة المزوّد.',
    genericError: 'فشل اختبار المزوّد. راجع سجلات الخادم لمعرفة تفاصيل الطلب.',
  },
};

export default async function InternalProvidersPage() {
  const preference = (await cookies()).get('vantra_locale')?.value;
  const locale = preference === 'fr' || preference === 'ar' ? preference : 'en';
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) redirect(`/${locale}`);
  if (!isOwnerUser(data.user)) notFound();

  const copy = COPY[locale];

  return (
    <main
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="studio-overlay-root min-h-screen bg-[var(--studio-bg)] px-4 py-5 text-[var(--studio-text-primary)] sm:px-6 sm:py-7"
    >
      <DocumentLocale locale={locale} />
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-[1440px] flex-col sm:min-h-[calc(100dvh-3.5rem)]">
        <header className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--studio-border)] bg-white/[0.04]">
              <VantraLogo className="h-5 w-5" />
            </span>
            <div className="min-w-0 text-start">
              <p className="truncate text-[13px] font-semibold text-white">{copy.title}</p>
              <p className="truncate text-[11.5px] text-[var(--studio-text-muted)]">{copy.description}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-[var(--studio-border)] bg-white/[0.035] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
            {copy.internal}
          </span>
        </header>
        <RunwareProviderTest copy={copy} />
      </div>
    </main>
  );
}
