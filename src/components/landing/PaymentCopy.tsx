'use client';
import { useTranslations } from 'next-intl';
import type { GatewayAvailability } from '@/src/content/landing-catalog';

export function paymentCopy(t: ReturnType<typeof useTranslations>, gateways: GatewayAvailability) {
  const manual = [gateways.baridimob && 'BaridiMob', gateways.ccp && 'CCP'].filter(Boolean).join(' / ');
  const liveCards = [gateways.edahabia && 'Edahabia', gateways.cib && 'CIB'].filter(Boolean).join(' / ');
  const pendingCards = [!gateways.edahabia && 'Edahabia', !gateways.cib && 'CIB'].filter(Boolean).join(' / ');
  return [manual ? t('manual', { methods: manual }) : t('manualUnavailable'),
    liveCards && t('cardsLive', { methods: liveCards }),
    pendingCards && t('cardsSoon', { methods: pendingCards })].filter(Boolean).join(' ');
}
