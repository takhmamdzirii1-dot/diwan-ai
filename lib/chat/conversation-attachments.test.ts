import assert from 'node:assert/strict';
import test from 'node:test';
import type { SpreadsheetArtifact } from '@/lib/artifacts/core';
import { chatRequestMessages } from './message-history';
import { attachConversationFile, AttachmentActionGate, attachedSpreadsheet, attachmentRequestContext, getConversationAttachment,
  getConversationAttachments, getCurrentSpreadsheetAttachment, parseConversationAttachments, uploadFileKind } from './conversation-attachments';

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

test('visible chip, Agent, Analyze, Chart and Presentation resolve the same bound artifact', () => {
  const attached = attachConversationFile([], { kind: 'spreadsheet', name: 'Products.xlsx', artifact: spreadsheet }, 'chat-a');
  const store = { 'chat-a': attached };
  const chip = getConversationAttachments(store, 'chat-a')[0];
  assert.ok(chip.attachmentId);
  assert.equal(chip.conversationId, 'chat-a');
  for (const action of ['agent', 'analyze', 'chart', 'presentation']) {
    assert.equal(getConversationAttachment(store, 'chat-a', chip.attachmentId)?.kind, 'spreadsheet', action);
    assert.equal(getCurrentSpreadsheetAttachment(store, 'chat-a')?.artifact, spreadsheet, action);
  }
  assert.equal(getCurrentSpreadsheetAttachment(store, 'chat-b'), null);
  assert.equal(getConversationAttachment(store, 'chat-b', chip.attachmentId), null);
  assert.deepEqual(parseConversationAttachments(JSON.stringify(attached), 'chat-a'), attached);
});

test('filename is not attachment identity and detaching one chip preserves the other', () => {
  const secondArtifact = { ...spreadsheet, id: 'sheet-2' };
  const first = attachConversationFile([], { kind: 'spreadsheet', name: 'Products.xlsx', artifact: spreadsheet }, 'chat-a');
  const both = attachConversationFile(first, { kind: 'spreadsheet', name: 'Products.xlsx', artifact: secondArtifact }, 'chat-a');
  assert.equal(both.length, 2);
  assert.notEqual(both[0].attachmentId, both[1].attachmentId);
  assert.equal(getCurrentSpreadsheetAttachment({ 'chat-a': both }, 'chat-a')?.artifact, secondArtifact);
  const remaining = both.filter((entry) => entry.attachmentId !== both[1].attachmentId);
  assert.equal(getCurrentSpreadsheetAttachment({ 'chat-a': remaining }, 'chat-a')?.artifact, spreadsheet);
});

test('repeated attachment action is blocked only until its current execution settles', () => {
  const gate = new AttachmentActionGate();
  assert.equal(gate.begin('chat-a', 'file-1', 'presentation'), true);
  assert.equal(gate.begin('chat-a', 'file-1', 'presentation'), false);
  assert.equal(gate.begin('chat-b', 'file-1', 'presentation'), true);
  assert.equal(gate.begin('chat-a', 'file-1', 'chart'), true);
  gate.end('chat-a', 'file-1', 'presentation');
  assert.equal(gate.begin('chat-a', 'file-1', 'presentation'), true);
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
