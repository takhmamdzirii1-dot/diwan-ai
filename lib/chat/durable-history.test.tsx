import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'use-intl';
import type { Message } from '@ai-sdk/react';
import messages from '@/messages/studio-en.json';
import MessageBubble from '@/src/components/studio/MessageBubble';
import { canRegenerateAssistantMessage } from './message-history';

test('recovered empty interrupted assistant offers Regenerate in EN/FR/AR', () => {
  for (const [locale, label] of [['en', 'Regenerate'], ['fr', 'Régénérer'], ['ar', 'إعادة الإنشاء']]) {
    const message = { id: 'reply-op', role: 'assistant', content: '', vantraStatus: 'interrupted' } as Message;
    const html = renderToStaticMarkup(<IntlProvider locale={locale} messages={messages} timeZone="UTC">
      <MessageBubble message={message} isLatest onRegenerate={() => {}} />
    </IntlProvider>);
    assert.ok(html.includes(label));
    assert.equal(canRegenerateAssistantMessage({ role: 'assistant', content: '', vantraStatus: 'interrupted' }), true);
    assert.equal(canRegenerateAssistantMessage({ role: 'assistant', content: '', vantraStatus: 'interrupted' }, true), false);
  }
});

test('recovered streaming partial is visible with generating state, not raw artifact JSON', () => {
  const message = { id: 'reply-op', role: 'assistant', content: 'Safe partial answer', vantraStatus: 'streaming' } as Message;
  const html = renderToStaticMarkup(<IntlProvider locale="en" messages={messages} timeZone="UTC">
    <MessageBubble message={message} isLatest isStreaming />
  </IntlProvider>);
  assert.match(html, /Generating/);
  assert.match(html, /Safe partial answer/);
});
