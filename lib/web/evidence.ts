import type { WebSearchHit } from './search.server';
import { resolveResponseLanguage, type ResponseLanguage } from '@/lib/chat/response-language';

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

export function likelyPrimarySource(hit: WebSearchHit, request: string) {
  const url = safeUrl(hit.url);
  if (!url) return false;
  const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  const ignored = new Set(['latest', 'today', 'current', 'recent', 'search', 'news', 'about', 'version',
    'release', 'price', 'availability', 'what', 'which', 'when', 'where', 'now', 'the', 'official']);
  const terms = (request.toLowerCase().match(/[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*/g) ?? [])
    .map((term) => term.replace(/[._-]/g, '')).filter((term) => term.length >= 4 && !ignored.has(term));
  const labels = host.split('.').map((part) => part.replace(/-/g, ''));
  return terms.some((term) => labels.includes(term))
    || (terms.length === 0 && /\.(?:gov|edu)(?:\.[a-z]{2})?$/.test(host));
}

function evidenceStrength(hit: WebSearchHit) {
  return hit.evidenceLevel === 'primary_page' || hit.verifiedPage ? 3
    : hit.evidenceLevel === 'primary_search' ? 2 : hit.evidenceLevel === 'corroborated' ? 1 : 0;
}

function factText(hit: WebSearchHit) {
  return hit.evidenceLevel === 'primary_search' ? `${hit.title} ${hit.description}` : hit.description;
}

function evergreenSource(hit: WebSearchHit) {
  const url = safeUrl(hit.url);
  return url ? /\/(?:download|downloads|releases|versions|pricing|prices|status|availability)(?:\/|$)/iu.test(new URL(url).pathname) : false;
}

export function rankedEvidence(hits: readonly WebSearchHit[], request: string, today: string) {
  const valid = hits.filter((hit) => safeUrl(hit.url));
  const candidates = asksForToday(request) && valid.some((hit) => hit.publishedAt === today)
    ? valid.filter((hit) => hit.publishedAt === today) : valid;
  return candidates.map((hit, index) => ({ hit, index })).sort((a, b) => {
    const strength = evidenceStrength(b.hit) - evidenceStrength(a.hit);
    if (strength) return strength;
    const primary = Number(likelyPrimarySource(b.hit, request)) - Number(likelyPrimarySource(a.hit, request));
    if (primary) return primary;
    if (needsFreshEvidence(request)) {
      const evergreen = Number(evergreenSource(b.hit)) - Number(evergreenSource(a.hit));
      if (evergreen) return evergreen;
    }
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
    const basis = hit.evidenceLevel === 'primary_search' ? 'Official search-result evidence'
      : hit.evidenceLevel === 'corroborated' ? 'Corroborated independent source'
        : hit.verifiedPage || hit.evidenceLevel === 'primary_page' ? 'Verified primary page' : 'Search excerpt';
    return [`${index + 1}. ${plainExcerpt(hit.title, 180)}\nURL: ${url}\nPublished: ${hit.publishedAt ?? 'unknown'}\nSource: ${new URL(url).hostname}\n${basis}: ${plainExcerpt(hit.description, 500)}`];
  });
  const notice = todayRequested && !publishedToday
    ? `No retrieved source has a verified publication date of ${today}. Do not present older or undated results as today's news.`
    : todayRequested ? `Only results dated ${today} may be described as published today.` : '';
  return { today, todayRequested, publishedToday, notice,
    text: [notice, ...lines].filter(Boolean).join('\n\n').slice(0, 8_000) };
}

function labeledVersion(text: string, label: 'current' | 'lts') {
  const version = String.raw`v?\d+\.\d+(?:\.\d+)?`;
  return text.match(new RegExp(String.raw`\b${label}\b[^\d]{0,45}?\b(${version})\b`, 'i'))?.[1]
    ?? text.match(new RegExp(String.raw`\b(${version})\b[^\n]{0,35}?\b${label}\b`, 'i'))?.[1]
    ?? null;
}

/** Only explicit claim-bearing excerpts qualify; a URL or source name alone is not a fact. */
export function freshFactKey(text: string, request: string): string | null {
  const content = plainExcerpt(text, 1_000);
  if (/\bversion\b|\brelease\b|(?:إصدار|اصدار|نسخة)/iu.test(request)) {
    const current = labeledVersion(content, 'current')
      ?? content.match(/\b(?:latest|newest|أحدث|احدث|آخر|اخر)\b[^\d]{0,45}?\b(v?\d+\.\d+(?:\.\d+)?)\b/iu)?.[1];
    const lts = labeledVersion(content, 'lts');
    return current ? `version:current:${current.replace(/^v/i, '')}`
      : lts && /\bLTS\b/iu.test(request) ? `version:lts:${lts.replace(/^v/i, '')}` : null;
  }
  if (/\b(?:price|prices|prix|cost)\b|(?:سعر|الأسعار|الاسعار)/iu.test(request)) {
    const price = content.match(/(?:\b(?:USD|EUR|DZD|DA)\s*|[$€£]\s*)(\d[\d,.]*)|\b(\d[\d,.]*)\s*(USD|EUR|DZD|DA|[$€£])/iu);
    if (!price) return null;
    const amount = (price[1] ?? price[2]).replace(/[,.]$/u, '').replace(/,/g, '');
    const currency = (price[3] ?? price[0].match(/USD|EUR|DZD|DA|[$€£]/iu)?.[0] ?? '').toUpperCase();
    return `price:${amount}:${currency}`;
  }
  if (/\b(?:available|availability|stock|disponibilit[ée]|status)\b|(?:متاح|متوفر|توفر|الحالة)/iu.test(request)) {
    if (/\b(?:unavailable|out of stock|not available|indisponible)\b|(?:غير متاح|غير متوفر)/iu.test(content)) return 'availability:no';
    if (/\b(?:available|in stock|disponible)\b|(?:متاح|متوفر)/iu.test(content)) return 'availability:yes';
  }
  return null;
}

/** Conservative localized fallback when the same-call model answer cannot be verified. */
export function groundedSearchSummary(hits: readonly WebSearchHit[], request: string, now = new Date(),
  locale: ResponseLanguage = 'en') {
  const evidence = searchEvidence(hits, request, now);
  const selected = rankedEvidence(hits, request, evidence.today);
  if (needsFreshEvidence(request) && !selected.some((hit) => evidenceStrength(hit))) return locale === 'ar'
    ? 'لم أتمكن من التحقق من المعلومة الحالية بأدلة كافية، لذلك لا أستطيع تأكيدها.'
    : locale === 'fr' ? 'Je n’ai pas pu vérifier cette information actuelle avec des preuves suffisantes ; je ne peux donc pas la confirmer.'
      : 'I could not verify the current fact with sufficient evidence, so I cannot confirm it.';
  if (!selected.length) return locale === 'ar'
    ? 'لم أجد نتائج بحث موثوقة لهذا الطلب، لذلك لا أستطيع تأكيد معلومات حديثة أو ذكر مصادر.'
    : locale === 'fr' ? 'Aucun résultat de recherche fiable n’a été trouvé pour cette demande. Je ne peux donc pas confirmer des informations récentes ni citer des sources.'
      : 'No trustworthy search results were found for this request, so I cannot verify current information or cite sources.';
  const noToday = evidence.todayRequested && !evidence.publishedToday;
  const notice = noToday ? locale === 'ar' ? `لم أجد خبرًا موثّقًا بتاريخ اليوم (${evidence.today}).`
    : locale === 'fr' ? `Je n’ai trouvé aucun résultat dont la publication aujourd’hui (${evidence.today}) soit vérifiée.`
      : `I found no result verified as published today (${evidence.today}).` : '';
  const first = selected[0];
  const firstCitation = `[${plainExcerpt(first.title, 180).replace(/[\[\]]/g, '')}](${safeUrl(first.url)})${first.publishedAt ? ` (${first.publishedAt})` : ''}`;
  const second = selected[1];
  const corroboration = first.evidenceLevel === 'corroborated' && second
    ? ` [${plainExcerpt(second.title, 180).replace(/[\[\]]/g, '')}](${safeUrl(second.url)})${second.publishedAt ? ` (${second.publishedAt})` : ''}` : '';
  const fact = freshFactKey(factText(first), request);
  const asksVersion = /\bversion\b|(?:إصدار|اصدار|نسخة)/iu.test(request);
  const currentVersion = asksVersion ? labeledVersion(factText(first), 'current')
    ?? (fact?.startsWith('version:current:') ? fact.slice('version:current:'.length) : null) : null;
  const ltsVersion = asksVersion ? labeledVersion(factText(first), 'lts') : null;
  const version = asksVersion && !needsFreshEvidence(request)
    ? `${first.title} ${first.description}`.match(/\b(?:v)?\d+\.\d+(?:\.\d+)?\b/i)?.[0] : null;
  if (!rawResultsRequested(request)) {
    const price = fact?.startsWith('price:') ? fact.split(':').slice(1).join(' ') : null;
    const availability = fact === 'availability:yes' ? 'available' : fact === 'availability:no' ? 'unavailable' : null;
    if (corroboration) {
      const claim = currentVersion ? locale === 'ar' ? `إصدار Current هو ${currentVersion}`
        : locale === 'fr' ? `la version Current est ${currentVersion}` : `Current version is ${currentVersion}`
        : price ? locale === 'ar' ? `السعر المذكور هو ${price}` : locale === 'fr' ? `le prix indiqué est ${price}` : `the reported price is ${price}`
          : availability ? locale === 'ar' ? `الحالة المذكورة هي ${availability === 'available' ? 'متاح' : 'غير متاح'}`
            : locale === 'fr' ? `la disponibilité indiquée est ${availability === 'available' ? 'disponible' : 'indisponible'}`
              : `reported availability is ${availability}` : null;
      if (claim) return [notice, locale === 'ar' ? `يشير مصدران مستقلان إلى أن ${claim}، دون تأكيد مباشر من المصدر الرسمي. ${firstCitation}${corroboration}`
        : locale === 'fr' ? `Deux sources indépendantes indiquent que ${claim}, sans confirmation directe de la source officielle. ${firstCitation}${corroboration}`
          : `Two independent sources agree that ${claim}, without direct confirmation from the official source. ${firstCitation}${corroboration}`].filter(Boolean).join(' ');
    }
    if (price) return [notice, locale === 'ar' ? `السعر المذكور هو ${price}. ${firstCitation}`
      : locale === 'fr' ? `Le prix indiqué est ${price}. ${firstCitation}` : `The reported price is ${price}. ${firstCitation}`].filter(Boolean).join(' ');
    if (availability) return [notice, locale === 'ar' ? `الحالة المذكورة هي ${availability === 'available' ? 'متاح' : 'غير متاح'}. ${firstCitation}`
      : locale === 'fr' ? `La disponibilité indiquée est ${availability === 'available' ? 'disponible' : 'indisponible'}. ${firstCitation}`
        : `The reported availability is ${availability}. ${firstCitation}`].filter(Boolean).join(' ');
    const direct = currentVersion ? locale === 'ar' ? `الإصدار Current هو ${currentVersion}${ltsVersion ? `، وإصدار LTS هو ${ltsVersion}` : ''}. ${firstCitation}`
      : locale === 'fr' ? `La version Current est ${currentVersion}${ltsVersion ? ` et la version LTS est ${ltsVersion}` : ''}. ${firstCitation}`
        : `The Current release is ${currentVersion}${ltsVersion ? `, and the LTS release is ${ltsVersion}` : ''}. ${firstCitation}`
      : ltsVersion && /\bLTS\b/iu.test(request) ? locale === 'ar' ? `إصدار LTS هو ${ltsVersion}. ${firstCitation}`
        : locale === 'fr' ? `La version LTS est ${ltsVersion}. ${firstCitation}`
          : `The LTS release is ${ltsVersion}. ${firstCitation}`
      : version ? locale === 'ar' ? `الإصدار الذي يذكره المصدر هو ${version}. ${firstCitation}`
      : locale === 'fr' ? `La version indiquée par la source est ${version}. ${firstCitation}`
        : `The source identifies version ${version}. ${firstCitation}`
      : locale === 'ar' ? `لا تكفي النتائج الموثوقة لتأكيد إجابة مختصرة لهذا السؤال. المصدر الأوثق المتاح: ${firstCitation}`
        : locale === 'fr' ? `Les résultats fiables ne suffisent pas à confirmer une réponse concise. Source la plus pertinente : ${firstCitation}`
          : `The retrieved evidence is insufficient for a confident concise answer. Most relevant source: ${firstCitation}`;
    return [notice, direct].filter(Boolean).join(' ');
  }
  const entries = selected.map((hit) => {
    const citation = `[${plainExcerpt(hit.title, 180).replace(/[\[\]]/g, '')}](${safeUrl(hit.url)})`;
    const date = hit.publishedAt ? ` (${hit.publishedAt})` : '';
    return `${safeClaim(hit).replace(/[.!?؟]+$/, '')}. ${citation}${date}`;
  });
  return [notice, ...entries.map((entry) => `- ${entry}`)].filter(Boolean).join('\n\n');
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

/** Reject unsupported citations, copied snippets, unverified numbers, and wrong-language answers. */
export function usableSearchSynthesis(answer: string, hits: readonly WebSearchHit[], request: string,
  now: Date, language: ResponseLanguage) {
  const trimmed = answer.trim();
  if (!trimmed || trimmed.length > 4_000 || rawResultsRequested(request)) return false;
  if (needsFreshEvidence(request) && (!hits.some((hit) => evidenceStrength(hit))
    || hits[0]?.evidenceLevel === 'corroborated')) return false;
  if (!answerUsesOnlySearchSources(trimmed, hits, request, now)) return false;
  const withoutLinks = trimmed.replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g, ' ');
  if (language === 'ar' && (withoutLinks.match(/[\u0600-\u06ff]/gu) ?? []).length < 3) return false;
  if (resolveResponseLanguage(withoutLinks, [], 'en') !== language) return false;
  if (/^(?:according to (?:the )?(?:retrieved |available )?sources|here are (?:the )?(?:search )?results|d'après les sources|وفق المصادر)/iu.test(trimmed)) return false;
  if (/^\s*(?:[-*]|\d+\.)\s/mu.test(trimmed)) return false;
  const cited = [...trimmed.matchAll(/https?:\/\/[^\s)\]>"']+/g)];
  if (cited.length > 3) return false;
  const citations = [...trimmed.matchAll(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g)];
  if (citations.length !== cited.length || citations.some(([, label, url]) => !hits.some((hit) =>
    safeUrl(hit.url) === safeUrl(url) && label === plainExcerpt(hit.title, 180).replace(/[\[\]]/g, '')))) return false;
  if (hits.some((hit) => likelyPrimarySource(hit, request))
    && !citations.some(([, , url]) => hits.some((hit) => safeUrl(hit.url) === safeUrl(url)
      && likelyPrimarySource(hit, request)))) return false;
  const allowedNumbers = new Set(hits.flatMap((hit) => `${needsFreshEvidence(request) && hit.evidenceLevel !== 'primary_search' ? '' : hit.title} ${hit.description} ${hit.publishedAt ?? ''}`.match(/\b\d+(?:[.\-]\d+)*\b/g) ?? []));
  if ((withoutLinks.match(/\b\d+(?:[.\-]\d+)*\b/g) ?? []).some((value) => !allowedNumbers.has(value))) return false;
  if (needsFreshEvidence(request) && /\bversion\b|(?:إصدار|اصدار|نسخة)/iu.test(request)) {
    const current = rankedEvidence(hits, request, localDate(now))
      .map((hit) => evidenceStrength(hit) ? labeledVersion(factText(hit), 'current') : null).find(Boolean);
    if (current && !withoutLinks.includes(current)) return false;
  }
  if (hits.some((hit) => { const excerpt = plainExcerpt(hit.description, 400); return excerpt.length >= 24
    && withoutLinks.toLowerCase().includes(excerpt.toLowerCase()); })) return false;
  const claims = withoutLinks.split(/(?<=[.!?؟])\s+/u).map((sentence) => sentence.trim().toLowerCase())
    .filter((sentence) => sentence.length > 25);
  if (new Set(claims).size !== claims.length) return false;
  return true;
}

/** Keep the existing model's grounded synthesis; fail closed to a localized sourced answer. */
export async function guardSearchDataStream(response: Response, hits: readonly WebSearchHit[], request: string,
  now = new Date(), locale: ResponseLanguage = 'en'): Promise<Response> {
  const body = await response.text();
  const lines = body.split('\n').filter(Boolean);
  const modelAnswer = lines.flatMap((line) => {
    if (!line.startsWith('0:')) return [];
    try { const text = JSON.parse(line.slice(2)); return typeof text === 'string' ? [text] : []; }
    catch { return []; }
  }).join('');
  if (usableSearchSynthesis(modelAnswer, hits, request, now, locale))
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
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
