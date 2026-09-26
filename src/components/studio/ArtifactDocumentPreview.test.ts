import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
import { documentFromMarkdown, documentToMarkdown, documentToText } from '@/lib/artifacts/core';

const css = readFileSync(new URL('./ArtifactDocumentPreview.module.css', import.meta.url), 'utf8');
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
