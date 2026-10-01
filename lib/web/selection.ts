import type { SearchTurnContext, SearchSubjectContext } from './search-context';
import { driverRequestScope, driverScopeRefinement } from './driver-scope';

/** Hard decisions stay deterministic; ambiguous factual turns may use the selected model's tool. */
export type WebContextTool = { kind: 'read_url'; url: string } | { kind: 'web_search'; query: string };
export type SearchDecision = { path: 'none' | 'optional' } | { path: 'required'; tool: WebContextTool };

export type EvidenceMode = 'structured_fact' | 'fresh_news' | 'general_web';
export type CurrentInformationPolicy = { decision: SearchDecision; fresh: boolean; mode: EvidenceMode;
  exactFact: 'version' | 'price' | 'availability' | null };

export function requestTimeframe(request: string) {
  return request.match(/\b(?:today|yesterday|this week|last week|past week|last \d+ days|cette semaine|la semaine dernière|aujourd'hui|hier)\b|(?:اليوم|أمس|امس|هذا الأسبوع|هذا الاسبوع|الأسبوع الماضي|الاسبوع الماضي|اخر اسبوع|آخر أسبوع|(?:آخر|اخر) \d+ (?:أيام|ايام))/iu)?.[0].slice(0, 80) ?? '';
}

export function searchSubject(request: string) {
  const timeframe = requestTimeframe(request);
  return (timeframe ? request.replace(timeframe, ' ') : request).replace(/\s+/g, ' ').trim().slice(0, 300);
}

const sensitiveInput = /(?:sb_secret_[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{16,}|\bBearer\s+[A-Za-z0-9._-]{16,}|\b(?:API_KEY|CLIENT_SECRET|REFRESH_TOKEN)\s*[:=]\s*\S+)/i;
const noWeb = /\b(?:do not|don't|without|never)\s+(?:(?:use|do)\s+)?(?:web|internet|online|search|browse|look up|read|open|visit)\b|(?:بدون|بلا)\s+(?:بحث|البحث|انترنت|إنترنت|الإنترنت|نت)|(?:لا|ما)\s+(?:تبحث|تبحثش|تستخدم)\s+(?:في\s+)?(?:النت|الإنترنت|الانترنت)|\bsans\s+(?:recherche|internet|web)|\bne\s+(?:cherche|recherche|navigue)\s+pas\b/iu;
const freshness = /\b(?:latest|current|currently|recent|now|today|yesterday|this week|last week|past week|last 7 days|newest|live|aujourd'hui|hier|cette semaine|semaine dernière|actuel|actuelle|récent|récente|dernier|dernière|derniers|dernières|maintenant)\b|(?:آخر|اخر|أحدث|احدث|حالي|الحالي|الآن|الان|اليوم|أمس|امس|هذا الأسبوع|هذا الاسبوع|الأسبوع الماضي|الاسبوع الماضي|آخر أسبوع|اخر اسبوع|آخر 7 أيام|اخر 7 ايام)/iu;
const dynamicSubject = /\b(?:news|developments|updates|prices?|availability|stocks?|market|weather|forecast|scores?|results?|schedule|versions?|releases?|released|drivers?|models?|providers?|information|president|ceo|office holder|law|policy|rules|status|product launch|model launch|actualités|nouvelles|prix|disponibilité|météo|résultats|sorties?|modèles?|pilotes?|président|actualité)\b|(?:أخبار|اخبار|مستجدات|تطورات|نماذج|نموذج|تعريفات|مزود|معلومات|سعر|الأسعار|الاسعار|متوفر|متاح|إصدار|اصدار|نسخة|نتيجة|نتائج|طقس|بورصة|أسهم|اسهم|رئيس|قانون|قوانين|حالة)/iu;
const inherentlyCurrent = /\b(?:news|headlines|what happened|actualités|actualité|weather|forecast|météo|prices?|prix|availability|disponibilité|stock price|market price|sports score)\b|(?:أخبار|اخبار|مستجدات|تطورات|ماذا حدث|طقس|بورصة|سعر|الأسعار|الاسعار|متوفر|متاح)/iu;
const temporalOnly = /^(?:(?:آخر|اخر|هذا)\s+(?:الأسبوع|الاسبوع|أسبوع|اسبوع)|(?:آخر|اخر)\s+7\s+(?:أيام|ايام)|(?:last|past|this)\s+week|last\s+7\s+days|cette\s+semaine|la\s+semaine\s+dernière)\s*[؟?!.,]*$/iu;
const confirmation = /^(?:هل أنت متأكد|هل انت متأكد|تأكد|تاكد|تحقق مرة أخرى|تحقق مره اخرى|are you sure|verify that|really|es-tu sûr|es tu sur)\s*[؟?!.,]*$/iu;
function isConfirmation(request: string) {
  // Equivalent short verification clauses may be combined; no new subject is
  // inherited unless every clause is itself a recognized verification request.
  const clauses = request.trim().split(/[؟?!.;]+/u).map((value) => value.trim()).filter(Boolean);
  return clauses.length > 0 && clauses.length <= 3 && clauses.every((value) => confirmation.test(value));
}
const moreResults = /^(?:(?:اعطني|أعطني|هات|ارني|أرني)\s+(?:باقي|المزيد من)\s+(?:النتائج|الأخبار|الاخبار)(?:\s+من فضلك)?|(?:(?:show|give)(?: me)? )?(?:more|remaining|other) (?:results|news|examples)|(?:montre|donne)(?:-moi)? (?:les autres|plus de|le reste des) (?:résultats|actualités))\s*[؟?!.,]*$/iu;
const transformation = /^(?:write|rewrite|draft|translate|summari[sz]e|calculate|solve|create|compose|code|explain)\b|^(?:اكتب|أعد صياغة|ترجم|لخص|احسب|أنشئ|اشرح)(?=\s|$)|^(?:écris|rédige|traduis|résume|calcule|explique)\b/iu;

/** Resolve explicit anaphora, not a catalogue of follow-up sentence prefixes.
 * This only carries a subject; observations must be acquired again for this turn.
 */
function referencesPreviousSubject(text: string) {
  return text.length <= 300 && (
    /\b(?:this|that|these|those)\s+(?:version|release|model|product|service|database|driver|company|option|result|announcement)s?\b/iu.test(text)
    || /\b(?:its|their)\s+(?:price|cost|features|support|availability|requirements|changes)\b/iu.test(text)
    || /\b(?:cette|ce|ces)\s+(?:version|modèle|produit|service|pilote|entreprise|option|résultat)s?\b/iu.test(text)
    || /(?:هذا|هذه|ذلك|تلك)\s+(?:الإصدار|الاصدار|النسخة|النموذج|المنتج|الخدمة|التعريف|الشركة|الخيار|النتيجة|النتائج)/u.test(text)
  );
}

export function selectWebContextTool(request: string): WebContextTool | null {
  const text = request.slice(0, 800).trim();
  if (noWeb.test(text) || sensitiveInput.test(text)) return null;
  const url = text.match(/https?:\/\/[^\s<>"']+/i)?.[0].replace(/[),.;!?\]}]+$/, '');
  if (url && (/^(?:(?:please|can you|could you)\s+)*(?:read|open|visit|summari[sz]e|analy[sz]e)\b/i.test(text)
    || /^(?:create|build|make|write)\b[^\n]{0,240}\b(?:from|using|based on)\b/i.test(text)
    || /^(?:اقرأ|افتح|لخص|حلل|أنشئ|اصنع)(?:\s|$)/u.test(text)
    || /^(?:lis|lisez|ouvre|ouvrez|résume|résumez|analyse|analysez|crée|créez)\b/iu.test(text))) {
    return { kind: 'read_url', url };
  }
  const match = text.match(/^(?:(?:please|can you|could you)\s+)*(?:search (?:the )?web|search online|browse (?:the )?web|look up online)\s+(?:for\s+)?(.+)$/i)
    ?? text.match(/^(?:(?:please|can you|could you)\s+)*search\s+(?:for\s+)?(.+)$/i)
    ?? text.match(/^(?:recherche|recherchez|cherche|cherchez)\s+(?:sur (?:le )?web|en ligne)\s+(.+)$/iu)
    ?? text.match(/^(?:recherche|recherchez|cherche|cherchez)\s+(.+)$/iu)
    ?? text.match(/^(?:ابحث|بحث)\s+(?:في الويب|على الويب|في الإنترنت|على الإنترنت)\s+(?:عن\s+)?(.+)$/u)
    ?? text.match(/^(?:ابحث|بحث)\s+(?:لي\s+)?عن\s+(.+)$/u);
  const query = match?.[1]?.trim();
  if (query && query.length <= 300 && !/https?:\/\//i.test(query)) return { kind: 'web_search', query };
  if (/^(?:(?:شوفلي|دورلي|لقيلي|فتشلي|تأكد من|تاكد من|تحقق من)(?=\s|$)|(?:check (?:online|the web)|verify (?:online|on the web)|look up|vérifie|vérifier|cherche sur internet)\b)/iu.test(text)
    && text.length <= 300 && !/https?:\/\//i.test(text)) return { kind: 'web_search', query: text };
  return null;
}

/** Deterministic fast path. Optional cases are decided by the selected Chat model, never a classifier. */
function searchDecision(request: string): SearchDecision {
  const text = request.slice(0, 800).trim();
  if (!text || noWeb.test(text) || sensitiveInput.test(text)) return { path: 'none' };
  const explicit = selectWebContextTool(text);
  if (explicit) return { path: 'required', tool: explicit };
  // An exact URL is handled by the URL reader only when explicitly requested; never search it by accident.
  if (/https?:\/\//i.test(text)) return { path: 'none' };
  if (isConfirmation(text) || /^(?:hi|hello|hey|bonjour|salut|مرحبا|سلام)\s*[!.,؟]*$/iu.test(text))
    return { path: 'none' };
  const freshSubject = freshness.test(text) && !temporalOnly.test(text) && dynamicSubject.test(text);
  if (transformation.test(text) && !freshSubject && !/\b(?:research|search|browse|online|web)\b|(?:ابحث|بحث|تحقق من الإنترنت)/iu.test(text))
    return { path: 'none' };
  if ((freshness.test(text) && !temporalOnly.test(text))
    || inherentlyCurrent.test(text) || /(?:الأسعار الحالية|السعر الحالي)/iu.test(text))
    return { path: 'required', tool: { kind: 'web_search', query: text.slice(0, 300) } };
  // The selected Chat model decides ambiguous factual turns using its native
  // web tool, if this route actually supports tools. No separate AI call.
  return { path: 'optional' };
}

/** The sole current-information classification used by activation, retrieval and validation. */
export function currentInformationPolicy(request: string): CurrentInformationPolicy {
  const decision = searchDecision(request);
  const fresh = decision.path !== 'none' && (freshness.test(request) || inherentlyCurrent.test(request));
  const news = /\b(?:news|headlines|developments|what happened|events|announcements|annonces|événements|actualit[ée]s|nouvelles)\b|(?:أخبار|اخبار|مستجدات|تطورات|أحداث|احداث|إعلانات|اعلانات|ماذا حدث)/iu.test(request);
  const exactFact = /\b(?:version|release|driver|pilote|version actuelle)\b|(?:إصدار|اصدار|نسخة|تعريف)/iu.test(request)
    ? 'version' : /\b(?:price|prices|cost|prix)\b|(?:سعر|الأسعار|الاسعار)/iu.test(request)
      ? 'price' : /\b(?:availability|stock|status|disponibilit[ée])\b|(?:متاح|متوفر|توفر|الحالة)/iu.test(request)
        ? 'availability' : null;
  return { decision, fresh, exactFact, mode: !fresh ? 'general_web' : news ? 'fresh_news'
    : exactFact ? 'structured_fact' : 'general_web' };
}

export function decideWebSearch(request: string): SearchDecision {
  return currentInformationPolicy(request).decision;
}

/** Subject continuity is independent of whether the preceding answer was verified. */
export function decideWebSearchWithHistory(current: string,
  previous: readonly { role: string; content: string }[], trustedContext?: SearchTurnContext | SearchSubjectContext | null): { decision: SearchDecision; evidenceRequest: string;
    seenSourceUrls?: string[]; contextSubject?: string } {
  const decision = decideWebSearch(current);
  // Inherit only a short contextual refinement of the immediately preceding owned turn.
  // The context is loaded by execution ID + authenticated owner, never accepted from the browser.
  const text = current.trim();
  const verifyReference = text.length <= 160
    && /\b(?:verify|check|vérifie|vérifier|vérifiez)\b|تحقق|تأكد|تاكد/iu.test(text)
    && /\b(?:this|that|these|those|again|ces|cela|ça|nouveau)\b|هذا|هذه|ذلك|تلك|مرة أخرى/iu.test(text);
  const contextual = isConfirmation(text) || verifyReference || temporalOnly.test(text) || moreResults.test(text)
    || referencesPreviousSubject(text)
    || !!driverRequestScope(trustedContext?.subject ?? '') && driverScopeRefinement(text)
    || text.length <= 160 && /^(?:and (?:what about|how about|is it|does it|which one)\b|what about (?:it|that|its|weekends)\b|is it\b|does it\b|which (?:one|of them)\b|compare (?:them|these)\b|et (?:lequel|laquelle|est-il|est-ce)\b|lequel\b|laquelle\b|est-il\b|est-ce\b|وهل|هل هو|هل هي|وكم|ومتى|وأيهما|قارن بينها)(?=\s|$)/iu.test(text);
  if (trustedContext && contextual && !noWeb.test(current) && !sensitiveInput.test(current)) {
    const subject = searchSubject(trustedContext.subject);
    const refinement = isConfirmation(text) || verifyReference ? requestTimeframe(text) || trustedContext.timeframe
      : temporalOnly.test(text) ? text : `${trustedContext.timeframe} ${text}`.trim();
    const evidenceRequest = `${subject.slice(0, Math.max(1, 299 - refinement.length))} ${refinement}`.trim();
    return { decision: trustedContext.fresh || isConfirmation(text) || moreResults.test(text)
        ? { path: 'required', tool: { kind: 'web_search', query: evidenceRequest } } : { path: 'optional' },
      evidenceRequest, contextSubject: driverScopeRefinement(text) ? evidenceRequest : subject,
      seenSourceUrls: moreResults.test(text) && 'sourceUrls' in trustedContext ? trustedContext.sourceUrls : undefined };
  }
  if (noWeb.test(current) || sensitiveInput.test(current) || !contextual)
    return { decision, evidenceRequest: current };
  const lastUser = [...previous].reverse().findIndex((message) => message.role === 'user');
  if (lastUser < 0) return { decision, evidenceRequest: current };
  let index = previous.length - 1 - lastUser;
  let inheritedTimeframe = '';
  // Consecutive confirmation/refinement turns (including failed ones) are not
  // new subjects. Walk only that bounded contiguous chain, never past a new topic.
  for (let scanned = 0; scanned < 8; scanned++) {
    const prior = previous[index].content.trim();
    if (!isConfirmation(prior) && !temporalOnly.test(prior) && !moreResults.test(prior)
      && !referencesPreviousSubject(prior)) break;
    if (!inheritedTimeframe && temporalOnly.test(prior)) inheritedTimeframe = prior;
    let next = index - 1;
    while (next >= 0 && previous[next].role !== 'user') next--;
    if (next < 0) break;
    index = next;
  }
  const earlier = inheritedTimeframe ? `${searchSubject(previous[index].content)} ${inheritedTimeframe}`
    : previous[index].content;
  const answeredText = previous.slice(index + 1).filter((message) => message.role === 'assistant')
    .map((message) => message.content).join('\n');
  const seenSourceUrls = [...answeredText.matchAll(/\]\((https:\/\/[^)\s]+)\)/g)]
    .map((match) => match[1]).slice(0, 16);
  const earlierDecision = decideWebSearch(earlier);
  const priorWebSubject = earlierDecision.path === 'required' && earlierDecision.tool.kind === 'web_search'
    || moreResults.test(current.trim()) && earlierDecision.path === 'optional'
      && freshness.test(earlier) && seenSourceUrls.length > 0;
  if (!priorWebSubject)
    return { decision: isConfirmation(current) ? { path: 'none' } : decision,
      evidenceRequest: current };
  if (isConfirmation(current)) return { decision: earlierDecision, evidenceRequest: earlier };
  if (moreResults.test(current.trim())) {
    const evidenceRequest = `${earlier} ${current.trim()}`.trim().slice(0, 300);
    return { decision: { path: 'required', tool: { kind: 'web_search', query: evidenceRequest } },
      evidenceRequest, seenSourceUrls };
  }
  const subject = earlier.replace(/\b(?:today|yesterday|this week|last week|past week|last 7 days|aujourd'hui|hier|cette semaine|semaine dernière)\b|(?:اليوم|أمس|امس|هذا الأسبوع|هذا الاسبوع|الأسبوع الماضي|الاسبوع الماضي|آخر 7 أيام|اخر 7 ايام)/giu, ' ')
    .replace(/\s+/g, ' ').trim();
  const evidenceRequest = `${subject} ${current.trim()}`.trim().slice(0, 300);
  return { decision: { path: 'required', tool: { kind: 'web_search', query: evidenceRequest } },
    evidenceRequest };
}
