import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'use-intl';
import MessageBubble from '../src/components/studio/MessageBubble';
import ChatSources from '../src/components/studio/ChatSources';
import messages from '../messages/studio-en.json';
import type { WebSourcesAnnotation } from '../lib/chat/web-sources';

const annotation: WebSourcesAnnotation = { type: 'vantra-web-sources', state: 'read', readCount: 2,
  sources: Array.from({ length: 7 }, (_, index) => ({ id: `S${index + 1}`,
    title: `Primary source with a long title ${index + 1}`, url: `https://source${index + 1}.example/current` })) };
const texts = {
  en: 'The observed price is approximately $42 as of 09:30 UTC. [Official](https://source1.example/current)\n\n1. Node.js and the supported figure ~5%.\n2. A second short point.\n\n' + 'Useful supported context remains readable and concise. '.repeat(18),
  ar: 'السعر المرصود حوالي $42 حتى الساعة 09:30 UTC. [Official](https://source1.example/current)\n\n1. Node.js أحدث المعلومات العربية المطلوبة ونسبة ~5%.\n2. هذه نقطة أخرى باللغة العربية.\n\n' + 'هذا شرح للمعلومات المدعومة والملاحظات المتاحة باللغة العربية. '.repeat(18),
};
const render = (locale: 'en' | 'ar') => renderToStaticMarkup(<IntlProvider locale={locale} timeZone="UTC" messages={messages}>
  <MessageBubble message={{ id: 'search-ui', role: 'assistant', content: `${locale === 'ar' ? '## ملخص\n\n' : '## Summary\n\n'}${texts[locale]}\n\n${locale === 'ar' ? '## التفاصيل\n\n' : '## Details\n\n'}${locale === 'ar' ? 'معلومات مدعومة.' : 'Supported context.'}`, annotations: [annotation],
    createdAt: new Date('2026-10-01T09:30:00Z') }} isLatest onRegenerate={() => {}} />
</IntlProvider>);
console.log(JSON.stringify({ en: render('en'), ar: render('ar'), annotation,
  searching: renderToStaticMarkup(<ChatSources annotation={{ ...annotation, state: 'searching', sources: [], readCount: 0 }} locale="en" />) }));
