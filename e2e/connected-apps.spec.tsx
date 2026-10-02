import { buildSync } from 'esbuild';
import { test, expect } from '@playwright/test';

const bundle = buildSync({ stdin: { contents: `import React from 'react';
  import {createRoot} from 'react-dom/client'; import {NextIntlClientProvider} from 'next-intl';
  import Panel from './src/components/studio/ConnectedAppsPanel';
  import en from './messages/studio-en.json'; import fr from './messages/studio-fr.json'; import ar from './messages/studio-ar.json';
  createRoot(document.querySelector('#connector-fixture')).render(React.createElement(NextIntlClientProvider,
    {locale: window.fixtureLocale, messages: {en,fr,ar}[window.fixtureLocale], timeZone: 'UTC'}, React.createElement(Panel)));`,
  resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' }, tsconfig: 'tsconfig.json' }).outputFiles[0].text;

for (const language of ['en', 'fr', 'ar']) for (const width of [380, 1440]) {
  test(`@connectors fixture ${language} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.name));
    let disconnected = false; let deletions = 0; let approvals = 0;
    await page.route('**/api/connected-apps/reviews', async route => {
      if (route.request().method() === 'POST') {
        expect(route.request().postDataJSON()).toEqual({ reviewId: 'fixture-review', approve: true }); approvals++;
        await route.fulfill({ json: { status: 'completed', result: { text: 'Draft created; not sent.' } } }); return;
      }
      await route.fulfill({ json: { reviews: [{ id: 'fixture-review', appId: 'gmail', status: 'pending',
        summary: 'Gmail draft to recipient@example.com', arguments: { to: 'recipient@example.com', body: 'Exact reviewed body' },
        expiresAt: new Date(Date.now() + 600000).toISOString(), result: null }] } });
    });
    await page.route('**/api/connected-apps', async route => {
      if (route.request().method() === 'DELETE') {
        expect(route.request().postDataJSON()).toEqual({ appId: 'google_drive' });
        disconnected = true; deletions++;
        await route.fulfill({ json: { connection: null, revoked: false } }); return;
      }
      await route.fulfill({ json: { apps: [{ id: 'google_drive', name: 'Google Drive', authorization: 'oauth', canConnect: false,
        connection: disconnected ? null : { status: 'connected', scopes: [], expiresAt: null,
          account: { name: 'QA fixture', email: 'fixture@example.com' } } }] } });
    });
    await page.goto('/en');
    await page.evaluate(language => {
      document.body.innerHTML = `<main class="studio-overlay-root" data-studio-theme="neutral" dir="${language === 'ar' ? 'rtl' : 'ltr'}" style="padding:16px"><div id="connector-fixture"></div></main>`;
      (window as unknown as { fixtureLocale: string }).fixtureLocale = language;
    }, language);
    await page.addScriptTag({ content: bundle });
    await expect(page.getByText('fixture@example.com')).toBeVisible();
    await page.locator('details summary').click();
    await expect(page.getByText('Exact reviewed body', { exact: true })).toBeVisible();
    const approve = page.getByRole('button', { name: language === 'ar' ? 'الموافقة على هذا الإجراء المحدد'
      : language === 'fr' ? 'Approuver cette action exacte' : 'Approve this exact action', exact: true });
    await approve.click(); await expect(page.getByText('Draft created; not sent.', { exact: true })).toBeVisible();
    expect(approvals).toBe(1); await expect(approve).toHaveCount(0);
    const disconnect = page.getByRole('button', { name: language === 'ar' ? 'قطع الاتصال' : language === 'fr' ? 'Déconnecter' : 'Disconnect', exact: true });
    await expect(disconnect).toBeVisible();
    expect(await page.locator('#connector-fixture').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await disconnect.click();
    await expect(page.getByText('fixture@example.com')).toHaveCount(0);
    await expect(page.getByRole('status')).toBeVisible();
    expect(deletions).toBe(1); expect(errors).toEqual([]);
  });
}
