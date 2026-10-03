'use client';

import { LogoCloud } from '@/components/ui/logo-cloud-3';
import { useTranslations } from 'next-intl';

import type { LandingBrand } from '@/src/content/landing-catalog';

export default function PartnersSection({ brands }: { brands: LandingBrand[] }) {
  const t = useTranslations('partners');

  if (!brands.length) return null;
  const logos = brands.map((brand) => ({ name: brand.name, alt: brand.name, src: brand.iconUrl }));
  return (
    <section
      id="models"
      aria-label={t('aria')}
      className='relative -mt-[180px] !py-9 md:!py-10 border-b border-white/[0.04] overflow-hidden'
    >
      <p className='text-center text-[10.5px] font-semibold tracking-[0.22em] uppercase text-white/35 mb-5 md:mb-6'>
        {t('label')}
      </p>
      <LogoCloud logos={logos} />
      <p className="mt-5 px-6 text-center text-xs leading-relaxed text-white/55">{t('independent')}</p>
    </section>
  );
}
