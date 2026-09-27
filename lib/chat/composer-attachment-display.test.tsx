import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClaudeChatInput } from '@/components/ui/claude-style-chat-input';
import type { SpreadsheetArtifact } from '@/lib/artifacts/core';
import { attachConversationFile, clearPendingAttachments, markPendingAttachment } from './conversation-attachments';

const spreadsheet: SpreadsheetArtifact = { schemaVersion: 1, id: 'products', type: 'spreadsheet',
  title: 'Products', language: 'en', direction: 'ltr', metadata: {},
  sheets: [{ id: 'sheet-1', name: 'Products', columns: ['Product', 'Price'], rows: [['A', 10]] }] };

test('composer clears sent files and keeps a tiny resource control outside the input', () => {
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = (async () => { networkCalls++; throw new Error('Unexpected network request'); }) as typeof fetch;
  try {
    const attached = attachConversationFile([], { kind: 'spreadsheet', name: 'Products.xlsx', artifact: spreadsheet }, 'chat-a');
    const attachmentStore = { 'chat-a': attached };
    const pending = markPendingAttachment({}, 'chat-a', attached[0].attachmentId);
    const render = (pendingAttachmentIds: string[]) => renderToStaticMarkup(<ClaudeChatInput
      onSendMessage={() => {}} attachmentStore={attachmentStore} conversationId="chat-a"
      attachmentsHydrated pendingAttachmentIds={pendingAttachmentIds} />);
    const before = render(pending['chat-a']);
    assert.match(before, /data-attachment-display="pending"/);
    assert.doesNotMatch(before, /data-attachment-display="context"/);
    const after = render(clearPendingAttachments(pending, 'chat-a')['chat-a']);
    assert.doesNotMatch(after, /data-attachment-display="pending"/);
    assert.match(after, /data-attachment-display="context"/);
    assert.match(after, /<summary[^>]*>Files \(1\)<\/summary>/);
    assert.doesNotMatch(after, /Context · Products\.xlsx/);
    assert.equal(attached[0], attachmentStore['chat-a'][0]);
    const refreshed = render([]);
    assert.doesNotMatch(refreshed, /data-attachment-display="pending"/);
    assert.match(refreshed, /data-attachment-display="context"/);
    assert.match(refreshed, /<summary[^>]*>Files \(1\)<\/summary>/);
    assert.equal(networkCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
