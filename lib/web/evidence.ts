import type { WebSearchHit } from './search.server';

export function asksForToday(request: string) {
  return /\b(?:today|today's|aujourd'hui)\b/iu.test(request) || /(?:اليوم|نهار اليوم)/u.test(request);
}

export function needsFreshEvidence(request: string) {
  return /\b(?:latest|current|today|now|recent|live|news|currently|aujourd'hui|actuel|récent|actualités|maintenant)\b/iu.test(request)
    || /(?:أحدث|احدث|آخر|اخر|الآن|الان|اليوم|أخبار|اخبار|الحالي)/u.test(request);
}

function localDate(now: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(now);
}

function safeUrl(url: string) {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.toString() : null; }
  catch { return null; }
}
function plainExcerpt(value: string, limit: number) {
  return value.replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g, (match) => match.slice(1, match.indexOf(']')))
    .replace(/https?:\/\/\S+/g, '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, limit);
}

function rawResultsRequested(request: string) {
  return /\b(?:raw|unprocessed)\s+(?:search\s+)?results\b|\b(?:list|show)\s+(?:the\s+)?search\s+results\b|\br[ée]sultats?\s+bruts?\b/iu.test(request)
    || /(?:نتائج البحث الخام|اعرض نتائج البحث|قائمة نتائج البحث)/u.test(request);
}

function likelyPrimarySource(hit: WebSearchHit, request: string) {
  const url = safeUrl(hit.url);
  if (!url) return false;
  const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  const terms = (request.toLowerCase().match(/[a-z][a-z0-9]{3,}/g) ?? [])
    .filter((term) => !['latest', 'today', 'current', 'recent', 'search', 'news', 'about', 'version'].includes(term));
  return terms.some((term) => host.split('.').some((part) => part.includes(term)))
    || /\.(?:gov|edu)(?:\.[a-z]{2})?$/.test(host);
}

function rankedEvidence(hits: readonly WebSearchHit[], request: string, today: string) {
  const valid = hits.filter((hit) => safeUrl(hit.url));
  const candidates = asksForToday(request) && valid.some((hit) => hit.publishedAt === today)
    ? valid.filter((hit) => hit.publishedAt === today) : valid;
  return candidates.map((hit, index) => ({ hit, index })).sort((a, b) => {
    const primary = Number(likelyPrimarySource(b.hit, request)) - Number(likelyPrimarySource(a.hit, request));
    if (primary) return primary;
    const dated = (b.hit.publishedAt ?? '').localeCompare(a.hit.publishedAt ?? '');
    return dated || a.index - b.index;
  }).map(({ hit }) => hit).slice(0, 3);
}

function safeClaim(hit: WebSearchHit) {
  const excerpt = plainExcerpt(hit.description, 300);
  if (!excerpt || /(?:ignore (?:all |previous )?instructions|system prompt|you are (?:an? |the )?(?:assistant|system)|(?:api[_ -]?key|secret|token)\s*[:=])/i.test(excerpt))
    return plainExcerpt(hit.title, 180);
  return excerpt;
}

/** Search evidence is data, never instructions; unknown publication dates stay unknown. */
export function searchEvidence(hits: readonly WebSearchHit[], request: string, now = new Date()) {
  const today = localDate(now);
  const publishedToday = hits.some((hit) => hit.publishedAt === today);
  const todayRequested = asksForToday(request);
  const lines = hits.flatMap((hit, index) => {
    const url = safeUrl(hit.url);
    if (!url) return [];
    return [`${index + 1}. ${plainExcerpt(hit.title, 180)}\nURL: ${url}\nPublished: ${hit.publishedAt ?? 'unknown'}\nSource: ${new URL(url).hostname}\nExcerpt: ${plainExcerpt(hit.description, 500)}`];
  });
  const notice = todayRequested && !publishedToday
    ? `No retrieved source has a verified publication date of ${today}. Do not present older or undated results as today's news.`
    : todayRequested ? `Only results dated ${today} may be described as published today.` : '';
  return { today, todayRequested, publishedToday, notice,
    text: [notice, ...lines].filter(Boolean).join('\n\n').slice(0, 8_000) };
}

/** A bounded extractive answer: every factual sentence comes from a returned source. */
export function groundedSearchSummary(hits: readonly WebSearchHit[], request: string, now = new Date(),
  locale: 'en' | 'fr' | 'ar' = 'en') {
  const evidence = searchEvidence(hits, request, now);
  const selected = rankedEvidence(hits, request, evidence.today);
  if (!selected.length) return locale === 'ar'
    ? 'لم أجد نتائج بحث موثوقة لهذا الطلب، لذلك لا أستطيع تأكيد معلومات حديثة أو ذكر مصادر.'
    : locale === 'fr' ? 'Aucun résultat de recherche fiable n’a été trouvé pour cette demande. Je ne peux donc pas confirmer des informations récentes ni citer des sources.'
      : 'No trustworthy search results were found for this request, so I cannot verify current information or cite sources.';
  const noToday = evidence.todayRequested && !evidence.publishedToday;
  const intro = noToday ? locale === 'ar' ? `لا توجد نتيجة موثوقة بتاريخ نشر مؤكد لليوم (${evidence.today}). وفق النتائج المتاحة:`
    : locale === 'fr' ? `Aucun résultat n’a une date de publication vérifiée pour aujourd’hui (${evidence.today}). D’après les sources disponibles :`
      : `No retrieved result has a verified publication date for today (${evidence.today}). From the available sources:`
    : locale === 'ar' ? 'وفق المصادر التي عُثر عليها:' : locale === 'fr' ? 'D’après les sources trouvées :' : 'According to the retrieved sources:';
  const entries = selected.map((hit) => {
    const citation = `[${plainExcerpt(hit.title, 180).replace(/[\[\]]/g, '')}](${safeUrl(hit.url)})`;
    const date = hit.publishedAt ? ` (${hit.publishedAt})` : '';
    return `${safeClaim(hit).replace(/[.!?؟]+$/, '')}. ${citation}${date}`;
  });
  if (rawResultsRequested(request)) return [intro, ...entries.map((entry) => `- ${entry}`)].join('\n\n');
  return [intro, entries.join(' ')].join('\n\n');
}

/** Only exact returned source URLs may appear as citations in a model-written answer. */
export function answerUsesOnlySearchSources(answer: string, hits: readonly WebSearchHit[], request: string,
  now = new Date()) {
  const evidence = searchEvidence(hits, request, now);
  if (evidence.todayRequested && !evidence.publishedToday) return false;
  const allowed = new Set(hits.map((hit) => safeUrl(hit.url)).filter(Boolean));
  const cited = [...answer.matchAll(/https?:\/\/[^\s)\]>"']+/g)].map((match) => safeUrl(match[0].replace(/[.,;!?]+$/, '')));
  if (!cited.length || cited.some((url) => !url || !allowed.has(url))) return false;
  return true;
}

/** Replace explicit plain-text search answers with the bounded, retrieved-source summary. */
export async function guardSearchDataStream(response: Response, hits: readonly WebSearchHit[], request: string,
  now = new Date(), locale: 'en' | 'fr' | 'ar' = 'en'): Promise<Response> {
  const body = await response.text();
  const lines = body.split('\n').filter(Boolean);
  const replacement = `0:${JSON.stringify(groundedSearchSummary(hits, request, now, locale))}`;
  const next: string[] = []; let inserted = false;
  for (const line of lines) {
    if (line.startsWith('0:')) { if (!inserted) { next.push(replacement); inserted = true; } continue; }
    next.push(line);
  }
  if (!inserted) next.unshift(replacement);
  const headers = new Headers(response.headers); headers.delete('content-length');
  return new Response(`${next.join('\n')}\n`, { status: response.status, statusText: response.statusText, headers });
}
