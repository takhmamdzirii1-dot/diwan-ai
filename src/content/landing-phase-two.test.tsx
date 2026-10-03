import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { ComparePlans, ProofSection, VariantContent, useLandingFaq } from '../components/landing/PhaseTwoSections';
import GlobalPricing from '../components/GlobalPricing';
import { landingCopy, LANDING_PROOF, CREATOR_SHOWCASE, MODEL_SCREENSHOTS, usableProof, usableAsset } from './landing-phase-two';
import { LANDING_PLAN_INTENT_KEY, saveLandingPlan, takeLandingPlan } from './landing-plan-intent';
import type { LandingCatalog } from './landing-catalog';

const plan = (planCode: string, unifiedCredits: number) => ({ id: planCode, slug: planCode, planCode, name: planCode,
  description: null, kind: 'subscription' as const, priceDzd: planCode === 'free' ? 0 : 5000,
  unifiedCredits, active: planCode !== 'free', displayOrder: 0, featured: planCode === 'pro', accessPeriodDays: planCode === 'free' ? null : 30, publicVisible: planCode !== 'lite' });
const catalog: LandingCatalog = { plans: [plan('free', 0), plan('pro', 3000), plan('max', 7500), plan('lite', 850)],
  modelNames: ['Enabled model A', 'Enabled model B'], brands: [], proEstimates: { image: null, video: null },
  gateways: { baridimob: true, ccp: true, edahabia: false, cib: false }, modelAccessCounts: { free: 2, pro: 4, max: 5 } };
function FaqFixture() { return <div>{useLandingFaq(catalog.gateways).map(item => <section key={item.question}><h3>{item.question}</h3><div>{item.answer}</div></section>)}</div>; }

for (const locale of ['en', 'fr', 'ar']) {
  const messages = JSON.parse(fs.readFileSync(`messages/${locale}.json`, 'utf8'));
  const copy = landingCopy(locale);
  const render = (children: React.ReactNode) => renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">{children}</NextIntlClientProvider>);
  test(`${locale}: three-column comparison uses catalog values, Chat tiers, no Lite or invented priority/rollover`, () => {
    const html = render(<ComparePlans catalog={catalog} />);
    for (const text of [...copy.rows, ...copy.chat, copy.more]) {
      assert.ok(html.includes(text), text);
    }
    assert.ok(html.includes((3000).toLocaleString(locale)) && html.includes((7500).toLocaleString(locale)));
    assert.ok(html.includes('grid-cols-3') && html.includes('hidden md:block'));
    assert.ok(!html.includes('Lite') && !html.includes('850') && !html.includes('priority'));
  });
  test(`${locale}: variants use real names, hide unconfigured media and reuse checkout activation wording`, () => {
    const modelHtml = render(<VariantContent variant="all-ai" catalog={catalog} />);
    assert.ok(modelHtml.includes('Enabled model A') && modelHtml.includes('Enabled model B'));
    assert.ok(modelHtml.includes(copy.demoNote) && !modelHtml.includes('<img'));
    const creatorHtml = render(<VariantContent variant="creators" catalog={catalog} />);
    for (const label of copy.creatorCases) assert.ok(creatorHtml.includes(label));
    assert.ok(!creatorHtml.includes('<img'));
    const paymentHtml = render(<VariantContent variant="ai-in-dzd" catalog={catalog} />);
    assert.ok(paymentHtml.includes(messages.payments.reviewedWithinHours));
    assert.equal((paymentHtml.match(/<li /g) ?? []).length, 3);
    assert.equal(render(<ProofSection index={0} />), '');
  });
  test(`${locale}: consistent paid/free CTAs, reassurance and factual FAQ order`, () => {
    const html = render(<GlobalPricing catalog={catalog} onGetStarted={() => {}} />);
    for (const label of [copy.start, copy.choosePro, copy.chooseMax]) assert.ok(html.includes(label));
    assert.equal((html.match(/data-pricing-reassurance/g) ?? []).length, 2);
    assert.ok(html.indexOf('data-plan-comparison') > html.indexOf(copy.chooseMax));
    const faq = render(<FaqFixture />);
    assert.ok(faq.indexOf(copy.faq[0]) < faq.indexOf(copy.faq[1]) && faq.indexOf(copy.faq[1]) < faq.indexOf(copy.faq[2]));
    assert.ok(faq.includes(`/${locale}/privacy`));
    assert.ok(!faq.includes(copy.faq[3]), 'Unconfigured support stays hidden');
  });
}

test('empty proof/showcase/screenshots are intentional; invalid external assets or absent consent fail closed', () => {
  assert.deepEqual([LANDING_PROOF.length, CREATOR_SHOWCASE.length, MODEL_SCREENSHOTS.length], [0, 0, 0]);
  assert.equal(usableAsset({ src: 'https://fake.example/image.png', width: 10, height: 10, caption: { en: 'a', fr: 'a', ar: 'a' } }), false);
  assert.equal(usableProof({ type: 'quote', asset: { en: 'a', fr: 'a', ar: 'a' }, caption: { en: 'a', fr: 'a', ar: 'a' }, date: 'invalid', consent: true }), false);
});
test('public plan intent survives auth navigation, expires, rejects malformed input and is consumed once', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  saveLandingPlan(storage, 'pro-plan-id', 100);
  assert.equal(takeLandingPlan(storage, 101), 'pro-plan-id');
  assert.equal(takeLandingPlan(storage, 102), null);
  saveLandingPlan(storage, 'max-plan-id', 100);
  assert.equal(takeLandingPlan(storage, 100 + 31 * 60 * 1000), null);
  storage.setItem(LANDING_PLAN_INTENT_KEY, '{bad');
  assert.equal(takeLandingPlan(storage), null);
  saveLandingPlan(storage, '<script>', 100);
  assert.equal(takeLandingPlan(storage, 101), null);
});
test('/go has compact header and legal-only footer; payment process renders before pricing', () => {
  const go = fs.readFileSync('src/components/go/GoLanding.tsx', 'utf8');
  assert.ok(go.includes('<GlobalFooter legalOnly') && go.includes('compact') && !go.includes('navLinks='));
  const pricing = go.slice(go.indexOf('    pricing:'), go.indexOf('    trust:'));
  assert.ok(pricing.indexOf('ai-in-dzd') < pricing.indexOf('<GlobalPricing'));
  const context = fs.readFileSync('src/context/ModalContext.tsx', 'utf8');
  assert.ok(context.includes("pathname?.startsWith('/studio/')") && context.includes('openTopUpModal({ id: planId })'));
  for (const file of ['src/components/go/GoLanding.tsx', 'src/components/OriginalLandingPage.tsx']) {
    assert.ok(fs.readFileSync(file, 'utf8').includes('openPlanSignup(planId)'));
  }
});
