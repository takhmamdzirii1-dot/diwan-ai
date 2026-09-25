import assert from 'node:assert/strict';
import test from 'node:test';
import { documentFromMarkdown, documentToMarkdown, documentToText } from './core';
import { documentToDocx } from './docx-export';

test('English and Arabic documents normalize headings, lists, tables and direction', () => {
  const english = documentFromMarkdown('msg-1', '# Report\n\nA **strong** paragraph.\n\n- One\n- Two\n\n| A | B |\n|---|---|\n| 1 | 2 |', 'en');
  assert.equal(english.direction, 'ltr');
  assert.equal(english.title, 'Report');
  assert.deepEqual(english.blocks.map((block) => block.kind), ['heading', 'paragraph', 'list', 'table']);
  assert.match(documentToText(english), /A strong paragraph/);
  assert.match(documentToMarkdown(english), /\| A \| B \|/);
  const arabic = documentFromMarkdown('msg-2', '# تقرير\n\nMixed العربية and Latin text.', 'ar');
  assert.equal(arabic.direction, 'rtl');
  assert.equal(arabic.blocks[1].kind, 'paragraph');
  assert.match(documentToText(arabic), /العربية and Latin/);
});

test('Word export generates a DOCX entirely from local artifact data', async () => {
  const artifact = documentFromMarkdown('msg-3', '# تقرير\n\nمرحبا VANTRA\n\n1. أولاً\n2. ثانياً', 'ar');
  const blob = await documentToDocx(artifact);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.ok(blob.size > 1000);
  assert.equal((await blob.slice(0, 2).text()), 'PK');
});
