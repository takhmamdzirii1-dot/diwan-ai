import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
import { documentFromMarkdown, documentToMarkdown, documentToText } from '@/lib/artifacts/core';

const css = readFileSync(new URL('./ArtifactDocumentPreview.module.css', import.meta.url), 'utf8');
const printCss = readFileSync(new URL('../../../app/globals.css', import.meta.url), 'utf8');
const previewSource = readFileSync(new URL('./ArtifactDocumentPreview.tsx', import.meta.url), 'utf8');
const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find((path): path is string => Boolean(path && existsSync(path)));

test('paper typography stays readable under dark Studio styles and in print', { skip: !executablePath }, async () => {
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>${css}</style>
      <style>:root { --text: #fff; --muted: #eee; } .prose-invert { color: #fff; }
        h1, p, li, td, th { color: #fff; }</style>
      <div class="prose-invert"><article class="paper" dir="rtl" lang="ar">
        <h1>عنوان</h1><p>نص</p><ul><li>بند</li></ul>
        <table><tbody><tr><th>رأس</th><td>قيمة</td></tr></tbody></table>
        <a href="#">رابط</a><code>رمز</code>
      </article></div>`);
    const colors = await page.evaluate(() => {
      const paper = document.querySelector('article')!;
      return {
        paper: getComputedStyle(paper).backgroundColor,
        body: getComputedStyle(document.querySelector('p')!).color,
        heading: getComputedStyle(document.querySelector('h1')!).color,
        bullet: getComputedStyle(document.querySelector('li')!).color,
        header: getComputedStyle(document.querySelector('th')!).color,
        cell: getComputedStyle(document.querySelector('td')!).color,
        link: getComputedStyle(document.querySelector('a')!).color,
        code: getComputedStyle(document.querySelector('code')!).color,
        border: getComputedStyle(document.querySelector('td')!).borderColor,
        selection: getComputedStyle(document.querySelector('p')!, '::selection').color,
        direction: getComputedStyle(paper).direction,
      };
    });
    assert.equal(colors.paper, 'rgb(255, 255, 255)');
    for (const key of ['body', 'heading', 'bullet', 'header', 'cell', 'code', 'selection'] as const) {
      assert.equal(colors[key], 'rgb(23, 23, 23)', key);
    }
    assert.equal(colors.link, 'rgb(29, 78, 216)');
    assert.equal(colors.border, 'rgb(212, 212, 212)');
    assert.equal(colors.direction, 'rtl');
    await page.emulateMediaType('print');
    assert.deepEqual(await page.evaluate(() => {
      const paper = document.querySelector('article')!;
      return [getComputedStyle(paper).backgroundColor, getComputedStyle(document.querySelector('p')!).color];
    }), ['rgb(255, 255, 255)', 'rgb(23, 23, 23)']);
  } finally {
    await browser.close();
  }
});

test('document actions preserve content and Word export loads only on export', () => {
  const artifact = documentFromMarkdown('doc', '# Title\n\nParagraph.\n\n- First\n- Second', 'en');
  const arabic = documentFromMarkdown('arabic', '# عنوان\n\nنص عربي', 'ar');
  assert.match(documentToText(artifact), /Paragraph/);
  assert.match(documentToMarkdown(artifact), /- First/);
  assert.equal(arabic.direction, 'rtl');
  assert.match(previewSource, /onClick=\{\(\) => window\.print\(\)\}/);
  assert.match(previewSource, /const exportWord = async \(\) => \{[\s\S]*?await import\('@\/lib\/artifacts\/docx-export'\)/);
  assert.doesNotMatch(previewSource, /^import .*docx-export/m);
});

test('document preview keeps action placement fixed and gives each content block natural direction', { skip: !executablePath }, async () => {
  assert.match(previewSource, /data-vantra-print-document=\{inline \? undefined : ''\}[\s\S]*?dir="ltr"/);
  assert.match(previewSource, /<article lang=\{artifact\.language\} dir="auto"/);
  assert.match(previewSource, /<List key=\{index\} dir=\{artifact\.direction\}/);
  assert.match(previewSource, /<table dir=\{artifact\.direction\}/);
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>${css}</style><div id="shell" dir="ltr">
      <div id="actions">Export <button>Close</button></div>
      <article class="paper" dir="auto" lang="ar">
        <h1 dir="auto">تقرير OpenAI 5.6</h1>
        <p dir="auto">نتائج Node.js و GPT-5.6 و 123 <a href="https://nodejs.org/">nodejs.org</a></p>
        <p dir="auto">English first ثم العربية</p>
        <ul dir="rtl" style="padding-inline-start:28px"><li dir="auto">البند الأول</li><li dir="auto">البند الثاني</li></ul>
        <table dir="rtl"><tbody><tr><td dir="auto">اسم</td><td dir="auto">OpenAI</td></tr></tbody></table>
        <pre>const model = "GPT-5.6";</pre>
      </article></div>`);
    const directions = await page.evaluate(() => ({
      shell: getComputedStyle(document.querySelector('#shell')!).direction,
      actions: getComputedStyle(document.querySelector('#actions')!).direction,
      arabic: getComputedStyle(document.querySelectorAll('p')[0]).direction,
      english: getComputedStyle(document.querySelectorAll('p')[1]).direction,
      list: getComputedStyle(document.querySelector('ul')!).direction,
      item: getComputedStyle(document.querySelector('li')!).direction,
      table: getComputedStyle(document.querySelector('table')!).direction,
      latinCell: getComputedStyle(document.querySelectorAll('td')[1]).direction,
      code: getComputedStyle(document.querySelector('pre')!).direction,
    }));
    assert.deepEqual(directions, { shell: 'ltr', actions: 'ltr', arabic: 'rtl', english: 'ltr',
      list: 'rtl', item: 'rtl', table: 'rtl', latinCell: 'ltr', code: 'ltr' });
  } finally { await browser.close(); }
});

test('printing an open document excludes Studio chrome and preserves RTL content', { skip: !executablePath }, async () => {
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>${css}\n${printCss}</style><aside id="sidebar">Sidebar</aside>
      <main class="studio"><div id="other-message">Other chat message</div>
        <div data-vantra-print-document dir="rtl"><div class="document-inner">
          <div id="actions" data-vantra-document-actions>PDF / Print <button>Close</button></div>
          <article class="paper" dir="rtl" lang="ar"><h1>تقرير</h1><p>نص عربي</p>
            <ul><li>بند</li></ul><table><tbody><tr><td>قيمة</td></tr></tbody></table>
          </article></div></div><div id="composer">Chat composer</div></main>`);
    await page.emulateMediaType('print');
    const result = await page.evaluate(() => {
      return {
        hidden: ['#sidebar', '#other-message', '#composer', '#actions'].map((selector) => getComputedStyle(document.querySelector(selector)!).display),
        paper: getComputedStyle(document.querySelector('article')!).backgroundColor,
        text: getComputedStyle(document.querySelector('p')!).color,
        direction: getComputedStyle(document.querySelector('article')!).direction,
        heading: getComputedStyle(document.querySelector('h1')!).display,
        root: getComputedStyle(document.querySelector('[data-vantra-print-document]')!).display,
      };
    });
    assert.deepEqual(result.hidden, ['none', 'none', 'none', 'none']);
    assert.equal(result.root, 'block');
    assert.equal(result.heading, 'block');
    assert.equal(result.paper, 'rgb(255, 255, 255)');
    assert.equal(result.text, 'rgb(23, 23, 23)');
    assert.equal(result.direction, 'rtl');
  } finally { await browser.close(); }
});
