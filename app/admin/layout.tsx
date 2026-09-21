import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import AdminShell from '@/src/components/admin/AdminShell';
import DocumentLocale from '@/src/components/DocumentLocale';
import { getOwnerAccess } from '@/lib/auth/owner';
import english from '@/messages/admin-en.json';

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
  const metadataName = typeof access.user.user_metadata?.full_name === 'string'
    ? access.user.user_metadata.full_name.trim() : '';
  const ownerName = metadataName || access.user.email?.split('@')[0] || 'VANTRA Admin';

  return (
    <div lang="en" dir="ltr">
      <DocumentLocale locale="en" />
      <NextIntlClientProvider locale="en" messages={english}>
        <AdminShell
          realtimeOwner={access.user.app_metadata?.role === 'owner'}
          ownerName={ownerName}
          ownerEmail={access.user.email ?? ''}
        >{children}</AdminShell>
      </NextIntlClientProvider>
    </div>
  );
}
