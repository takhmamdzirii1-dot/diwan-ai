import type { WebSearchHit } from './search.server';
import { resolveResponseLanguage, type ResponseLanguage } from '@/lib/chat/response-language';

export function asksForToday(request: string) {
  return /\b(?:today|today's|aujourd'hui)\b/iu.test(request) || /(?:اليوم|نهار اليوم)/u.test(request);
}

export function needsFreshEvidence(request: string) {
  return /\b(?:latest|current|today|now|recent|live|news|currently|aujourd'hui|actuel|récent|actualités|maintenant)\b/iu.test(request)
    || /(?:أحدث|احدث|آخر|اخر|الآن|الان|اليوم|أخبار|اخبار|الحالي)/u.test(request);
}

export type EvidenceMode = 'structured_fact' | 'fresh_news' | 'general_web';

export function evidenceModeForRequest(request: string): EvidenceMode {
  if (!needsFreshEvidence(request)) return 'general_web';
  if (/\b(?:news|headlines|developments|announcements|actualit[ée]s|nouvelles)\b|(?:أخبار|اخبار|مستجدات|تطورات)/iu.test(request))
    return 'fresh_news';
  if (/\b(?:version|release|price|prices|cost|availability|stock|status|prix|disponibilit[ée])\b|(?:إصدار|اصدار|نسخة|سعر|الأسعار|الاسعار|متاح|متوفر|الحالة)/iu.test(request))
    return 'structured_fact';
  return 'fresh_news';
}

function localDate(now: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(now);
}

function safeUrl(url: string) {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.toString() : null; }
  catch { return null; }
}
/** Identity only: keep article paths exact while ignoring harmless URL decoration. */
export function canonicalSearchUrl(url: string) {
  const safe = safeUrl(url);
  if (!safe) return null;
  const parsed = new URL(safe);
  if (parsed.username || parsed.password) return null;
  parsed.hostname = parsed.hostname.replace(/^www\./i, '');
  parsed.hash = ''; parsed.search = '';
  if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString();
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
    : hit.evidenceLevel === 'primary_search' || hit.evidenceLevel === 'primary_bundle' ? 2
      : hit.evidenceLevel === 'corroborated' ? 1 : 0;
}

/** Dedupe equivalent URLs; preserve the first provider's evidence unless its excerpt is empty. */
export function dedupeSearchHits(hits: readonly WebSearchHit[]) {
  const unique = new Map<string, WebSearchHit>();
  for (const hit of hits) {
    const key = canonicalSearchUrl(hit.url);
    if (!key) continue;
    const existing = unique.get(key);
    if (!existing || (!existing.description.trim() && hit.description.trim()))
      unique.set(key, hit);
  }
  // At most eight results from each of the two existing providers.
  return [...unique.values()].slice(0, 16);
}

function factText(hit: WebSearchHit) {
  return hit.evidenceLevel === 'primary_search' ? `${hit.title} ${hit.description}` : hit.description;
}

function evergreenPathSegments(hit: WebSearchHit) {
  const url = safeUrl(hit.url);
  return url ? new URL(url).pathname.toLowerCase().split('/').filter(Boolean) : [];
}

/** Prefixes may contain a locale or docs section, but a historical article is not a live index. */
function liveIndexSegment(segments: string[], names: readonly string[]) {
  return segments.some((segment, index) => names.includes(segment)
    && !segments.slice(0, index).some((prefix) =>
      ['archive', 'archives', 'blog', 'news'].includes(prefix))
    && (index === segments.length - 1 || (index === segments.length - 2
      && ['current', 'latest', 'index'].includes(segments[index + 1]))));
}

function evergreenSource(hit: WebSearchHit) {
  const segments = evergreenPathSegments(hit);
  return liveIndexSegment(segments, ['download', 'downloads', 'releases', 'versions', 'status'])
    || segments.some((segment, index) => ['pricing', 'prices', 'availability'].includes(segment)
      && !segments.slice(0, index).some((prefix) => ['archive', 'archives', 'blog', 'news'].includes(prefix)));
}

function latestVersionRequest(request: string) {
  return needsFreshEvidence(request)
    && /\b(?:version|release)\b|(?:إصدار|اصدار|نسخة)/iu.test(request);
}

/** A release note is a dated snapshot, even if its title called that release "Current". */
function currentReleaseIndex(hit: WebSearchHit) {
  return liveIndexSegment(evergreenPathSegments(hit),
    ['download', 'downloads', 'releases', 'versions', 'status']);
}

function publishedDay(hit: WebSearchHit) {
  const time = hit.publishedAt ? Date.parse(hit.publishedAt) : NaN;
  return Number.isFinite(time) ? time : null;
}

function latestPrimaryClaim(hits: WebSearchHit[], request: string, today: string) {
  const claim = (hit: WebSearchHit) => freshFactKey(
    hit.verifiedPage ? hit.description : `${hit.title} ${hit.description}`, request);
  const indexes = hits.filter(currentReleaseIndex);
  if (indexes.length) {
    const keys = new Set(indexes.map(claim));
    if (keys.size === 1) return { key: claim(indexes[0]), hits: indexes };
    // Conflicting live indexes cannot be resolved by how successfully they were read.
    return null;
  }
  const dated = hits.filter((hit) => publishedDay(hit) !== null)
    .sort((a, b) => publishedDay(b)! - publishedDay(a)!);
  if (!dated.length) return null;
  const newestDay = publishedDay(dated[0])!;
  const newest = dated.filter((hit) => publishedDay(hit) === newestDay);
  if (new Set(newest.map(claim)).size !== 1) return null;
  // A dated release page alone is not proof that nothing newer has shipped.
  // A short recency window permits an exact release claim; older claims remain
  // unresolved without spending another provider request for evidence quality.
  const todayTime = Date.parse(today);
  if (!Number.isFinite(todayTime) || newestDay > todayTime + 86_400_000
    || newestDay < todayTime - 7 * 86_400_000) return null;
  return { key: claim(newest[0]), hits: newest };
}

export function rankedEvidence(hits: readonly WebSearchHit[], request: string, today: string) {
  const valid = hits.filter((hit) => safeUrl(hit.url));
  const candidates = asksForToday(request) && valid.some((hit) => hit.publishedAt === today)
    ? valid.filter((hit) => hit.publishedAt === today) : valid;
  return candidates.map((hit, index) => ({ hit, index })).sort((a, b) => {
    const quality = evidenceScore(b.hit, request, today) - evidenceScore(a.hit, request, today);
    if (quality) return quality;
    const dated = (b.hit.publishedAt ?? '').localeCompare(a.hit.publishedAt ?? '');
    return dated || a.index - b.index;
  }).map(({ hit }) => hit).slice(0, 3);
}

/** Relative quality only; it never converts a weak source into a verified claim. */
export function evidenceScore(hit: WebSearchHit, request: string, today: string) {
  let score = evidenceStrength(hit) * 30 + (likelyPrimarySource(hit, request) ? 15 : 0);
  if (freshFactKey(`${hit.title} ${hit.description}`, request)) score += 8;
  if (needsFreshEvidence(request) && evergreenSource(hit)) score += 6;
  if (hit.publishedAt === today) score += 5;
  else if (hit.publishedAt && Date.parse(hit.publishedAt) < Date.parse(today) - 180 * 86_400_000) score -= 5;
  if (hit.description.trim().length < 24) score -= 8;
  return score;
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
    return [`${hit.evidenceId ?? `S${index + 1}`}. ${plainExcerpt(hit.title, 180)}\nURL: ${url}\nPublished: ${hit.publishedAt ?? 'unknown'}\nSource: ${new URL(url).hostname}\n${basis}: ${plainExcerpt(hit.description, 500)}`];
  });
  const notice = todayRequested && !publishedToday
    ? `No retrieved source has a verified publication date of ${today}. Do not present older or undated results as today's news.`
    : todayRequested ? `Only results dated ${today} may be described as published today.`
      : evidenceModeForRequest(request) === 'fresh_news' && !hits.some((hit) => hit.publishedAt)
        ? 'Publication dates are unavailable. Do not claim these reports were published today or are confirmed latest.' : '';
  return { today, todayRequested, publishedToday, notice,
    text: [notice, ...lines].filter(Boolean).join('\n\n').slice(0, 8_000) };
}

function labeledVersion(text: string, label: 'current' | 'lts') {
  const version = String.raw`v?\d+\.\d+(?:\.\d+)?`;
  const between = String.raw`(?:(?!\b(?:current|lts)\b)[^\d\n])`;
  return text.match(new RegExp(String.raw`\b${label}\b${between}{0,45}?\b(${version})\b`, 'i'))?.[1]
    ?? text.match(new RegExp(String.raw`\b(${version})\b(?:(?!\b(?:current|lts)\b)[^\n]){0,35}?\b${label}\b`, 'i'))?.[1]
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

export type FreshEvidenceKind = 'primary_exact' | 'primary_supported_bundle'
  | 'corroborated_exact' | 'insufficient';

function independentDomain(hit: WebSearchHit) {
  const host = new URL(hit.url).hostname.replace(/^www\./, '');
  return host.split('.').slice(-2).join('.');
}

const relevanceStopwords = new Set(['what', 'which', 'the', 'from', 'about', 'latest', 'current', 'recent',
  'news', 'search', 'find', 'today', 'now', 'show', 'company', 'please', 'avec', 'pour', 'les', 'des',
  'actualites', 'ما', 'هو', 'هي', 'من', 'عن', 'آخر', 'اخر', 'أحدث', 'احدث', 'أخبار', 'اخبار', 'شركة', 'اليوم', 'الآن', 'الان']);

function relevantTerms(request: string) {
  return (request.toLowerCase().match(/[\p{L}\p{N}]+(?:[.\-_][\p{L}\p{N}]+)*/gu) ?? [])
    .filter((term) => term.length >= 3 && !relevanceStopwords.has(term));
}

export function relevantWebHit(hit: WebSearchHit, request: string) {
  const terms = relevantTerms(request);
  if (!terms.length) return false;
  const content = `${hit.title} ${hit.description}`.toLowerCase();
  return terms.some((term) => content.includes(term));
}

export function assessNarrativeEvidenceBundle(hits: readonly WebSearchHit[], request: string,
  today: string, mode: 'fresh_news' | 'general_web') {
  const valid = dedupeSearchHits(hits).filter((hit) => hit.title.trim().length >= 8
    && hit.description.trim().length >= 24 && relevantWebHit(hit, request));
  const todayTime = Date.parse(today);
  const relevant = mode === 'fresh_news' ? valid.filter((hit) => {
    if (asksForToday(request)) return hit.publishedAt === today;
    const date = hit.publishedAt ? Date.parse(hit.publishedAt) : NaN;
    return !Number.isFinite(date) || (date <= todayTime + 86_400_000
      && date >= todayTime - 30 * 86_400_000);
  }) : valid;
  const domains = new Set(relevant.map(independentDomain));
  const primary = relevant.filter((hit) => likelyPrimarySource(hit, request));
  const dated = relevant.some((hit) => hit.publishedAt && Number.isFinite(Date.parse(hit.publishedAt)));
  const explicitFacts = new Set(relevant.map((hit) => freshFactKey(`${hit.title} ${hit.description}`, request))
    .filter(Boolean));
  if (mode === 'fresh_news' && explicitFacts.size > 1) return { kind: 'insufficient' as const, factKey: null,
    reason: 'unresolved_exact_conflict' as const, hits: [] as WebSearchHit[] };
  const sufficient = mode === 'fresh_news'
    ? (primary.length > 0 && (dated || primary.some((hit) => hit.verifiedPage)))
      || domains.size >= 2
    : primary.length > 0 || domains.size >= 2;
  if (!sufficient) return { kind: 'insufficient' as const, factKey: null,
    reason: relevant.length ? 'insufficient_source_diversity' as const : 'no_relevant_sources' as const,
    hits: [] as WebSearchHit[] };
  const kind = mode === 'fresh_news' ? 'independent_news_sources' as const : 'general_search_evidence' as const;
  const ranked = [...relevant].sort((a, b) => {
    const freshnessDifference = (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
    const primaryDifference = Number(likelyPrimarySource(b, request)) - Number(likelyPrimarySource(a, request));
    return (mode === 'fresh_news' ? freshnessDifference || primaryDifference : primaryDifference || freshnessDifference)
      || evidenceScore(b, request, today) - evidenceScore(a, request, today);
  });
  const chosen: WebSearchHit[] = []; const used = new Set<string>();
  for (const hit of ranked) {
    const domain = independentDomain(hit);
    if (used.has(domain)) continue;
    chosen.push({ ...hit, evidenceLevel: likelyPrimarySource(hit, request) ? 'primary_search' : 'corroborated',
      evidenceBundle: kind });
    used.add(domain);
    if (chosen.length === 3) break;
  }
  return { kind, factKey: null, reason: kind, hits: chosen };
}

function currentMajor(text: string) {
  const content = plainExcerpt(text, 500);
  // Current and LTS often share one excerpt. Never carry a major across the
  // opposing label, and prefer the series stated immediately before Current.
  const match = content.match(/\bv?(\d{1,3})\b(?:(?!\bLTS\b)[^\n.]){0,35}?\bcurrent\b/iu)
    ?? content.match(/\bcurrent\b(?:(?!\bLTS\b)[^\n.]){0,35}?\bv?(\d{1,3})\b/iu);
  return match?.[1] ?? null;
}

export function supportsPrimaryPage(hit: WebSearchHit, request: string, today: string) {
  if (freshFactKey(hit.description, request) || currentMajor(hit.description)) return true;
  const structured = /\b(?:version|release|price|cost|availability|stock|status)\b|(?:إصدار|اصدار|نسخة|سعر|متاح|متوفر)/iu.test(request);
  return !structured && hit.description.trim().length >= 40
    && (!asksForToday(request) || hit.publishedAt === today);
}

/** Deterministic bundle sufficiency, separate from ranking scores. */
export function assessFreshEvidenceBundle(hits: readonly WebSearchHit[], request: string, today: string) {
  const candidates = dedupeSearchHits(hits);
  const primary = candidates.filter((hit) => likelyPrimarySource(hit, request));
  const claimText = (hit: WebSearchHit) => hit.verifiedPage ? hit.description : `${hit.title} ${hit.description}`;
  const currentSeries = primary.filter((hit) => !freshFactKey(claimText(hit), request))
    .map((hit) => currentMajor(claimText(hit))).find((value) => value !== null);
  const exactPrimary = primary.filter((hit) => {
    const key = freshFactKey(claimText(hit), request);
    return key && (!currentSeries || !key.startsWith('version:current:')
      || key.startsWith(`version:current:${currentSeries}.`));
  });
  if (exactPrimary.length) {
    if (latestVersionRequest(request)) {
      const liveIndexClaims = new Set(exactPrimary.filter(currentReleaseIndex)
        .map((hit) => freshFactKey(claimText(hit), request)));
      if (liveIndexClaims.size > 1)
        return { kind: 'insufficient' as const, factKey: null, hits: [] as WebSearchHit[],
          reason: 'materially_unresolved_conflict' as const };
      const latest = latestPrimaryClaim(exactPrimary, request, today);
      if (latest?.key) return { kind: 'primary_exact' as const, factKey: latest.key,
        reason: latest.hits.some(currentReleaseIndex) ? 'latest_primary_index' as const
          : 'latest_primary_dated' as const,
        hits: rankedEvidence(latest.hits.map((hit) => ({ ...hit,
          evidenceLevel: hit.verifiedPage ? 'primary_page' as const : 'primary_search' as const,
          evidenceBundle: 'primary_exact' as const })), request, today) };
      // The dated primary claim is authentic but not sufficient for "latest".
      // Let independent current evidence be assessed below (and otherwise fall back).
    } else {
      const highestStrength = Math.max(...exactPrimary.map(evidenceStrength));
      const strongest = exactPrimary.filter((hit) => evidenceStrength(hit) === highestStrength);
      const keys = new Set(strongest.map((hit) => freshFactKey(claimText(hit), request)));
      const ordered = rankedEvidence(strongest, request, today);
      // A live/evergreen official status page may supersede an older release note,
      // but equally strong contradictory official claims remain unresolved.
      const preferred = keys.size > 1 && ordered.length > 1
        && evergreenSource(ordered[0]) && !evergreenSource(ordered[1])
        && evidenceScore(ordered[0], request, today) - evidenceScore(ordered[1], request, today) >= 6
        ? freshFactKey(claimText(ordered[0]), request) : null;
      if (keys.size === 1 || preferred) {
        const key = preferred ?? [...keys][0];
        return { kind: 'primary_exact' as const, factKey: key,
          hits: rankedEvidence(strongest.filter((hit) => freshFactKey(claimText(hit), request) === key)
            .map((hit) => ({ ...hit, evidenceLevel: hit.verifiedPage ? 'primary_page' as const
              : 'primary_search' as const, evidenceBundle: 'primary_exact' as const })), request, today) };
      }
      return { kind: 'insufficient' as const, factKey: null, hits: [] as WebSearchHit[] };
    }
  }
  const structured = /\b(?:version|release|price|cost|availability|stock|status)\b|(?:إصدار|اصدار|نسخة|سعر|متاح|متوفر)/iu.test(request);
  if (!structured) {
    const supported = rankedEvidence(primary.filter((hit) => supportsPrimaryPage(hit, request, today)), request, today);
    if (supported.length) return { kind: 'primary_exact' as const, factKey: null,
      hits: supported.map((hit) => ({ ...hit, evidenceLevel: hit.verifiedPage ? 'primary_page' as const
        : 'primary_search' as const, evidenceBundle: 'primary_exact' as const })) };
  }
  // A major Current status is not an exact release. It can support, but never invent,
  // an exact value consistently reported by independent sources.
  const major = /\bversion\b|\brelease\b|(?:إصدار|اصدار|نسخة)/iu.test(request)
    ? currentSeries : null;
  const recentSecondary = candidates.filter((hit) => !likelyPrimarySource(hit, request)
    && (!hit.publishedAt || Date.parse(hit.publishedAt) >= Date.parse(today) - 180 * 86_400_000));
  const groups = new Map<string, WebSearchHit[]>();
  for (const hit of recentSecondary) {
    const key = freshFactKey(`${hit.title} ${hit.description}`, request);
    if (key) groups.set(key, [...(groups.get(key) ?? []), hit]);
  }
  const independent = [...groups].map(([key, group]) => {
    const domains = new Set<string>();
    return { key, hits: group.filter((hit) => {
      const domain = independentDomain(hit);
      if (domains.has(domain)) return false;
      domains.add(domain); return true;
    }) };
  });
  // An official Current series is an eligibility boundary, not just a final
  // ranking hint. A corroborated future/other-series claim cannot veto it.
  const supported = independent.filter((group) => group.hits.length >= 2
    && (!major || group.key === `version:current:${major}`
      || group.key.startsWith(`version:current:${major}.`)));
  if (!supported.length)
    return { kind: 'insufficient' as const, factKey: null, hits: [] as WebSearchHit[] };
  const sameMajorSemver = (key: string) => {
    const match = key.match(/^version:current:(\d+)\.(\d+)\.(\d+)$/);
    return match && match[1] === major ? match.slice(1).map(Number) : null;
  };
  const undatedSemverTie = Boolean(latestVersionRequest(request) && major && supported.length > 1
    && supported.every((group) => sameMajorSemver(group.key)
      && group.hits.every((hit) => !hit.publishedAt)));
  const latestDate = (group: typeof supported[number]) => Math.max(...group.hits
    .map((hit) => hit.publishedAt ? Date.parse(hit.publishedAt) : NaN).filter(Number.isFinite));
  const ordered = [...supported].sort((a, b) => {
    if (undatedSemverTie) {
      const left = sameMajorSemver(a.key)!; const right = sameMajorSemver(b.key)!;
      return right[0] - left[0] || right[1] - left[1] || right[2] - left[2];
    }
    return latestDate(b) - latestDate(a);
  });
  // Release history naturally contains several once-current values. A newer,
  // dated, independently corroborated group can supersede historical groups;
  // near-contemporaneous claims remain unresolved rather than using version size.
  if (ordered.length > 1 && !undatedSemverTie && (!Number.isFinite(latestDate(ordered[0]))
    || latestDate(ordered[0]) < Date.parse(today) - 30 * 86_400_000
    || ordered.slice(1).some((group) => !Number.isFinite(latestDate(group))
      ? false : latestDate(group) >= latestDate(ordered[0]) - 2 * 86_400_000)))
    return { kind: 'insufficient' as const, factKey: null, hits: [] as WebSearchHit[],
      reason: 'materially_unresolved_conflict' as const };
  const agreed = ordered[0];
  const agreedLatest = Math.max(...agreed.hits.map((hit) => hit.publishedAt ? Date.parse(hit.publishedAt) : NaN)
    .filter(Number.isFinite));
  // A lone undated or older snippet cannot veto a newer independent bundle;
  // an equally recent competing value remains materially unresolved.
  if (!undatedSemverTie && independent.some((group) => group.key !== agreed.key
    && (!major || group.key === `version:current:${major}`
      || group.key.startsWith(`version:current:${major}.`)) && group.hits.some((hit) => {
    const date = hit.publishedAt ? Date.parse(hit.publishedAt) : NaN;
    return !Number.isFinite(agreedLatest) || (Number.isFinite(date)
      && date >= agreedLatest - 2 * 86_400_000);
  }))) return { kind: 'insufficient' as const, factKey: null, hits: [] as WebSearchHit[],
    reason: 'materially_unresolved_conflict' as const };
  if (major) {
    if (agreed.key !== `version:current:${major}` && !agreed.key.startsWith(`version:current:${major}.`))
      return { kind: 'insufficient' as const, factKey: null, hits: [] as WebSearchHit[] };
    const official = rankedEvidence(primary.filter((hit) =>
      currentMajor(`${hit.title} ${hit.description}`) === major), request, today)[0];
    if (!official) return { kind: 'insufficient' as const, factKey: null, hits: [] as WebSearchHit[] };
    return { kind: 'primary_supported_bundle' as const, factKey: agreed.key,
      reason: undatedSemverTie ? 'latest_supported_semver' as const
        : independent.length > 1 ? 'historical_claims_superseded' as const
        : 'latest_supported_bundle' as const,
      hits: [official, ...rankedEvidence(agreed.hits, request, today).slice(0, 2)].map((hit) => ({ ...hit,
        evidenceLevel: likelyPrimarySource(hit, request) ? hit.verifiedPage ? 'primary_page' as const
          : 'primary_search' as const : 'primary_bundle' as const,
        evidenceBundle: 'primary_supported_bundle' as const })) };
  }
  return { kind: 'corroborated_exact' as const, factKey: agreed.key,
    reason: independent.length > 1 ? 'historical_claims_superseded' as const
      : 'latest_exact_selected' as const,
    hits: rankedEvidence(agreed.hits, request, today).slice(0, 3).map((hit) => ({ ...hit,
      evidenceLevel: 'corroborated' as const, evidenceBundle: 'corroborated_exact' as const })) };
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
  if (evidenceModeForRequest(request) !== 'structured_fact' && !rawResultsRequested(request)) {
    const citations = selected.slice(0, 3).map((hit) =>
      `[${plainExcerpt(hit.title, 180).replace(/[\[\]]/g, '')}](${safeUrl(hit.url)})${hit.publishedAt ? ` (${hit.publishedAt})` : ''}`);
    const cautious = locale === 'ar' ? `هذه مصادر ذات صلة بالسؤال؛ لا أستطيع تأكيد تفاصيل إضافية من مقتطفاتها وحدها: ${citations.join(' ')}`
      : locale === 'fr' ? `Voici des sources pertinentes ; leurs extraits seuls ne permettent pas de confirmer davantage de détails : ${citations.join(' ')}`
        : `These sources are relevant, but their excerpts alone do not confirm further details: ${citations.join(' ')}`;
    return [notice, cautious].filter(Boolean).join(' ');
  }
  if (hits[0]?.evidenceBundle === 'primary_supported_bundle') {
    const exact = hits.find((hit) => hit.evidenceLevel === 'primary_bundle');
    const official = hits.find((hit) => likelyPrimarySource(hit, request));
    const reported = hits.filter((hit) => hit.evidenceLevel === 'primary_bundle').slice(0, 2);
    const fact = exact ? freshFactKey(`${exact.title} ${exact.description}`, request) : null;
    const value = fact?.startsWith('version:current:') ? fact.slice('version:current:'.length) : null;
    if (value && official && reported.length === 2) {
      const cite = (hit: WebSearchHit) => `[${plainExcerpt(hit.title, 180).replace(/[\[\]]/g, '')}](${safeUrl(hit.url)})`;
      const sources = [cite(official), ...reported.map(cite)].join(' ');
      const direct = locale === 'ar'
        ? `تشير الأدلة إلى أن إصدار Current هو ${value}؛ يؤكد المصدر الرسمي السلسلة الحالية، ويتفق مصدران مستقلان على الإصدار الدقيق. ${sources}`
        : locale === 'fr'
          ? `La version Current semble être ${value} : la source officielle confirme la série actuelle et deux sources indépendantes concordent sur la version précise. ${sources}`
          : `The Current release appears to be ${value}: the official source confirms the current major series, and two independent sources agree on the exact release. ${sources}`;
      return [notice, direct].filter(Boolean).join(' ');
    }
  }
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
  const allowed = new Set(hits.map((hit) => canonicalSearchUrl(hit.url)).filter(Boolean));
  const cited = [...answer.matchAll(/https?:\/\/[^\s)\]>"']+/g)]
    .map((match) => canonicalSearchUrl(match[0].replace(/[.,;!?]+$/, '')));
  if (!cited.length || cited.some((url) => !url || !allowed.has(url))) return false;
  return true;
}

/** Content-free rejection reason for the existing same-call synthesis guard. */
export function searchSynthesisRejectionReason(answer: string, hits: readonly WebSearchHit[], request: string,
  now: Date, language: ResponseLanguage) {
  const mode = evidenceModeForRequest(request);
  const trimmed = answer.trim();
  if (!trimmed || trimmed.length > 4_000 || rawResultsRequested(request)) return 'invalid_answer';
  if (needsFreshEvidence(request) && !hits.some((hit) => evidenceStrength(hit))) return 'insufficient_evidence';
  if (!answerUsesOnlySearchSources(trimmed, hits, request, now)) return 'unsupported_url';
  const withoutLinks = trimmed.replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g, ' ');
  if (language === 'ar' && (withoutLinks.match(/[\u0600-\u06ff]/gu) ?? []).length < 3) return 'wrong_language';
  if (resolveResponseLanguage(withoutLinks, [], 'en') !== language) return 'wrong_language';
  if (/^(?:according to (?:the )?(?:retrieved |available )?sources|here are (?:the )?(?:search )?results|d'après les sources|وفق المصادر)/iu.test(trimmed)) return 'raw_results';
  if (mode === 'structured_fact' && /^\s*(?:[-*]|\d+\.)\s/mu.test(trimmed)) return 'raw_results';
  const cited = [...trimmed.matchAll(/https?:\/\/[^\s)\]>"']+/g)];
  if (cited.length > 3) return 'too_many_citations';
  const citations = [...trimmed.matchAll(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g)];
  if (citations.length !== cited.length || citations.some(([, label, url]) => !hits.some((hit) =>
    canonicalSearchUrl(hit.url) === canonicalSearchUrl(url) && (mode !== 'structured_fact'
      || label === plainExcerpt(hit.title, 180).replace(/[\[\]]/g, ''))))) return 'unsupported_url';
  if (mode === 'structured_fact' && hits[0]?.evidenceBundle === 'primary_supported_bundle' && (citations.length < 3
    || hits.filter((hit) => hit.evidenceLevel === 'primary_bundle'
      && citations.some(([, , url]) => canonicalSearchUrl(hit.url) === canonicalSearchUrl(url))).length < 2)) return 'insufficient_citations';
  if (mode === 'structured_fact' && hits[0]?.evidenceBundle === 'corroborated_exact' && (citations.length < 2
    || !/(?:independent sources|sources indépendantes|مصدران مستقلان|مصادر مستقلة)/iu.test(trimmed))) return 'insufficient_citations';
  if (mode === 'fresh_news' && !hits.some((hit) => likelyPrimarySource(hit, request))
    && new Set(citations.map(([, , url]) => canonicalSearchUrl(url))).size < 2) return 'insufficient_citations';
  if (mode === 'structured_fact' && hits.some((hit) => likelyPrimarySource(hit, request))
    && !citations.some(([, , url]) => hits.some((hit) => canonicalSearchUrl(hit.url) === canonicalSearchUrl(url)
      && likelyPrimarySource(hit, request)))) return 'insufficient_citations';
  const citedHits = hits.filter((hit) => citations.some(([, , url]) =>
    canonicalSearchUrl(hit.url) === canonicalSearchUrl(url)));
  const allowedNumbers = new Set(citedHits.flatMap((hit) => `${mode === 'structured_fact' && needsFreshEvidence(request)
    && hit.evidenceLevel !== 'primary_search' ? '' : hit.title} ${hit.description} ${hit.publishedAt ?? ''}`
    .match(/\b\d+(?:[.\-]\d+)*\b/g) ?? []));
  if ((withoutLinks.match(/\b\d+(?:[.\-]\d+)*\b/g) ?? []).some((value) => !allowedNumbers.has(value))) return 'unsupported_number';
  if (mode === 'structured_fact' && needsFreshEvidence(request)
    && /\bversion\b|(?:إصدار|اصدار|نسخة)/iu.test(request)) {
    const current = rankedEvidence(hits, request, localDate(now))
      .map((hit) => evidenceStrength(hit) ? labeledVersion(factText(hit), 'current') : null).find(Boolean);
    if (current && !withoutLinks.includes(current)) return 'structured_claim_mismatch';
  }
  if (hits.some((hit) => { const excerpt = plainExcerpt(hit.description, 400); return excerpt.length >= 24
    && withoutLinks.toLowerCase().includes(excerpt.toLowerCase()); })) return 'copied_excerpt';
  const claims = withoutLinks.split(/(?<=[.!?؟])\s+/u).map((sentence) => sentence.trim().toLowerCase())
    .filter((sentence) => sentence.length > 25);
  if (new Set(claims).size !== claims.length) return 'duplicate_claim';
  return null;
}

/** Reject unsupported citations, copied snippets, unverified numbers, and wrong-language answers. */
export function usableSearchSynthesis(answer: string, hits: readonly WebSearchHit[], request: string,
  now: Date, language: ResponseLanguage) {
  return searchSynthesisRejectionReason(answer, hits, request, now, language) === null;
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
  const rejectionReason = searchSynthesisRejectionReason(modelAnswer, hits, request, now, locale);
  if (rejectionReason === null) {
    console.info('WEB_SEARCH_ANSWER', { citationsCount: [...modelAnswer.matchAll(/\]\(https:\/\//g)].length,
      synthesisAccepted: true });
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  }
  const fallbackAnswer = groundedSearchSummary(hits, request, now, locale);
  console.info('WEB_SEARCH_ANSWER', { citationsCount: [...fallbackAnswer.matchAll(/\]\(https:\/\//g)].length,
    synthesisAccepted: false, rejectionReason });
  const replacement = `0:${JSON.stringify(fallbackAnswer)}`;
  const next: string[] = []; let inserted = false;
  for (const line of lines) {
    if (line.startsWith('0:')) { if (!inserted) { next.push(replacement); inserted = true; } continue; }
    next.push(line);
  }
  if (!inserted) next.unshift(replacement);
  const headers = new Headers(response.headers); headers.delete('content-length');
  return new Response(`${next.join('\n')}\n`, { status: response.status, statusText: response.statusText, headers });
}
