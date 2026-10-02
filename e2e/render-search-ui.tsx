import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'use-intl';
import MessageBubble from '../src/components/studio/MessageBubble';
import ChatSources from '../src/components/studio/ChatSources';
import messages from '../messages/studio-en.json';
import { separateCitations, type WebSourcesAnnotation } from '../lib/chat/web-sources';
import { documentFromMarkdown } from '../lib/artifacts/core';

const annotation: WebSourcesAnnotation = { type: 'vantra-web-sources', state: 'read', readCount: 2,
  sources: Array.from({ length: 7 }, (_, index) => ({ id: `S${index + 1}`,
    title: `Primary source with a long title ${index + 1}`, url: `https://source${index + 1}.example/current` })) };
const texts = {
  fr: 'Le prix observé est environ $42 à 09:30 UTC. [Official](https://source1.example/current)\n\n1. Node.js et la valeur observée ~5%.\n2. Un deuxième point utile.\n\n' + 'Le contexte étayé reste lisible et utile. '.repeat(22),
  en: 'The observed price is approximately $42 as of 09:30 UTC. [Official](https://source1.example/current)\n\n1. Node.js and the supported figure ~5%.\n2. A second short point.\n\n' + 'Useful supported context remains readable and concise. '.repeat(18),
  ar: 'السعر المرصود حوالي $42 حتى الساعة 09:30 UTC. [Official](https://source1.example/current)\n\n1. Node.js أحدث المعلومات العربية المطلوبة ونسبة ~5%.\n2. هذه نقطة أخرى باللغة العربية.\n\n' + 'هذا شرح للمعلومات المدعومة والملاحظات المتاحة باللغة العربية. '.repeat(18),
};
// Every registered source is actually referenced; duplicate/nested citations
// remain claim-linked in storage but share a paragraph-end presentation group.
const references = annotation.sources.map((source) => `[${source.id}](${source.url})`).join(' ');
texts.en = texts.en.replace('[Official](https://source1.example/current)', `**[Official](https://source1.example/current)** ${references}`);
texts.ar = texts.ar.replace('[Official](https://source1.example/current)', `**[Official](https://source1.example/current)** ${references}`);
texts.fr = texts.fr.replace('[Official](https://source1.example/current)', references);
const turns = Object.fromEntries(Object.entries(texts).map(([locale, content]) => {
  const separated = separateCitations(`## ${locale === 'ar' ? 'ملخص' : locale === 'fr' ? 'Résumé' : 'Summary'}\n\n${content}\n\n## ${locale === 'ar' ? 'التفاصيل' : locale === 'fr' ? 'Détails' : 'Details'}\n\n${locale === 'ar' ? 'معلومات مدعومة.' : locale === 'fr' ? 'Contexte étayé.' : 'Supported context.'}`, annotation.sources);
  return [locale, { id: `source-ui-${locale}`, role: 'assistant', content: separated.text,
    annotations: [{ ...annotation, citations: separated.citations }] }];
}));
const render = (locale: 'en' | 'fr' | 'ar') => renderToStaticMarkup(<IntlProvider locale={locale} timeZone="UTC" messages={messages}>
  <MessageBubble message={{ id: 'search-ui', role: 'assistant', content: `${locale === 'ar' ? '## ملخص\n\n' : '## Summary\n\n'}${texts[locale]}\n\n${locale === 'ar' ? '## التفاصيل\n\n' : '## Details\n\n'}${locale === 'ar' ? 'معلومات مدعومة.' : 'Supported context.'}`, annotations: [annotation],
    createdAt: new Date('2026-10-01T09:30:00Z') }} isLatest onRegenerate={() => {}} />
</IntlProvider>);
console.log(JSON.stringify({ en: render('en'), ar: render('ar'), fr: render('fr'), annotation, turns,
  documents: { en: documentFromMarkdown('stored-en', '# Article\n\nA useful **supported claim [1]**.\n\n1. Node.js and useful context [1]\n2. More context.', 'en'),
    ar: documentFromMarkdown('stored-ar', '# مقال\n\nهذا شرح **مدعوم للمعلومات [1]**.\n\n1. Node.js مع معلومات عربية مدعومة [1]\n2. المزيد من التفاصيل.', 'ar') },
  searching: renderToStaticMarkup(<ChatSources annotation={{ ...annotation, state: 'searching', sources: [], readCount: 0 }} locale="en" />) }));
