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

/** A deterministic safe answer when the model's sourced answer cannot be trusted. */
export function groundedSearchSummary(hits: readonly WebSearchHit[], request: string, now = new Date(),
  locale: 'en' | 'fr' | 'ar' = 'en') {
  const evidence = searchEvidence(hits, request, now);
  if (!hits.some((hit) => safeUrl(hit.url))) return locale === 'ar'
    ? 'لم أجد نتائج بحث موثوقة لهذا الطلب، لذلك لا أستطيع تأكيد معلومات حديثة أو ذكر مصادر.'
    : locale === 'fr' ? 'Aucun résultat de recherche fiable n’a été trouvé pour cette demande. Je ne peux donc pas confirmer des informations récentes ni citer des sources.'
      : 'No trustworthy search results were found for this request, so I cannot verify current information or cite sources.';
  const intro = evidence.todayRequested && !evidence.publishedToday
    ? locale === 'ar' ? `لم أجد مصدرًا بتاريخ نشر مؤكد لليوم (${evidence.today}). هذه أحدث النتائج المتاحة مع تواريخها الفعلية.`
      : locale === 'fr' ? `Aucune source trouvée avec une date de publication vérifiée pour aujourd’hui (${evidence.today}). Voici les résultats disponibles avec leurs dates réelles.`
        : evidence.notice
    : locale === 'ar' ? 'هذه المصادر التي عُثر عليها؛ أذكر تاريخ النشر فقط حين يكون متاحًا.'
      : locale === 'fr' ? 'Voici les sources trouvées. Les dates de publication ne sont indiquées que lorsqu’elles sont disponibles.'
        : 'Here are the retrieved sources. Publication dates are shown only when available.';
  const entries = hits.slice(0, 5).flatMap((hit) => {
    const url = safeUrl(hit.url);
    if (!url) return [];
    const date = hit.publishedAt ? locale === 'ar' ? `نُشر ${hit.publishedAt}` : locale === 'fr'
      ? `Publié le ${hit.publishedAt}` : `Published ${hit.publishedAt}`
      : locale === 'ar' ? 'تاريخ النشر غير مؤكد' : locale === 'fr' ? 'Date de publication non vérifiée' : 'Publication date unverified';
    return [`- [${plainExcerpt(hit.title, 180).replace(/[\[\]]/g, '')}](${url}) — ${date}${hit.description ? `. ${plainExcerpt(hit.description, 300)}` : ''}`];
  });
  return [intro, ...entries].join('\n\n');
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
