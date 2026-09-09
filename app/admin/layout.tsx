import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import AdminShell from '@/src/components/admin/AdminShell';
import DocumentLocale from '@/src/components/DocumentLocale';
import { getOwnerAccess } from '@/lib/auth/owner';
import english from '@/messages/admin-en.json';
import french from '@/messages/admin-fr.json';
import arabic from '@/messages/admin-ar.json';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'VANTRA Admin',
  description: 'Private VANTRA owner operations dashboard.',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const preference = (await cookies()).get('vantra_locale')?.value;
  const locale = preference === 'fr' || preference === 'ar' ? preference : 'en';
  const access = await getOwnerAccess();
  if (!access.user) redirect(`/${locale}`);
  if (!access.isOwner) notFound();
  const messages = locale === 'fr' ? french : locale === 'ar' ? arabic : english;

  return (
    <div lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <DocumentLocale locale={locale} />
      <NextIntlClientProvider locale={locale} messages={messages}>
        <AdminShell>{children}</AdminShell>
      </NextIntlClientProvider>
    </div>
  );
}
