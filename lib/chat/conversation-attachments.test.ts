import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocumentArtifact, SpreadsheetArtifact } from '@/lib/artifacts/core';
import { chatRequestMessages } from './message-history';
import { attachConversationFile, AttachmentActionGate, attachedSpreadsheet, attachmentDisplayGroups,
  attachmentRequestContext, clearPendingAttachments, getConversationAttachment, getConversationAttachments,
  getCurrentSpreadsheetAttachment, chartFromSpreadsheetAttachment, markPendingAttachment, parseConversationAttachments,
  removePendingAttachment, resolveSpreadsheetAttachment, sentMessageAttachments, uploadFileKind } from './conversation-attachments';

const spreadsheet: SpreadsheetArtifact = {
  schemaVersion: 1, id: 'sheet-1', type: 'spreadsheet', title: 'sales', language: 'en', direction: 'ltr', metadata: {},
  sheets: [{ id: 'tab-1', name: 'Sheet1', columns: ['A', 'B'], rows: [['Month', 'Sales'], ['Jan', 20]] }],
};

test('selected document resource supplies the requested context among multiple documents', () => {
  const first: DocumentArtifact = { schemaVersion: 1, id: 'doc-1', type: 'document', title: 'First',
    language: 'en', direction: 'ltr', metadata: {}, blocks: [{ kind: 'paragraph', text: 'FIRST ONLY' }] };
  const second: DocumentArtifact = { ...first, id: 'doc-2', title: 'Second',
    blocks: [{ kind: 'paragraph', text: 'SECOND ONLY' }] };
  const attachments = attachConversationFile(attachConversationFile([], { kind: 'document', name: 'first.md', artifact: first }),
    { kind: 'document', name: 'second.md', artifact: second });
  assert.match(attachmentRequestContext(attachments, undefined, first).documentContext ?? '', /FIRST ONLY/);
  assert.doesNotMatch(attachmentRequestContext(attachments, undefined, first).documentContext ?? '', /SECOND ONLY/);
});

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

test('pending display moves to conversation context after send without changing the parsed attachment', () => {
  const attached = attachConversationFile([], { kind: 'spreadsheet', name: 'Products.xlsx', artifact: spreadsheet }, 'chat-a');
  const store = { 'chat-a': attached };
  const id = attached[0].attachmentId;
  const pending = markPendingAttachment({}, 'chat-a', id);
  assert.deepEqual(attachmentDisplayGroups(store, 'chat-a', pending['chat-a']).pending, attached);
  assert.deepEqual(attachmentDisplayGroups(store, 'chat-a', pending['chat-a']).context, []);
  const afterSend = clearPendingAttachments(pending, 'chat-a');
  assert.deepEqual(attachmentDisplayGroups(store, 'chat-a', afterSend['chat-a']).pending, []);
  assert.equal(attachmentDisplayGroups(store, 'chat-a', afterSend['chat-a']).context[0], attached[0]);
  assert.equal(getCurrentSpreadsheetAttachment(store, 'chat-a')?.artifact, spreadsheet);
  assert.ok(attachmentRequestContext(getConversationAttachments(store, 'chat-a')).spreadsheetContext);
});

test('restored files are context, stay isolated, and detach by ID', () => {
  const attached = attachConversationFile([], { kind: 'spreadsheet', name: 'Products.xlsx', artifact: spreadsheet }, 'chat-a');
  const restored = parseConversationAttachments(JSON.stringify(attached), 'chat-a');
  const store = { 'chat-a': restored, 'chat-b': [] };
  assert.deepEqual(attachmentDisplayGroups(store, 'chat-a', []).pending, []);
  assert.equal(attachmentDisplayGroups(store, 'chat-a', []).context[0].attachmentId, attached[0].attachmentId);
  assert.deepEqual(attachmentDisplayGroups(store, 'chat-b', [attached[0].attachmentId]).pending, []);
  const detached = restored.filter((item) => item.attachmentId !== attached[0].attachmentId);
  const afterDetach = { ...store, 'chat-a': detached };
  const pending = removePendingAttachment(markPendingAttachment({}, 'chat-a', attached[0].attachmentId),
    'chat-a', attached[0].attachmentId);
  assert.equal(getCurrentSpreadsheetAttachment(afterDetach, 'chat-a'), null);
  assert.deepEqual(attachmentDisplayGroups(afterDetach, 'chat-a', pending['chat-a']).context, []);
});

test('sent message owns attachment IDs while the same resource stays reusable after refresh', () => {
  const attached = attachConversationFile([], { kind: 'spreadsheet', name: 'Products.xlsx', artifact: spreadsheet }, 'chat-a');
  const id = attached[0].attachmentId;
  const pending = markPendingAttachment({}, 'chat-a', id);
  const sent = { role: 'user', content: 'Analyze this file.', vantraAttachmentIds: pending['chat-a'] };
  const restored = { 'chat-a': parseConversationAttachments(JSON.stringify(attached), 'chat-a') };
  const message = JSON.parse(JSON.stringify(sent));
  assert.deepEqual(attachmentDisplayGroups(restored, 'chat-a', []).pending, []);
  assert.equal(sentMessageAttachments(restored, 'chat-a', message.vantraAttachmentIds)[0].attachmentId, id);
  assert.equal(resolveSpreadsheetAttachment(restored, 'chat-a').attachment?.attachmentId, id);
  assert.deepEqual(sentMessageAttachments(restored, 'chat-b', message.vantraAttachmentIds), []);
  assert.deepEqual(sentMessageAttachments({ 'chat-a': [] }, 'chat-a', message.vantraAttachmentIds), []);
});

test('one spreadsheet resolves, multiple require selection, and explicit ID selects the intended resource', () => {
  const first = attachConversationFile([], { kind: 'spreadsheet', name: 'Products.xlsx', artifact: spreadsheet }, 'chat-a');
  const both = attachConversationFile(first, { kind: 'spreadsheet', name: 'Other.xlsx',
    artifact: { ...spreadsheet, id: 'other' } }, 'chat-a');
  assert.equal(resolveSpreadsheetAttachment({ 'chat-a': first }, 'chat-a').attachment?.attachmentId, first[0].attachmentId);
  assert.equal(resolveSpreadsheetAttachment({ 'chat-a': both }, 'chat-a').ambiguous, true);
  assert.equal(resolveSpreadsheetAttachment({ 'chat-a': both }, 'chat-a').attachment, null);
  assert.equal(resolveSpreadsheetAttachment({ 'chat-a': both }, 'chat-a', first[0].attachmentId).attachment?.attachmentId,
    first[0].attachmentId);
  assert.equal(resolveSpreadsheetAttachment({ 'chat-b': [] }, 'chat-b').attachment, null);
});

test('chart retry uses the same attached spreadsheet and yields a chart without network', () => {
  const fixture: SpreadsheetArtifact = { ...spreadsheet, id: 'products',
    sheets: [{ id: 'products-sheet', name: 'Products', columns: ['Product', 'Price'],
      rows: [['A', 12], ['B', 25], ['C', 18]] }] };
  const attached = attachConversationFile([], { kind: 'spreadsheet', name: 'Products.xlsx', artifact: fixture }, 'chat-a');
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => { calls++; throw new Error('Unexpected request'); }) as typeof fetch;
  try {
    const resolved = getConversationAttachment({ 'chat-a': attached }, 'chat-a', attached[0].attachmentId);
    const chart = chartFromSpreadsheetAttachment(resolved);
    assert.equal(chart?.type, 'chart');
    assert.equal(chartFromSpreadsheetAttachment(getConversationAttachment({ 'chat-b': [] }, 'chat-b',
      attached[0].attachmentId)), null);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
