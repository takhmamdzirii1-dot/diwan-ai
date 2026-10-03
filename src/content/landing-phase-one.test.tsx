import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import GlobalPricing from '../components/GlobalPricing';
import Testimonials from '../components/landing/Testimonials';
import PartnersSection from '../components/landing/PartnersSection';
import GoProof from '../components/go/GoProof';
import { landingModelPresentation, type LandingCatalog } from './landing-catalog';
import { SITE_ORIGIN, SITE_LINKS } from './site';
import robots from '../../app/robots';
import sitemap from '../../app/sitemap';
import { paymentCopy } from '../components/landing/PaymentCopy';
import { createTranslator } from 'next-intl';

const plan = (planCode: string, priceDzd: number, unifiedCredits: number) => ({
  id: planCode, slug: planCode, planCode, name: planCode, description: null,
  kind: 'subscription' as const, priceDzd, unifiedCredits, active: planCode !== 'free',
  publicVisible: true, accessPeriodDays: planCode === 'free' ? null : 30, displayOrder: 0, featured: planCode === 'pro',
});
const catalog: LandingCatalog = {
  plans: [plan('free', 0, 0), plan('pro', 5000, 3000), plan('max', 10000, 7500), plan('lite', 2000, 850)],
  modelNames: ['GPT-5.6 Sol'], brands: [{ name: 'OpenAI', iconUrl: '/brand/models/openai.svg' }],
  proEstimates: { image: null, video: null }, gateways: { baridimob: true, ccp: true, edahabia: false, cib: false },
};

for (const locale of ['en', 'fr', 'ar']) {
  const messages = JSON.parse(fs.readFileSync(`messages/${locale}.json`, 'utf8'));
  const render = (children: React.ReactNode) => renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">{children}</NextIntlClientProvider>);
  test(`${locale}: pricing is in initial HTML, public-only, with manual payment and no placeholders`, () => {
    const html = render(<GlobalPricing catalog={catalog} onGetStarted={() => {}} />);
    assert.ok(html.includes('MAX'));
    for (const value of [5000, 10000, 3000, 7500]) assert.ok(html.includes(value.toLocaleString(locale)), `${value}`);
    assert.ok(!html.includes('Lite') && !html.includes('lite'));
    assert.ok(!html.includes('—') && !html.includes(messages.pricing.catalogPendingShort));
    assert.ok(html.includes('BaridiMob') && html.includes('CCP') && html.includes('Edahabia'));
    assert.ok(html.includes(messages.payment.period));
    assert.equal(messages.hero.microcopy.length, 4);
    assert.equal(messages.pricing.tiers[2].name, 'MAX');
    for (const key of ['studio', 'primaryLabel', 'languageLabel', 'openMenu', 'backToTop']) {
      assert.equal(typeof messages.navigation[key], 'string', `navigation.${key}`);
    }
    assert.equal(messages.why.features[0].title, messages.pricing.creditsIncluded);
  });
  test(`${locale}: no invented testimonials/footer links; both model strips use local enabled icons`, () => {
    assert.equal(render(<Testimonials />), '');
    // Next's Link requires the framework renderer; its actual HTML is checked in the deployment smoke.
    assert.deepEqual(SITE_LINKS, { status: null, social: null, support: null });
    const footer = fs.readFileSync('src/components/GlobalFooter.tsx', 'utf8');
    assert.ok(!footer.includes('https://x.com') && !footer.includes("href: '#'") && footer.includes('SITE_LINKS.support'));
    for (const html of [render(<PartnersSection brands={catalog.brands} />), render(<GoProof brands={catalog.brands} />)]) {
      assert.ok(html.includes('/brand/models/openai.svg') && !html.includes('unpkg'));
      assert.ok(html.includes(messages.partners.independent));
    }
  });
  test(`${locale}: card availability follows checkout flags`, () => {
    const t = createTranslator({ locale, messages, namespace: 'payment' });
    const pending = paymentCopy(t, catalog.gateways);
    const live = paymentCopy(t, { ...catalog.gateways, edahabia: true, cib: true });
    assert.ok(pending.includes(t('cardsSoon', { methods: 'Edahabia / CIB' })));
    assert.ok(live.includes(t('cardsLive', { methods: 'Edahabia / CIB' })));
    assert.ok(!live.includes(t('cardsSoon', { methods: 'Edahabia / CIB' })));
  });
}

test('model marketing excludes disabled, hidden and archived models and deduplicates enabled families', () => {
  const base = { displayName: 'GPT-5.6 Sol', modality: 'chat' as const, modelId: 'test', category: null,
    enabled: true, visibleInStudio: true, archived: false };
  const result = landingModelPresentation([base, base, { ...base, displayName: 'Claude Opus 5', enabled: false },
    { ...base, displayName: 'Hidden', visibleInStudio: false }, { ...base, displayName: 'Archived', archived: true }]);
  assert.deepEqual(result.modelNames, ['GPT-5.6 Sol']);
  assert.deepEqual(result.brands, [{ name: 'OpenAI', iconUrl: '/brand/models/openai.svg' }]);
  assert.ok(fs.existsSync(`public${result.brands[0].iconUrl}`));
});

test('one origin supplies sitemap/robots; paid acquisition pages stay out of sitemap', () => {
  assert.equal(SITE_ORIGIN, 'https://joinvantra.com');
  assert.equal(robots().sitemap, `${SITE_ORIGIN}/sitemap.xml`);
  assert.ok(sitemap().every((page) => page.url.startsWith(SITE_ORIGIN) && !page.url.includes('/go/')));
  for (const locale of ['en', 'fr', 'ar']) assert.ok(sitemap().some((page) => page.url === `${SITE_ORIGIN}/${locale}`));
  assert.ok(fs.readFileSync('app/(marketing)/[locale]/go/[variant]/page.tsx', 'utf8').includes('index: false, follow: true'));
  assert.ok(!fs.readFileSync('src/components/GlobalPricing.tsx', 'utf8').includes('fetch('));
});
