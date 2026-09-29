/** Hard decisions stay deterministic; ambiguous factual turns may use the selected model's tool. */
export type WebContextTool = { kind: 'read_url'; url: string } | { kind: 'web_search'; query: string };
export type SearchDecision = { path: 'none' | 'optional' } | { path: 'required'; tool: WebContextTool };

const sensitiveInput = /(?:sb_secret_[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{16,}|\bBearer\s+[A-Za-z0-9._-]{16,}|\b(?:API_KEY|CLIENT_SECRET|REFRESH_TOKEN)\s*[:=]\s*\S+)/i;
const noWeb = /\b(?:do not|don't|without|never)\s+(?:(?:use|do)\s+)?(?:web|internet|online|search|browse|look up|read|open|visit)\b|(?:بدون|بلا)\s+(?:بحث|البحث|انترنت|إنترنت|الإنترنت|نت)|(?:لا|ما)\s+(?:تبحث|تبحثش|تستخدم)\s+(?:في\s+)?(?:النت|الإنترنت|الانترنت)|\bsans\s+(?:recherche|internet|web)|\bne\s+(?:cherche|recherche|navigue)\s+pas\b/iu;
const freshness = /\b(?:latest|current|currently|recent|now|today|yesterday|this week|last week|past week|last 7 days|newest|live|aujourd'hui|hier|cette semaine|semaine dernière|actuel|actuelle|récent|récente|dernier|dernière|derniers|dernières|maintenant)\b|(?:آخر|اخر|أحدث|احدث|حالي|الحالي|الآن|الان|اليوم|أمس|امس|هذا الأسبوع|هذا الاسبوع|الأسبوع الماضي|الاسبوع الماضي|آخر أسبوع|اخر اسبوع|آخر 7 أيام|اخر 7 ايام)/iu;
const dynamicSubject = /\b(?:news|developments|updates|price|prices|availability|stock|stocks|market|weather|forecast|score|scores|results|schedule|version|release|released|president|ceo|office holder|law|policy|rules|status|product launch|model launch|actualités|nouvelles|prix|disponibilité|météo|résultats|version|sortie|président|actualité)\b|(?:أخبار|اخبار|مستجدات|تطورات|سعر|الأسعار|الاسعار|متوفر|متاح|إصدار|اصدار|نسخة|نتيجة|نتائج|طقس|بورصة|أسهم|اسهم|رئيس|قانون|قوانين|حالة)/iu;
const inherentlyCurrent = /\b(?:news|headlines|actualités|actualité|weather|forecast|météo|stock price|market price|sports score)\b|(?:أخبار|اخبار|مستجدات|تطورات|طقس|بورصة)/iu;
const temporalOnly = /^(?:(?:آخر|اخر|هذا)\s+(?:الأسبوع|الاسبوع|أسبوع|اسبوع)|(?:آخر|اخر)\s+7\s+(?:أيام|ايام)|(?:last|past|this)\s+week|last\s+7\s+days|cette\s+semaine|la\s+semaine\s+dernière)\s*[؟?!.,]*$/iu;
const confirmation = /^(?:هل أنت متأكد|هل انت متأكد|تأكد|تاكد|تحقق مرة أخرى|تحقق مره اخرى|are you sure|verify that|really|es-tu sûr|es tu sur)\s*[؟?!.,]*$/iu;
const transformation = /^(?:write|rewrite|draft|translate|summari[sz]e|calculate|solve|create|compose|code|explain)\b|^(?:اكتب|أعد صياغة|ترجم|لخص|احسب|أنشئ|اشرح)(?=\s|$)|^(?:écris|rédige|traduis|résume|calcule|explique)\b/iu;

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
export function decideWebSearch(request: string): SearchDecision {
  const text = request.slice(0, 800).trim();
  if (!text || noWeb.test(text) || sensitiveInput.test(text)) return { path: 'none' };
  const explicit = selectWebContextTool(text);
  if (explicit) return { path: 'required', tool: explicit };
  // An exact URL is handled by the URL reader only when explicitly requested; never search it by accident.
  if (/https?:\/\//i.test(text)) return { path: 'none' };
  if (confirmation.test(text) || /^(?:hi|hello|hey|bonjour|salut|مرحبا|سلام)\s*[!.,؟]*$/iu.test(text))
    return { path: 'none' };
  if (transformation.test(text) && !/\b(?:research|search|browse|online|web)\b|(?:ابحث|بحث|تحقق من الإنترنت)/iu.test(text))
    return { path: 'none' };
  if ((freshness.test(text) && !temporalOnly.test(text)
    && (dynamicSubject.test(text) || /\b(?:what|who|which|when|where|how|is|are|did|happened)\b|(?:ما|من|ماذا|هل|كيف|متى|وش)/iu.test(text)))
    || inherentlyCurrent.test(text) || /(?:الأسعار الحالية|السعر الحالي)/iu.test(text))
    return { path: 'required', tool: { kind: 'web_search', query: text.slice(0, 300) } };
  // The selected Chat model decides ambiguous factual turns using its native
  // web tool, if this route actually supports tools. No separate AI call.
  return { path: 'optional' };
}

/** A confirmation question inherits only the immediately preceding answered fresh-web question. */
export function decideWebSearchWithHistory(current: string,
  previous: readonly { role: string; content: string }[]): { decision: SearchDecision; evidenceRequest: string } {
  const decision = decideWebSearch(current);
  if (noWeb.test(current) || (!confirmation.test(current.trim()) && !temporalOnly.test(current.trim())))
    return { decision, evidenceRequest: current };
  const lastUser = [...previous].reverse().findIndex((message) => message.role === 'user');
  if (lastUser < 0) return { decision, evidenceRequest: current };
  const index = previous.length - 1 - lastUser;
  const earlier = previous[index].content;
  const answered = previous.slice(index + 1).some((message) => message.role === 'assistant' && message.content.trim());
  const earlierDecision = decideWebSearch(earlier);
  if (!answered || earlierDecision.path !== 'required' || earlierDecision.tool.kind !== 'web_search')
    return { decision: confirmation.test(current.trim()) ? { path: 'none' } : decision,
      evidenceRequest: current };
  if (confirmation.test(current.trim())) return { decision: earlierDecision, evidenceRequest: earlier };
  const subject = earlier.replace(/\b(?:today|yesterday|this week|last week|past week|last 7 days|aujourd'hui|hier|cette semaine|semaine dernière)\b|(?:اليوم|أمس|امس|هذا الأسبوع|هذا الاسبوع|الأسبوع الماضي|الاسبوع الماضي|آخر 7 أيام|اخر 7 ايام)/giu, ' ')
    .replace(/\s+/g, ' ').trim();
  const evidenceRequest = `${subject} ${current.trim()}`.trim().slice(0, 300);
  return { decision: { path: 'required', tool: { kind: 'web_search', query: evidenceRequest } },
    evidenceRequest };
}
