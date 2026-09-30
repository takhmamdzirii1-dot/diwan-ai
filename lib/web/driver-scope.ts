import type { ResponseLanguage } from '@/lib/chat/response-language';

// Scope labels, not vendor/model routing assumptions. Unknown branches are never guessed.
const driverWord = /\b(?:drivers?|pilotes?)\b|تعريف(?:ات)?/iu;
const platformPattern = /\b(?:Windows(?:\s*(?:10|11))?|Linux|Ubuntu|Debian|macOS|Android)\b|ويندوز(?:\s*(?:10|11))?|لينكس/iu;
const channelPattern = /\b(?:Game[ -]?Ready|Studio|WHQL|beta|stable|production|gaming|creator)\b/iu;
export type DriverScope = { platform: string | null; channel: string | null; missing: Array<'platform' | 'channel'> };
function normalized(value: string) {
  return value.toLowerCase().replace(/ويندوز/gu, 'windows').replace(/لينكس/gu, 'linux').replace(/[\s-]+/g, '');
}
export function driverRequestScope(request: string): DriverScope | null {
  if (!driverWord.test(request)) return null;
  const platform = request.match(platformPattern)?.[0] ?? null;
  const channel = request.match(channelPattern)?.[0] ?? null;
  return { platform, channel, missing: [...(!platform ? ['platform' as const] : []), ...(!channel ? ['channel' as const] : [])] };
}
export function driverScopeRefinement(request: string) {
  if (request.length > 100 || !platformPattern.test(request) && !channelPattern.test(request)) return false;
  return !request.replace(platformPattern, '').replace(channelPattern, '')
    .replace(/\b(?:please|for|and|channel|driver|pilote|pour|et)\b|من فضلك|إصدار|تعريف|و/giu, '').replace(/[\s,.;:/؟?!-]/g, '');
}
export function driverEvidenceMatchesScope(text: string, scope: DriverScope) {
  if (scope.missing.length || /~[A-Za-z_][A-Za-z0-9_]{2,60}~|\{\{[^}]+\}\}/u.test(text)) return false;
  const platform = text.match(platformPattern)?.[0];
  const channel = text.match(channelPattern)?.[0];
  return !!platform && !!channel && normalized(platform) === normalized(scope.platform!)
    && normalized(channel) === normalized(scope.channel!);
}
export function driverScopeQuestion(scope: DriverScope, language: ResponseLanguage) {
  if (language === 'ar') return scope.missing.length === 2
    ? 'ما نظام التشغيل وقناة التعريف المطلوبة (مثل تعريف الألعاب أو التصميم)؟ يلزم تحديدهما للتحقق من أحدث إصدار مناسب.'
    : scope.missing[0] === 'platform' ? 'ما نظام التشغيل وإصداره؟ سأتحقق من أحدث تعريف للقناة التي اخترتها.'
      : 'ما قناة التعريف المطلوبة (مثل الألعاب أو التصميم أو النسخة التجريبية)؟ سأحافظ على نظام التشغيل الذي حددته.';
  if (language === 'fr') return scope.missing.length === 2
    ? 'Quel système d’exploitation et quelle branche du pilote souhaitez-vous (jeu, création, bêta, etc.) ? Ces précisions sont nécessaires pour vérifier la dernière version adaptée.'
    : scope.missing[0] === 'platform' ? 'Quel système d’exploitation et quelle version utilisez-vous ? Je conserverai la branche choisie.'
      : 'Quelle branche du pilote souhaitez-vous (jeu, création, bêta, etc.) ? Je conserverai le système indiqué.';
  return scope.missing.length === 2
    ? 'Which operating system and driver channel do you need (gaming, creator, beta, etc.)? Both are needed to verify the latest suitable release.'
    : scope.missing[0] === 'platform' ? 'Which operating system and version do you use? I will keep your selected driver channel.'
      : 'Which driver channel do you need (gaming, creator, beta, etc.)? I will keep your selected operating system.';
}
