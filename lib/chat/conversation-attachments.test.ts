import assert from 'node:assert/strict';
import test from 'node:test';
import type { SpreadsheetArtifact } from '@/lib/artifacts/core';
import { chatRequestMessages } from './message-history';
import { attachConversationFile, attachedSpreadsheet, attachmentRequestContext, parseConversationAttachments, uploadFileKind } from './conversation-attachments';

const spreadsheet: SpreadsheetArtifact = {
  schemaVersion: 1, id: 'sheet-1', type: 'spreadsheet', title: 'sales', language: 'en', direction: 'ltr', metadata: {},
  sheets: [{ id: 'tab-1', name: 'Sheet1', columns: ['A', 'B'], rows: [['Month', 'Sales'], ['Jan', 20]] }],
};

test('one file chooser routes existing supported types and rejects unsupported types', () => {
  for (const name of ['sales.xlsx', 'sales.csv']) assert.equal(uploadFileKind({ name, type: '' }), 'spreadsheet');
  for (const name of ['report.pdf', 'report.docx']) assert.equal(uploadFileKind({ name, type: '' }), 'file');
  for (const name of ['notes.txt', 'notes.md', 'data.json']) assert.equal(uploadFileKind({ name, type: '' }), 'document');
  assert.equal(uploadFileKind({ name: 'picture.png', type: 'image/png' }), 'image');
  assert.equal(uploadFileKind({ name: 'program.exe', type: '' }), null);
});

test('one conversation attachment keeps the same parsed spreadsheet for all actions', () => {
  const first = attachConversationFile([], { kind: 'spreadsheet', name: 'sales.xlsx', artifact: spreadsheet });
  const second = attachConversationFile(first, { kind: 'spreadsheet', name: 'sales.xlsx', artifact: spreadsheet });
  assert.equal(second.length, 1);
  assert.equal(attachedSpreadsheet(second), spreadsheet);
  assert.deepEqual(parseConversationAttachments(JSON.stringify(second)), second);
  assert.equal(attachmentRequestContext(second).spreadsheetContext, attachmentRequestContext(second, spreadsheet).spreadsheetContext);
  assert.equal(second.filter((item) => item.name !== 'sales.xlsx').length, 0);
  assert.equal(attachedSpreadsheet(second.filter((item) => item.name !== 'sales.xlsx')), null);
});

test('bounded spreadsheet rows travel in internal request context, not visible Chat text', () => {
  const attached = attachConversationFile([], { kind: 'spreadsheet', name: 'sales.xlsx', artifact: spreadsheet });
  const visible = chatRequestMessages([{ role: 'user', content: 'Create a presentation from this spreadsheet.' }]);
  const internal = attachmentRequestContext(attached);
  assert.equal(visible[0].content, 'Create a presentation from this spreadsheet.');
  assert.doesNotMatch(visible[0].content, /Jan|Month|Sales/);
  assert.match(internal.spreadsheetContext ?? '', /Jan/);
  assert.ok((internal.spreadsheetContext ?? '').length <= 12_000);
});
