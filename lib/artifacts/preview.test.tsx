import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ArtifactDocumentPreview from '@/src/components/studio/ArtifactDocumentPreview';
import { documentFromMarkdown } from './core';

test('preview renders English hierarchy and export actions from the artifact', () => {
  const artifact = documentFromMarkdown('first', '# Report\n\nA **bold** point.\n\n- One\n- Two', 'en');
  const html = renderToStaticMarkup(<ArtifactDocumentPreview artifact={artifact} locale="en" onClose={() => undefined} />);
  assert.match(html, /<article[^>]+lang="en"[^>]+dir="auto"/);
  assert.match(html, /<h1[^>]*>Report<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /PDF \/ Print/);
});

test('preview keeps the shell fixed while Arabic content, lists and tables choose their own direction', () => {
  const artifact = documentFromMarkdown('second', '# تقرير\n\nمرحبا Node.js و OpenAI GPT-5.6\n\n- بند أول\n- بند ثان\n\n| اسم | إصدار |\n| --- | --- |\n| OpenAI | 5.6 |', 'ar');
  const html = renderToStaticMarkup(<ArtifactDocumentPreview artifact={artifact} locale="ar" onClose={() => undefined} />);
  assert.match(html, /<div[^>]+role="dialog"[^>]+dir="ltr"/);
  assert.match(html, /<article[^>]+lang="ar"[^>]+dir="auto"/);
  assert.match(html, /<h1[^>]+dir="auto"[^>]*>تقرير<\/h1>/);
  assert.match(html, /<ul[^>]+dir="rtl"[^>]*><li[^>]+dir="auto"/);
  assert.match(html, /<table[^>]+dir="rtl"/);
  assert.match(html, /مرحبا Node\.js و OpenAI GPT-5\.6/);
  assert.match(html, /PDF \/ طباعة/);
});
