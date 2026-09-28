export type ResponseLanguage = 'en' | 'fr' | 'ar';

function explicitInstruction(text: string): ResponseLanguage | null {
  const instructions: { language: ResponseLanguage; pattern: RegExp }[] = [
    { language: 'en', pattern: /\b(?:answer|respond|reply|write|speak|translate)\b[^.!?\n]{0,45}?\b(?:(?:in|to)\s+)?english\b|(?:أجب|جاوب|رد|اكتب|ترجم)[^.!؟\n]{0,35}?(?:بالإنجليزية|بالانجليزية|إلى الإنجليزية|الى الانجليزية)/iu },
    { language: 'fr', pattern: /\b(?:answer|respond|reply|write|speak|translate|réponds?|reponds?|écris|ecris|traduis)\b[^.!?\n]{0,45}?\b(?:(?:in|to|en)\s+)?(?:french|français)\b|(?:أجب|جاوب|رد|اكتب|ترجم)[^.!؟\n]{0,35}?(?:بالفرنسية|إلى الفرنسية|الى الفرنسية)/iu },
    { language: 'ar', pattern: /\b(?:answer|respond|reply|write|speak|translate)\b[^.!?\n]{0,45}?\b(?:(?:in|to)\s+)?arabic\b|(?:أجب|جاوب|رد|اكتب|ترجم)[^.!؟\n]{0,35}?(?:بالعربية|بالدارجة|إلى العربية|الى العربية)/iu },
  ];
  const matched = instructions.flatMap(({ language, pattern }) => {
    const match = pattern.exec(text);
    return match ? [{ language, index: match.index }] : [];
  }).sort((a, b) => b.index - a.index);
  return matched[0]?.language ?? null;
}

function withoutTechnicalTokens(text: string) {
  return text.replace(/https?:\/\/\S+|`[^`]*`|\b[\w-]+(?:\.[\w-]+)+\b|\b\d+(?:[.\-]\d+)*\b/giu, ' ');
}

function currentTurnLanguage(text: string): ResponseLanguage | null {
  const cleaned = withoutTechnicalTokens(text);
  const arabic = (cleaned.match(/[\u0600-\u06ff]/gu) ?? []).length;
  const latin = (cleaned.match(/[a-zà-ÿ]/giu) ?? []).length;
  if (arabic >= 3 && (/(?:ما\s+(?:هو|هي)|كيف|لماذا|هل|متى|أين|اشرح|ابحث|الآن|اليوم)/u.test(cleaned)
    || arabic >= latin * 0.4)) return 'ar';
  const words = cleaned.toLowerCase().match(/[a-zà-ÿ]+/giu) ?? [];
  const french = words.filter((word) => /^(?:bonjour|parle|moi|peux|donner|dis|merci|quoi|quand|pourquoi|quel|quelle|quels|quelles|est|sont|les|des|une|pour|avec|comment|aujourd|derni[eè]re?|r[ée]ponds|recherche|du|de|la|le)$/.test(word)).length
    + (/[àâçéèêëîïôùûüÿœæ]/iu.test(cleaned) ? 2 : 0);
  const english = words.filter((word) => /^(?:hello|tell|give|show|explain|what|which|who|when|where|how|why|the|is|are|for|with|please|latest|current|today|search|answer)$/.test(word)).length;
  if (french >= 2 && french > english) return 'fr';
  if (english >= 2 && english >= french) return 'en';
  if (arabic >= 3 && arabic > latin) return 'ar';
  return null;
}

/** Resolve only from user turns; fetched/tool/provider text is never an input. */
export function resolveResponseLanguage(currentUserTurn: string, previousUserTurns: readonly string[] = [],
  fallback: ResponseLanguage = 'en'): ResponseLanguage {
  const explicit = explicitInstruction(currentUserTurn);
  if (explicit) return explicit;
  const current = currentTurnLanguage(currentUserTurn);
  if (current) return current;
  for (let index = previousUserTurns.length - 1; index >= 0; index--) {
    const earlier = currentTurnLanguage(previousUserTurns[index]);
    if (earlier) return earlier;
  }
  return fallback;
}
