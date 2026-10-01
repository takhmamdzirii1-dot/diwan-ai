import { execFileSync } from 'node:child_process';
import { buildSync } from 'esbuild';
import { test, expect } from '@playwright/test';

const fixture = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', 'e2e/render-search-ui.tsx'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const hydration = buildSync({ stdin: { contents: `import React from 'react';
  import {hydrateRoot} from 'react-dom/client'; import ChatSources, {CitationGroup} from './src/components/studio/ChatSources';
  const section = document.querySelector('[data-chat-sources]');
  const holder = document.createElement('div'); section.replaceWith(holder); holder.append(section);
  hydrateRoot(holder, React.createElement(ChatSources,
    {annotation: ${JSON.stringify(fixture.annotation)}, locale: window.fixtureLocale}));
  for (const group of document.querySelectorAll('.chat-citation-group')) {
    const host = document.createElement('span'); group.replaceWith(host); host.append(group);
    hydrateRoot(host, React.createElement(CitationGroup,
      {sources: ${JSON.stringify(fixture.annotation.sources)}, registry: ${JSON.stringify(fixture.annotation.sources)}, locale: window.fixtureLocale}));
  }`,
  resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' }, tsconfig: 'tsconfig.json' }).outputFiles[0].text;
const documentBundle = buildSync({ stdin: { contents: `import React from 'react';
  import {createRoot} from 'react-dom/client'; import Preview from './src/components/studio/ArtifactDocumentPreview';
  const holder = document.createElement('div'); document.querySelector('#fixture').append(holder);
  createRoot(holder).render(React.createElement(Preview, {artifact: ${JSON.stringify(fixture.documents)}[window.fixtureLocale],
    locale: window.fixtureLocale, sources: ${JSON.stringify(fixture.annotation.sources)}, onClose: () => {}}));`,
  resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', outfile: 'document-fixture.js',
  define: { 'process.env.NODE_ENV': '"production"' }, tsconfig: 'tsconfig.json' }).outputFiles;

for (const width of [380, 1440]) for (const theme of ['neutral', 'oled', 'warm']) for (const language of ['en', 'ar'] as const) {
  test(`@search-ui ${language} ${theme} at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('https://www.google.com/s2/favicons?**', (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('/en', { waitUntil: 'networkidle' });
    await page.evaluate(({ markup, theme, language }) => {
      document.body.innerHTML = `<main id="fixture" class="studio-overlay-root" data-studio-theme="${theme}" style="width:100%;padding:16px;background:var(--studio-canvas)">${markup}</main>`;
      (window as unknown as { fixtureLocale: string }).fixtureLocale = language;
    }, { markup: fixture[language], theme, language });
    await page.addScriptTag({ content: hydration });
    // The surrounding message is an SSR fixture (not hydrated Framer Motion).
    // Finish its initial entrance state before visual/contrast assertions.
    await page.locator('#fixture [style]').evaluateAll((nodes) => nodes.forEach((node) => {
      const element = node as HTMLElement;
      if (element.style.opacity === '0') element.style.opacity = '1';
      if (element.style.transform) element.style.transform = 'none';
    }));
    await page.evaluate(() => document.fonts.ready);
    const text = page.locator('[data-chat-rendered-text]');
    const expected = language === 'ar' ? 'rtl' : 'ltr';
    expect(await text.evaluate((node) => getComputedStyle(node).direction)).toBe(expected);
    expect(await text.locator('li').first().evaluate((node) => getComputedStyle(node).direction)).toBe(expected);
    expect(await page.locator('[data-chat-sources]').evaluate((node) => getComputedStyle(node).direction)).toBe(expected);
    await expect(page.locator('.chat-citation')).toHaveCount(1);
    expect(await page.locator('.chat-citation').evaluate((node) => getComputedStyle(node).fontSize)).toBe('11px');
    await page.locator('.chat-citation button').click();
    await expect(page.locator('.chat-citation-popover a')).toHaveCount(7);
    await expect(page.locator('.chat-citation-popover a').first()).toHaveAttribute('href', fixture.annotation.sources[0].url);
    await page.locator('.chat-citation button').press('Escape');
    await expect(page.locator('.chat-citation-popover')).toHaveCount(0);
    await expect(text.locator('bdi').filter({ hasText: '$42' })).toHaveCount(1);
    expect(await page.locator('.chat-source-footer').evaluate((node) => (node as HTMLDetailsElement).open)).toBe(false);
    await page.locator('.chat-source-footer summary').click();
    await expect(page.locator('.chat-source-chips')).toHaveCount(0);
    await expect(page.locator('.chat-source-row')).toHaveCount(5);
    await page.locator('.chat-source-more').click();
    await expect(page.locator('.chat-source-row')).toHaveCount(7);
    await expect(page.locator('.chat-source-fallback').first()).toBeVisible();
    await expect(page.getByRole('button', { name: language === 'ar' ? 'فتح كمستند' : 'Open in document' })).toBeVisible();
    const metrics = await page.locator('#fixture').evaluate((root) => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = (values: number[]) => values.map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
        .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const background = lum(rgb(getComputedStyle(root).backgroundColor));
      const contrasts = [...root.querySelectorAll('.chat-message-action, time, .chat-source-chip')].map((node) => {
        const foreground = lum(rgb(getComputedStyle(node).color));
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      });
      return { overflow: root.scrollWidth > root.clientWidth + 1, contrasts,
        font: getComputedStyle(root.querySelector('[data-chat-rendered-text]')!).fontFamily };
    });
    expect(metrics.overflow).toBe(false); expect(metrics.contrasts.every((value) => value >= 4.5)).toBe(true);
    expect(metrics.font).toContain('IBM Plex Sans Arabic');
    await page.screenshot({ path: info.outputPath(`${language}-${theme}-380.png`), fullPage: true });
    await page.addStyleTag({ content: documentBundle.find((file) => file.path.endsWith('.css'))!.text });
    await page.addScriptTag({ content: documentBundle.find((file) => file.path.endsWith('.js'))!.text });
    const docDialog = page.getByRole('dialog');
    await expect(docDialog).toBeVisible();
    await expect(docDialog.locator('.chat-citation')).toHaveCount(2);
    expect(await docDialog.locator('article').evaluate((node) => getComputedStyle(node).userSelect)).toBe('text');
    expect(await docDialog.locator('li').first().evaluate((node) => getComputedStyle(node).direction)).toBe(expected);
    expect(await docDialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => { throw new Error('Fixture denial'); } } });
      Object.defineProperty(document, 'execCommand', { configurable: true, value: () => {
        const event = new ClipboardEvent('copy', { clipboardData: new DataTransfer() });
        document.dispatchEvent(event);
        (window as unknown as { copied: { plain: string; html: string } }).copied = {
          plain: event.clipboardData!.getData('text/plain'), html: event.clipboardData!.getData('text/html') };
        return true;
      } });
    });
    await docDialog.getByRole('button', { name: language === 'ar' ? 'نسخ' : 'Copy', exact: true }).click();
    await expect(docDialog.getByRole('button', { name: language === 'ar' ? 'تم النسخ' : 'Copied', exact: true })).toBeVisible();
    const copied = await page.evaluate(() => (window as unknown as { copied: { plain: string; html: string } }).copied);
    expect(copied.plain).not.toMatch(/\[1\]|source:S/);
    expect(copied.html).toContain(`dir="${expected}"`);
    const download = page.waitForEvent('download');
    await docDialog.getByRole('button', { name: 'TXT', exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.txt$/);
    await page.screenshot({ path: info.outputPath(`${language}-${theme}-document-380.png`), fullPage: true });
  });
}
