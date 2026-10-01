import { z } from 'zod';
import { searchContextReference } from '@/lib/web/search-context';

const publicUrl = z.string().url().max(2048).refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.port
    && url.hostname.includes('.') && !/^[\d.]+$|:|(?:^|\.)(?:localhost|local|internal)$/i.test(url.hostname)
    && ![...url.searchParams.keys()].some((key) => /token|secret|auth|signature|api[_-]?key|password/i.test(key));
});
const source = z.object({ id: z.string().regex(/^S[1-9]\d*$/), title: z.string().max(300), url: publicUrl,
  sourceClass: z.enum(['primary', 'news', 'forum', 'other']).optional() }).strict();
export const webSourcesSchema = z.object({ type: z.literal('vantra-web-sources'),
  state: z.enum(['searching', 'read']), sources: z.array(source).max(24),
  readCount: z.number().int().min(0).max(100) }).strict();
export type WebSourcesAnnotation = z.infer<typeof webSourcesSchema>;
export type ChatWebSource = WebSourcesAnnotation['sources'][number];

/** Presentation metadata only. Never used for server ownership/evidence decisions. */
export function webSourcesAnnotation(annotations: unknown): WebSourcesAnnotation | null {
  if (!Array.isArray(annotations)) return null;
  let latest: WebSourcesAnnotation | null = null;
  for (const annotation of annotations.slice(-32)) {
    const parsed = webSourcesSchema.safeParse(annotation);
    if (parsed.success) latest = parsed.data;
  }
  return latest;
}

export function messageDirection(text: string, fallback: 'ltr' | 'rtl' = 'ltr') {
  const prose = text.replace(/```[\s\S]*?```|`[^`]*`|\[[^\]]*\]\(https?:\/\/[^)]+\)|https?:\/\/\S+/gu, '');
  const letters = [...prose].filter((char) => /\p{Letter}/u.test(char));
  const arabic = letters.filter((char) => /\p{Script=Arabic}/u.test(char)).length;
  const other = letters.length - arabic;
  return arabic === other ? fallback : arabic > other ? 'rtl' : 'ltr';
}

export function sourceDomain(url: string) { return new URL(url).hostname.replace(/^(?:(?:www|ar|sa)\.)+/u, ''); }

export function sourceClass(url: string, primary = false): ChatWebSource['sourceClass'] {
  const domain = sourceDomain(url);
  if (/(?:^|\.)(?:reddit\.com|quora\.com)$/u.test(domain)) return 'forum';
  if (primary) return 'primary';
  return /(?:^|\.)(?:reuters\.com|apnews\.com|bbc\.(?:com|co\.uk)|ft\.com|bloomberg\.com|nytimes\.com|theguardian\.com|yahoo\.com)$/u.test(domain) ? 'news' : 'other';
}

/** Resolve only recognizable citation syntax, never ordinary factual digits. */
export function citationMarkdown(text: string, sources: readonly ChatWebSource[] = []) {
  return text.replace(/\[\[source:(S\d+)\]\]|\[(S?\d+)\](?!\()/gu, (_all, id: string | undefined, number: string | undefined) => {
    const found = id ? sources.find((source) => source.id === id)
      : sources.find((source) => source.id === `S${number!.replace(/^S/u, '')}`);
    return found ? `[${found.id}](${found.url})` : '';
  });
}

/** Older saved search messages contain server-rendered links but no UI registry. */
export function legacyWebSources(annotations: unknown, text: string): WebSourcesAnnotation | null {
  if (!searchContextReference(annotations)) return null;
  const links = [...new Map([...text.matchAll(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/gu)]
    .map((match) => [match[2], { title: match[1].slice(0, 300), url: match[2] }])).values()];
  const parsed = webSourcesSchema.safeParse({ type: 'vantra-web-sources', state: 'read', readCount: 0,
    sources: links.slice(0, 24).map((link, index) => ({ ...link, id: `S${index + 1}` })) });
  return parsed.success ? parsed.data : null;
}
