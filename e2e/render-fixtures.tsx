import React from 'react';
import type { Message } from '@ai-sdk/react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'use-intl';
import MessageBubble from '@/src/components/studio/MessageBubble';
import { ClaudeChatInput } from '@/components/ui/claude-style-chat-input';
import { attachConversationFile, clearPendingAttachments, markPendingAttachment } from '@/lib/chat/conversation-attachments';
import type { SpreadsheetArtifact } from '@/lib/artifacts/core';
import { evaluateSearchSynthesis } from '@/lib/web/evidence';

const messages = JSON.parse(readFileSync(new URL('../messages/studio-en.json', import.meta.url), 'utf8'));
const bubble = renderToStaticMarkup(<IntlProvider locale="en" messages={messages}>
  <div className="mx-auto w-[600px] max-w-full space-y-6 p-5">
    <MessageBubble message={{ id: 'en', role: 'user', content: 'Hi', createdAt: new Date() }} isLatest={false} />
    <MessageBubble message={{ id: 'ar', role: 'user', content: 'مرحبا 1992 USD', createdAt: new Date() }} isLatest={false} />
  </div>
</IntlProvider>);
const bidi = renderToStaticMarkup(<IntlProvider locale="ar" messages={messages}>
  <div className="mx-auto w-[600px] max-w-full space-y-6 p-5">
    <MessageBubble message={{ id: 'bidi-user', role: 'user', content: 'اشرح OpenAI و Node.js و GPT-5.6 مع 123', createdAt: new Date() }} isLatest={false} />
    <MessageBubble message={{ id: 'bidi-assistant', role: 'assistant',
      content: '# العربية مع OpenAI و GPT-5.6\n\nEnglish starts this paragraph ثم العربية.\n\nالعربية تبدأ هنا مع Node.js و 123 و `GPT-5.6`.\n\n- العربية مع [Node.js](https://nodejs.org/)\n\n> اقتباس مع OpenAI و 42\n\n```js\nconst model = "GPT-5.6";\n```',
      createdAt: new Date() }} isLatest={false} />
  </div>
</IntlProvider>);

const artifact: SpreadsheetArtifact = { schemaVersion: 1, id: 'products', type: 'spreadsheet',
  title: 'Products', language: 'en', direction: 'ltr', metadata: {},
  sheets: [{ id: 'sheet', name: 'Products', columns: ['Product', 'Price'], rows: [['Atlas Pen', 4.5]] }] };
const attached = attachConversationFile([], { kind: 'spreadsheet', name: 'Products.xlsx', artifact }, 'qa-conversation');
const store = { 'qa-conversation': attached };
const pendingIds = markPendingAttachment({}, 'qa-conversation', attached[0].attachmentId);
const composer = (ids: string[]) => renderToStaticMarkup(<ClaudeChatInput onSendMessage={() => undefined}
  attachmentStore={store} conversationId="qa-conversation" attachmentsHydrated pendingAttachmentIds={ids} />);
const pending = composer(pendingIds['qa-conversation']);
const sentMessage = renderToStaticMarkup(<IntlProvider locale="en" messages={messages}>
  <MessageBubble message={{ id: 'sent', role: 'user', content: 'Analyze this file.', createdAt: new Date() }}
    isLatest={false} sentAttachments={attached} />
</IntlProvider>);
const sent = `<div>${sentMessage}${composer(clearPendingAttachments(pendingIds, 'qa-conversation')['qa-conversation'])}</div>`;
const file = renderToStaticMarkup(<IntlProvider locale="en" messages={messages}>
  <MessageBubble message={{ id: 'file', role: 'assistant', content: '', createdAt: new Date(),
    vantraParts: [{ type: 'file', name: 'Answer.txt', format: 'txt',
      mimeType: 'text/plain;charset=utf-8', content: 'Readable answer.' }] } as Message} isLatest={false} />
</IntlProvider>);

const searchAnswer = evaluateSearchSynthesis(
  'تضم النماذج الحالية خيارات للاستدلال والاستخدام العام بحسب المهمة. [[source:S1]]',
  [{ title: 'OpenAI models', url: 'https://openai.com/models',
    description: 'The current lineup includes reasoning and general-purpose model families for different tasks.',
    evidenceLevel: 'primary_search', evidenceBundle: 'general_search_evidence', evidenceId: 'S1' }],
  'اخر نماذج open ai', new Date('2026-09-29T12:00:00Z'), 'ar');
if (!searchAnswer.synthesisAccepted) throw new Error('Search fixture must pass the shared synthesis guard');
const search = renderToStaticMarkup(<IntlProvider locale="ar" messages={messages}>
  <MessageBubble message={{ id: 'grounded-search', role: 'assistant', content: searchAnswer.answer,
    createdAt: new Date() }} isLatest={false} />
</IntlProvider>);

process.stdout.write(JSON.stringify({ bubble, bidi, pending, sent, file, search }));
