/** Only an explicit web action activates network access. Ordinary Chat remains offline. */
export type WebContextTool = { kind: 'read_url'; url: string } | { kind: 'web_search'; query: string };

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
    ?? text.match(/^(?:recherche|recherchez|cherche|cherchez)\s+(?:sur (?:le )?web|en ligne)\s+(.+)$/iu)
    ?? text.match(/^(?:ابحث|بحث)\s+(?:في الويب|على الويب|في الإنترنت|على الإنترنت)\s+(?:عن\s+)?(.+)$/u);
  const query = match?.[1]?.trim();
  return query && query.length <= 300 && !/https?:\/\//i.test(query) ? { kind: 'web_search', query } : null;
}
