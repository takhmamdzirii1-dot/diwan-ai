/**
 * Detects the natural direction of a piece of text by its first strong character.
 * Used to render mixed English/Arabic conversations correctly (Claude-style).
 */
const RTL_RE = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function detectDir(text: string): 'rtl' | 'ltr' {
  if (!text) return 'ltr';
  return RTL_RE.test(text) ? 'rtl' : 'ltr';
}
