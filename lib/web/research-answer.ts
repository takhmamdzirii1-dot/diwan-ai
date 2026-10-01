import type { WebSearchHit } from './search.server';
import type { ResponseLanguage } from '@/lib/chat/response-language';
import { renderEvidenceSourceIds } from './evidence';

/** Delivery safety, not a lexical fact checker. The selected answer model is
 * responsible for distinguishing observations, estimates, and assumptions.
 * We never certify factual correctness merely because citations exist.
 */
export function deliverResearchAnswer(answer: string, hits: readonly WebSearchHit[], language: ResponseLanguage) {
  const warnings = new Set<string>();
  const sources = new Map(hits.map((hit, index) => [hit.evidenceId ?? `S${index + 1}`, hit]));
  const byUrl = new Map([...sources].map(([id, hit]) => [hit.url, id]));
  if (answer.length > 100_000 || /sb_secret_[\w-]{12,}|gh[pousr]_[\w]{20,}|\bBearer\s+[\w.-]{24,}|\b(?:API_KEY|CLIENT_SECRET|REFRESH_TOKEN)\s*[:=]\s*["']?[\w.-]{16,}/u.test(answer))
    return { accepted: false, text: '', reason: 'unsafe_output', warnings: ['unsafe_output'], citationsCount: 0 };
  const blocks = answer.replace(/(?:&amp;|&)#(?:x20|32);/gi, ' ').split(/\n\s*\n/u);
  const retained = blocks.flatMap((block) => {
    let unsafe = false;
    // Accept an exact returned Markdown URL as a formatting variant, but the
    // server still owns its final label and URL. Unknown citations lose only
    // their affected block, never unrelated supported findings.
    block = block.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gu, (_match, _label: string, url: string) => {
      const id = byUrl.get(url);
      if (!id) { unsafe = true; warnings.add('unsupported_citation_omitted'); return ''; }
      return `[[source:${id}]]`;
    });
    for (const match of block.matchAll(/\[\[source:([^\]]*)\]\]/gu))
      if (!sources.has(match[1])) { unsafe = true; warnings.add('unknown_source_omitted'); }
    const withoutTokens = block.replace(/\[\[source:S[1-9]\d*\]\]/gu, '');
    if (/\[\[source:|https?:\/\/|javascript:|<\s*(?:script|iframe|object)\b|\bon\w+\s*=/iu.test(withoutTokens)) {
      unsafe = true; warnings.add('unsafe_reference_omitted');
    }
    return unsafe ? [] : [block];
  });
  const text = retained.join('\n\n').trim();
  const rendered = text ? renderEvidenceSourceIds(text, hits, language) : '';
  const citationsCount = [...text.matchAll(/\[\[source:S[1-9]\d*\]\]/gu)].length;
  if (!citationsCount && hits.length) warnings.add('citations_missing');
  if (!hits.length) warnings.add('no_external_evidence');
  return { accepted: !!rendered, text: rendered ?? '', reason: rendered ? null : 'no_deliverable_content',
    warnings: [...warnings], citationsCount };
}
