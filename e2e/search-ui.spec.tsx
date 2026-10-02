import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import JSZip from 'jszip';
import { test, expect } from '@playwright/test';

const fixture = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', 'e2e/render-search-ui.tsx'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const bundle = buildSync({ stdin: { contents: `import React from 'react';
  import {createRoot} from 'react-dom/client'; import {NextIntlClientProvider} from 'next-intl';
  import MessageBubble from './src/components/studio/MessageBubble';
  import en from './messages/studio-en.json'; import fr from './messages/studio-fr.json'; import ar from './messages/studio-ar.json';
  const root = createRoot(document.querySelector('#chat-fixture'));
  window.showSearch = (streaming = false) => root.render(React.createElement(NextIntlClientProvider,
    {locale: window.fixtureLocale, messages: {en,fr,ar}[window.fixtureLocale], timeZone: 'UTC'},
    React.createElement(MessageBubble, {message: ${JSON.stringify(fixture.turns)}[window.fixtureLocale], isLatest:true,
      isStreaming:streaming, isThinking:streaming})));
  window.showSearch();`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'browser', outfile: 'search-fixture.js',
  define: { 'process.env.NODE_ENV': '"production"' }, tsconfig: 'tsconfig.json' }).outputFiles;

for (const width of [380, 1440]) for (const theme of ['neutral', 'oled', 'warm']) for (const language of ['en', 'fr', 'ar']) {
  test(`@search-ui ${language} ${theme} at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.name));
    await page.route('https://www.google.com/s2/favicons?**', route => route.fulfill({ status: 404, body: '' }));
    await page.goto('/en', { waitUntil: 'networkidle' });
    await page.evaluate(({ theme, language }) => {
      document.body.innerHTML = `<main id="fixture" class="studio-overlay-root" data-studio-theme="${theme}" style="width:100%;padding:16px;background:var(--studio-canvas)"><div id="chat-fixture"></div></main>`;
      (window as any).fixtureLocale = language;
      (window as any).clipboard = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async (items: ClipboardItem[]) => {
        const item = items[0]; (window as any).clipboard.push({ plain: await (await item.getType('text/plain')).text(),
          html: await (await item.getType('text/html')).text() });
      } } });
    }, { theme, language });
    await page.addStyleTag({ content: bundle.find(file => file.path.endsWith('.css'))!.text });
    await page.addScriptTag({ content: bundle.find(file => file.path.endsWith('.js'))!.text });
    const text = page.locator('[data-chat-rendered-text]');
    await expect(text).toBeVisible();
    const expectedDirection = language === 'ar' ? 'rtl' : 'ltr';
    expect(await text.evaluate(node => getComputedStyle(node).direction)).toBe(expectedDirection);
    expect(await text.locator('li').first().evaluate(node => getComputedStyle(node).direction)).toBe(expectedDirection);
    expect(await page.locator('[data-chat-sources]').evaluate(node => getComputedStyle(node).direction)).toBe(expectedDirection);
    expect(await page.locator('[data-chat-sources]').evaluate(node => getComputedStyle(node).textAlign)).toBe('start');
    await expect(page.locator('.chat-source-chip, .chat-source-row, .chat-citation')).toHaveCount(0);
    const bubble = text.locator('.chat-source-bubble').first();
    await expect(bubble).toHaveAttribute('data-label', 'source1');
    await expect(bubble).toHaveAttribute('data-more', '+6');
    expect(await bubble.evaluate(node => node.textContent)).toBe('S'); // favicon fallback only, label is CSS
    expect((await bubble.boundingBox())!.height).toBeCloseTo(44, 2);
    expect(await bubble.evaluate(node => getComputedStyle(node, '::before').height)).toBe('22px');
    await bubble.click();
    const card = page.locator('.chat-source-card');
    await expect(card.getByRole('link')).toHaveCount(7);
    await expect(card.getByRole('link').first()).toHaveAttribute('href', fixture.annotation.sources[0].url);
    expect(await card.evaluate(node => getComputedStyle(node).userSelect)).toBe('text');
    if (width === 380) expect(await card.evaluate(node => Math.round(node.getBoundingClientRect().bottom))).toBe(900);
    await page.keyboard.press('Escape'); await expect(card).toHaveCount(0);
    await expect(bubble).toBeFocused();

    // Native select-all copy must omit fallback letters and all source labels.
    const selectionCopy = await text.evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
      const event = new ClipboardEvent('copy', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true });
      document.dispatchEvent(event); selection.removeAllRanges(); return event.clipboardData!.getData('text/plain');
    });
    expect(selectionCopy).toContain('$42'); expect(selectionCopy).not.toMatch(/source\d|Sources|المصادر|\[\[source:|\[S\d+\]/);
    const copyLabel = language === 'ar' ? 'نسخ الإجابة' : language === 'fr' ? 'Copier la réponse' : 'Copy response';
    await page.getByRole('button', { name: copyLabel, exact: true }).click();
    const copied = await page.evaluate(() => (window as any).clipboard.at(-1));
    expect(copied.plain).toContain('$42'); expect(copied.plain).not.toMatch(/source\d|\[\[source:|\[S\d+\]/);

    const metrics = await page.locator('#fixture').evaluate(root => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = (values: number[]) => values.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
        .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const background = lum(rgb(getComputedStyle(root.querySelector('.chat-source-bubble')!, '::before').backgroundColor));
      const foreground = lum(rgb(getComputedStyle(root.querySelector('.chat-source-bubble')!).color));
      return { overflow: root.scrollWidth > root.clientWidth + 1,
        contrast: (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05) };
    });
    expect(metrics.overflow).toBe(false); expect(metrics.contrast).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: info.outputPath(`${language}-${theme}-${width}.png`), fullPage: true });
    const open = language === 'ar' ? 'فتح كمستند' : language === 'fr' ? 'Ouvrir en document' : 'Open in document';
    await page.getByRole('button', { name: open, exact: true }).click();
    const docDialog = page.getByRole('dialog'); await expect(docDialog).toBeVisible();
    await expect(docDialog.locator('[data-source-bubble]')).toHaveCount(0);
    for (const format of ['TXT', 'Markdown', 'Word']) {
      const pending = page.waitForEvent('download');
      await docDialog.getByRole('button', { name: format, exact: true }).click();
      const download = await pending; const bytes = readFileSync((await download.path())!);
      const exported = format === 'Word' ? await (await JSZip.loadAsync(bytes)).file('word/document.xml')!.async('string') : bytes.toString('utf8');
      expect(exported).toContain('$42'); expect(exported).not.toMatch(/source\d|source:S|\[S\d+\]|chat-source-bubble/);
    }
    await docDialog.getByRole('button', { name: language === 'ar' ? 'إغلاق' : language === 'fr' ? 'Fermer' : 'Close', exact: true }).click();
    await page.evaluate(() => (window as any).showSearch(true));
    await expect(page.getByRole('status')).toContainText(language === 'ar' ? 'جارٍ البحث' : language === 'fr' ? 'Recherche' : 'Searching');
    await expect(page.locator('[data-chat-rendered-text], [data-source-bubble]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
