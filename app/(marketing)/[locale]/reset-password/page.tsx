import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import ResetPasswordForm from '../../../../src/components/auth/ResetPasswordForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return {
    title: t('newPasswordTitle'),
    description: t('newPasswordSubtitle'),
    alternates: { canonical: `/${locale}/reset-password` },
    robots: { index: false, follow: false },
  };
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
