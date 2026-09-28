/** Only an explicit web action activates network access. Ordinary Chat remains offline. */
export type WebContextTool = { kind: 'read_url'; url: string } | { kind: 'web_search'; query: string };
export type SearchDecision = { path: 'none' | 'optional' } | { path: 'required'; tool: WebContextTool };

export function selectWebContextTool(request: string): WebContextTool | null {
  const text = request.slice(0, 800).trim();
  if (/^(?:do not|don't|without|never)\s+(?:read|open|visit|search|browse)/i.test(text)) return null;
  if (/(?:sb_secret_[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{16,}|\bBearer\s+[A-Za-z0-9._-]{16,}|\b(?:API_KEY|CLIENT_SECRET|REFRESH_TOKEN)\s*[:=]\s*\S+)/i.test(text)) return null;
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
  return query && query.length <= 300 && !/https?:\/\//i.test(query) ? { kind: 'web_search', query } : null;
}

/** Deterministic fast path. Optional cases are decided by the selected Chat model, never a classifier. */
export function decideWebSearch(request: string): SearchDecision {
  const text = request.slice(0, 800).trim();
  const explicit = selectWebContextTool(text);
  if (explicit) return { path: 'required', tool: explicit };
  if (!text || /^(?:do not|don't|without|never)\s+(?:read|open|visit|search|browse)/i.test(text)
    || /(?:sb_secret_[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{16,}|\bBearer\s+[A-Za-z0-9._-]{16,}|\b(?:API_KEY|CLIENT_SECRET|REFRESH_TOKEN)\s*[:=]\s*\S+)/i.test(text)) return { path: 'none' };
  // An exact URL is handled by the URL reader only when explicitly requested; never search it by accident.
  if (/https?:\/\//i.test(text)) return { path: 'none' };
  if (/^(?:write|rewrite|draft|translate|calculate|solve|create|compose|code)\b/i.test(text)
    || /^(?:اكتب|أعد صياغة|ترجم|احسب|أنشئ|écris|rédige|traduis|calcule)\b/iu.test(text)) return { path: 'none' };
  if (/\b(?:latest|today|right now|live|currently|this week|recent (?:news|events|releases|updates)|current (?:price|prices|availability|version|release|model|product|president|ceo)|verify (?:online|on the web))\b/i.test(text)
    || /\b(?:aujourd'hui|actuellement|dernières nouvelles|actualités|prix actuel|disponibilité actuelle|vérifie sur (?:le )?web)\b/iu.test(text)
    || /(?:اليوم|الآن|الان|(?:أحدث|احدث|آخر|اخر)\s+(?:إصدار|اصدار|نسخة|أخبار|اخبار|سعر|الأسعار)|السعر الحالي|الأسعار الحالية|تحقق من (?:الويب|الإنترنت))/u.test(text))
    return { path: 'required', tool: { kind: 'web_search', query: text.slice(0, 300) } };
  if (/^(?:summari[sz]e|explain)\b/i.test(text)
    || /^(?:لخص|اشرح|résume|explique)\b/iu.test(text)) return { path: 'none' };
  // Conservative semantic candidate: only external comparisons/checks, not loose topical keywords.
  if (/^(?:which|what|who|where|how)\b[^?]{0,220}\b(?:best|better|compare|available|released|source|evidence)\b/i.test(text)
    || /^(?:quel|quelle|quels|quelles)\b[^?]{0,220}\b(?:meilleur|disponible|compar|source)\b/iu.test(text)) return { path: 'optional' };
  return { path: 'none' };
}

/** A confirmation question inherits only the immediately preceding answered fresh-web question. */
export function decideWebSearchWithHistory(current: string,
  previous: readonly { role: string; content: string }[]): { decision: SearchDecision; evidenceRequest: string } {
  const decision = decideWebSearch(current);
  if (decision.path !== 'none') return { decision, evidenceRequest: current };
  const confirmation = /^(?:هل أنت متأكد|هل انت متأكد|تأكد|تاكد|تحقق مرة أخرى|تحقق مره اخرى|are you sure|verify that|really|es-tu sûr|es tu sur)\s*[؟?!.,]*$/iu;
  if (!confirmation.test(current.trim())) return { decision, evidenceRequest: current };
  const lastUser = [...previous].reverse().findIndex((message) => message.role === 'user');
  if (lastUser < 0) return { decision, evidenceRequest: current };
  const index = previous.length - 1 - lastUser;
  const earlier = previous[index].content;
  const answered = previous.slice(index + 1).some((message) => message.role === 'assistant' && message.content.trim());
  const earlierDecision = decideWebSearch(earlier);
  return answered && earlierDecision.path === 'required' && earlierDecision.tool.kind === 'web_search'
    ? { decision: earlierDecision, evidenceRequest: earlier }
    : { decision, evidenceRequest: current };
}
