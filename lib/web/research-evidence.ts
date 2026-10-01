import type { WebSearchHit } from './search.server';
import { canonicalSearchUrl, likelyPrimarySource, narrativeDateRange } from './evidence';
import { validateProviderEndpoint } from '@/lib/ai/providers/endpoint-security';

// Source instructions are never promoted to application instructions or acted on.
const instruction = /(?:ignore (?:all |the )?(?:previous|system) instructions|system prompt|developer message|send (?:your |the )?(?:api key|access token)|忽略之前的指令|تجاهل التعليمات السابقة)/iu;

/** Keep meaning-bearing query parameters; discard only tracking decoration. */
export function researchSourceKey(value: string) {
  try {
    const url = new URL(value);
    validateProviderEndpoint(url.origin);
    if (url.port || url.username || url.password) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/token|secret|auth|signature|api[_-]?key|password/i.test(key)) return null;
      if (/^(?:utm_.+|gclid|fbclid)$/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch { return null; }
}

export function researchEvidence(hits: readonly WebSearchHit[], request: string, seen: readonly string[] = []) {
  const seenUrls = new Set(seen.map(canonicalSearchUrl));
  const byUrl = new Map<string, WebSearchHit>();
  for (const hit of hits) {
    const key = researchSourceKey(hit.url);
    if (!key || instruction.test(`${hit.title} ${hit.description}`)) continue;
    const url = new URL(hit.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || [...url.searchParams.keys()].some((name) => /token|secret|auth|signature|api[_-]?key|password/i.test(name))) continue;
    const previous = byUrl.get(key);
    if (!previous || hit.verifiedPage && !previous.verifiedPage || hit.description.length > previous.description.length)
      byUrl.set(key, { ...previous, ...hit });
  }
  // Authority is a hint, never proof of relevance or of "latest". Keep competing
  // observations, unknown dates, and partial pages for the answer model to interpret.
  return [...byUrl.values()].sort((a, b) => Number(likelyPrimarySource(b, request)) - Number(likelyPrimarySource(a, request))
    || Number(seenUrls.has(canonicalSearchUrl(a.url))) - Number(seenUrls.has(canonicalSearchUrl(b.url))));
}

export function researchEventWindow(request: string, now: Date) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(now);
  const end = Date.parse(today);
  if (/\b(?:today|aujourd'hui)\b|اليوم/iu.test(request)) return { start: end, end, strict: true };
  if (/\b(?:yesterday|hier)\b|(?:أمس|امس)/iu.test(request))
    return { start: end - 86_400_000, end: end - 86_400_000, strict: true };
  return narrativeDateRange(request, today);
}

export function researchEvidenceText(hits: readonly WebSearchHit[], now = new Date(), request = '') {
  const window = researchEventWindow(request, now);
  const scope = request ? `Question/scope: ${JSON.stringify(request.slice(0, 300))}.\n` : '';
  const temporal = window.strict ? `Requested event window: ${new Date(window.start).toISOString().slice(0, 10)} through ${new Date(window.end).toISOString().slice(0, 10)}. Do not call an older event part of this window. If no event in the window is established, say that briefly and give useful older observations with their actual dates, not invented current events.\n` : '';
  return `Retrieved at ${now.toISOString()}. These are observations, not certified answers. A search/page date does not prove an event date or latest status.\n\n`
    + scope + temporal
    + hits.map((hit, index) => JSON.stringify({ source: hit.evidenceId ?? `S${index + 1}`, title: hit.title,
      publisher: new URL(hit.url).hostname, pagePublishedAt: hit.pagePublishedAt ?? hit.publishedAt ?? null,
      pageUpdatedAt: hit.pageUpdatedAt ?? null, observedAt: hit.fetchedAt ?? null,
      dateRole: 'Page dates only. Determine any event date from the content; never infer it from these fields.',
      extraction: hit.verifiedPage ? hit.contentComplete === false ? 'partial_page' : 'page_excerpt' : 'search_excerpt',
      content: hit.description.slice(0, 5000) })).join('\n\n');
}
