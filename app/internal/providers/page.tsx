import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getOwnerAccess } from '@/lib/auth/owner';

export const dynamic = 'force-dynamic';

export default async function InternalProvidersPage() {
  const preference = (await cookies()).get('vantra_locale')?.value;
  const locale = preference === 'fr' || preference === 'ar' ? preference : 'en';
  const access = await getOwnerAccess();
  if (!access.user) redirect(`/${locale}`);
  if (!access.isOwner) notFound();
  redirect('/admin/providers');
}
