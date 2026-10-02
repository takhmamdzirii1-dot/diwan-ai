import { explicitConnectedReadRequest } from './core';

/** Syntax only: accessibility is established by the owned server-side connector read. */
export function googleFileId(request: string): string | null {
  const urls: string[] = request.match(/https:\/\/[^\s<>"']+/gu) ?? [];
  const ids = new Set<string>();
  for (const candidate of urls) {
    try {
      const url = new URL(candidate.replace(/[).،,]+$/u, ''));
      if (!['drive.google.com', 'docs.google.com'].includes(url.hostname) || url.username || url.password || url.port) continue;
      const id = url.pathname.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]+)/u)?.[1]
        ?? (url.hostname === 'drive.google.com' && url.pathname === '/open' ? url.searchParams.get('id') : null);
      if (id && /^[A-Za-z0-9_-]{10,200}$/u.test(id) && !/^(?:your[_-]?file[_-]?id|file[_-]?id[_-]?here|placeholder)$/iu.test(id)) ids.add(id);
    } catch { /* malformed input is not authorization */ }
  }
  return ids.size === 1 ? [...ids][0] : null;
}

export function googleFileReadRequest(request: string): boolean {
  return explicitConnectedReadRequest(request)
    && /google\s*(?:drive|docs|sheets)|(?:drive|docs)\.google\.com|جوجل\s*درايف/iu.test(request)
    && /file|document|spreadsheet|fichier|document|feuille|ملف|مستند|جدول|https:\/\/(?:drive|docs)\.google\.com/iu.test(request);
}
