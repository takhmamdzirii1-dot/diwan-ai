import { buildSync } from 'esbuild';
import { test, expect } from '@playwright/test';

const bundle = buildSync({ stdin: { contents: `import React from 'react';
import {createRoot} from 'react-dom/client'; import {NextIntlClientProvider} from 'next-intl';
import Card from './src/components/studio/ConnectedReviewCard';
import en from './messages/studio-en.json'; import fr from './messages/studio-fr.json'; import ar from './messages/studio-ar.json';
createRoot(document.querySelector('#review-fixture')).render(React.createElement(NextIntlClientProvider,
{locale: window.fixtureLocale, messages: {en,fr,ar}[window.fixtureLocale], timeZone:'UTC'},
React.createElement(Card,{reviewId:'00000000-0000-4000-8000-000000000001'})));`,
resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser',
define: { 'process.env.NODE_ENV': '"production"' }, tsconfig: 'tsconfig.json' }).outputFiles[0].text;

for (const language of ['en', 'fr', 'ar']) test(`inline exact review ${language} at 380px executes once and reloads server result`, async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 900 });
  let approvals = 0; let status = 'pending';
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.name));
  await page.route('**/api/connected-apps/reviews**', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ reviewId: '00000000-0000-4000-8000-000000000001', approve: true });
      approvals++; status = 'completed'; await route.fulfill({ json: { status } }); return;
    }
    await route.fulfill({ json: { reviews: [{ id: '00000000-0000-4000-8000-000000000001', status,
      summary: 'Create spreadsheet: VANTRA Verification Sheet', arguments: { title: 'VANTRA Verification Sheet', rows: [['Status', 'Connected']] },
      expiresAt: new Date(Date.now() + 600000).toISOString(), result: status === 'completed' ? { text: 'Spreadsheet created' } : null,
      resultUrl: status === 'completed' ? 'https://docs.google.com/spreadsheets/d/fixture-created-123/edit' : null }] } });
  });
  await page.goto('/en');
  await page.evaluate(language => {
    document.body.innerHTML = `<main class="studio-overlay-root" dir="${language === 'ar' ? 'rtl' : 'ltr'}" style="padding:16px"><div id="review-fixture"></div></main>`;
    (window as unknown as { fixtureLocale: string }).fixtureLocale = language;
  }, language);
  await page.addScriptTag({ content: bundle });
  await expect(page.getByText('[["Status","Connected"]]', { exact: true })).toBeVisible();
  const approve = page.getByRole('button', { name: language === 'ar' ? 'الموافقة على هذا الإجراء المحدد' : language === 'fr' ? 'Approuver cette action exacte' : 'Approve this exact action', exact: true });
  await approve.click();
  await expect(page.getByText('Spreadsheet created', { exact: true })).toBeVisible();
  await expect(approve).toHaveCount(0);
  await expect(page.getByRole('link')).toHaveAttribute('href', 'https://docs.google.com/spreadsheets/d/fixture-created-123/edit');
  expect(approvals).toBe(1); expect(errors).toEqual([]);
  expect(await page.locator('#review-fixture').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});
