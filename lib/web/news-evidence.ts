import type { WebSearchHit } from './search.server';

/** Asking for dates/time windows requires event dates, not an aggregate page's refresh time. */
export function datedNewsRequest(request: string) {
  return /\b(?:dates?|dated|today|yesterday|week|days|aujourd'hui|hier|semaine|jours|dat[ée]es?)\b|تواريخ|بتاريخ|تاريخ|اليوم|أمس|امس|أسبوع|اسبوع|أيام|ايام/iu.test(request);
}
export function newsArticleCandidate(hit: WebSearchHit) {
  try {
    const parts = new URL(hit.url).pathname.split('/').filter(Boolean);
    if (parts.some((part) => ['type', 'category', 'categories', 'tag', 'tags'].includes(part.toLowerCase()))) return false;
    const last = parts.at(-1)?.replace(/\.(?:html?|php)$/i, '').toLowerCase() ?? '';
    const tail = /^(?:intelligence-artificielle|actualites|actualités)$/iu.test(last)
      ? parts.at(-2)?.toLowerCase() ?? '' : last;
    return tail.length >= 10 && !/^(?:intelligence-artificielle|actualites|actualités|announcements|releases|latest-news)(?:-\d+)?$/iu.test(tail)
      && (tail.includes('-') || parts.some((part) => /^20\d{2}$/.test(part)));
  } catch { return false; }
}
const months = [
  'january|janvier|يناير|جانفي', 'february|février|فبراير|فيفري', 'march|mars|مارس',
  'april|avril|أبريل|افريل', 'may|mai|مايو|ماي', 'june|juin|يونيو|جوان',
  'july|juillet|يوليو|جويلية', 'august|août|أغسطس|اوت', 'september|septembre|سبتمبر',
  'october|octobre|أكتوبر|اكتوبر', 'november|novembre|نوفمبر', 'december|décembre|ديسمبر',
];
const monthPattern = months.join('|');
const datePattern = `20\\d{2}-\\d{2}-\\d{2}|(?:${monthPattern})\\s+\\d{1,2},?\\s+20\\d{2}|\\d{1,2}\\s+(?:${monthPattern})\\s+20\\d{2}`;
function day(value: string) {
  if (/^20\d{2}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(value); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
  }
  const month = months.findIndex((names) => new RegExp(`(?:^|\\s)(?:${names})(?=\\s)`, 'iu').test(value));
  const numbers = value.match(/\d+/g)?.map(Number);
  if (month < 0 || numbers?.length !== 2) return null;
  const date = new Date(Date.UTC(numbers[1], month, numbers[0]));
  return date.getUTCMonth() === month && date.getUTCDate() === numbers[0] ? date.toISOString().slice(0, 10) : null;
}
export function explicitCalendarDates(text: string) {
  return [...text.matchAll(new RegExp(datePattern, 'giu'))].map((match) => day(match[0]))
    .filter((value): value is string => !!value);
}
/** Calendar phrases are not product identities (e.g. "septembre 2026"). */
export function withoutCalendarDates(text: string) {
  return text.replace(new RegExp(datePattern, 'giu'), '')
    .replace(new RegExp(`(?:${monthPattern})\\s+20\\d{2}`, 'giu'), '');
}
/** An event needs its own date; the page date alone never becomes an event date. */
export function explicitAnnouncement(text: string) {
  const verb = '(?<!\\p{L})(?:announced|launched|released|introduced|presented|annonc[ée](?:e)?|lanc[ée](?:e)?|dévoil[ée](?:e)?|présent[ée](?:e)?|a tenu|أعلن|أُعلن|تم الإعلان|صدر|أطلق|تم إطلاق)(?!\\p{L})';
  const matches = [...text.slice(0, 30_000).matchAll(new RegExp(`(?:${verb})[^\\n!?]{0,60}?(${datePattern})`, 'giu'))];
  const candidates = matches.flatMap((match) => { const date = day(match[1]); return date ? [{ date, text: match[0] }] : []; });
  // Event dates often precede the verb. A named event's explicit year in the
  // SAME paragraph can qualify "29 septembre"; never borrow a publication year.
  for (const paragraph of text.slice(0, 30_000).split(/\n\s*\n/u)) {
    if (paragraph.length > 2_000 || !new RegExp(verb, 'iu').test(paragraph)) continue;
    const years = new Set(paragraph.match(/\b20\d{2}\b/g) ?? []);
    if (years.size !== 1) continue;
    for (const match of paragraph.matchAll(new RegExp(`\\b(\\d{1,2}\\s+(?:${monthPattern}))(?!\\s+20\\d{2})\\b`, 'giu'))) {
      const nearby = paragraph.slice(Math.max(0, match.index! - 350), match.index! + match[0].length + 350);
      if (!new RegExp(verb, 'iu').test(nearby)) continue;
      const date = day(`${match[1]} ${[...years][0]}`);
      if (date) candidates.push({ date, text: paragraph.slice(0, 900) });
    }
  }
  const dates = new Set(candidates.map((candidate) => candidate.date));
  if (dates.size !== 1) return null;
  const date = [...dates][0];
  return { date, text: candidates.find((candidate) => candidate.date === date)!.text.slice(0, 900) };
}
