import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ArtifactDocumentPreview from '@/src/components/studio/ArtifactDocumentPreview';
import { documentFromMarkdown } from './core';

test('preview renders English hierarchy and export actions from the artifact', () => {
  const artifact = documentFromMarkdown('first', '# Report\n\nA **bold** point.\n\n- One\n- Two', 'en');
  const html = renderToStaticMarkup(<ArtifactDocumentPreview artifact={artifact} locale="en" onClose={() => undefined} />);
  assert.match(html, /<article[^>]+lang="en"[^>]+dir="ltr"/);
  assert.match(html, /<h1[^>]*>Report<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /PDF \/ Print/);
});

test('preview preserves Arabic direction and mixed Arabic/Latin text', () => {
  const artifact = documentFromMarkdown('second', '# تقرير\n\nمرحبا VANTRA', 'ar');
  const html = renderToStaticMarkup(<ArtifactDocumentPreview artifact={artifact} locale="ar" onClose={() => undefined} />);
  assert.match(html, /<article[^>]+lang="ar"[^>]+dir="rtl"/);
  assert.match(html, /مرحبا VANTRA/);
  assert.match(html, /PDF \/ طباعة/);
});
