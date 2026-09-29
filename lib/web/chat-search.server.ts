import 'server-only';
import { tool } from 'ai';
import { z } from 'zod';
import type { ResponseLanguage } from '@/lib/chat/response-language';
import { webEvidenceInstruction, WEB_SEARCH_TOOL_DESCRIPTION } from '@/lib/chat/system-prompt';
import { searchContextForRequest } from './context.server';
import { evaluateSearchSynthesis } from './evidence';
import { searchWeb, type SearchExecution, type WebSearchHit } from './search.server';
import { readPublicWebPage } from './url-reader.server';
import type { SearchDecision } from './selection';

type SearchResult = Awaited<ReturnType<typeof searchContextForRequest>>;
type SearchOperations = NonNullable<Parameters<typeof searchContextForRequest>[2]>;

export function currentInformationUnavailable(language: ResponseLanguage) {
  return language === 'ar' ? 'لم أتمكن من التحقق من المعلومات الحالية. يرجى المحاولة لاحقًا.'
    : language === 'fr' ? 'Je n’ai pas pu vérifier les informations actuelles. Veuillez réessayer plus tard.'
      : 'I could not verify the current information. Please try again later.';
}

/** Request-local orchestration, independent of artifact tool selection and model identity. */
export function createChatSearch(options: {
  decision: SearchDecision;
  request: string;
  language: ResponseLanguage;
  nativeToolsSupported: boolean;
  searchConfigured: boolean;
  allowNativeSearch?: boolean;
  seenSourceUrls?: readonly string[];
  operations?: SearchOperations;
  now?: Date;
}) {
  const toolExposed = (options.decision.path === 'optional'
    || options.decision.path === 'required' && options.decision.tool.kind === 'web_search') && options.nativeToolsSupported
    && options.searchConfigured && options.allowNativeSearch !== false;
  let result: SearchResult | null = null;
  let pending: Promise<{ status: 'ok' | 'unavailable'; context: string }> | null = null;
  let searched = false;
  const metadata: Record<string, unknown> = {
    webSearchDecision: options.decision.path,
    webSearchToolExposed: toolExposed, webSearchToolCalled: false,
    webSearchToolAvailable: toolExposed, webSearchOptionalToolUsed: false,
    webSearchTriggered: false, webSearchApiRequestCount: 0,
    webSearchProviderUsed: null, webSearchResultCount: 0,
    webSearchEvidenceMode: null, webSearchEvidenceSufficient: null,
    synthesisAccepted: null, synthesisRejectionReason: null,
    webUrlReadCount: 0,
  };
  const recordExecution = (execution: SearchExecution) => Object.assign(metadata, {
    webSearchApiRequestCount: execution.apiRequestCount,
    webSearchPrimaryProvider: execution.primaryProvider,
    webSearchProviderUsed: execution.providerUsed,
    webSearchFallbackUsed: execution.fallbackUsed,
    webSearchFallbackProvider: execution.fallbackUsed ? execution.providerUsed : null,
    webSearchFallbackReason: execution.fallbackReason,
    webSearchAttempts: execution.attempts,
    webSearchTotalLatencyMs: execution.latencyMs,
  });
  const active = { read: options.operations?.read ?? readPublicWebPage,
    search: (query: string) => (options.operations?.search ?? searchWeb)(query, undefined,
      { onExecution: recordExecution }) };
  const run = (query: string) => {
    // Repeated/parallel tool calls reuse the same result, including failed searches.
    if (pending) return pending;
    searched = true;
    metadata.webSearchTriggered = true;
    pending = (async () => {
      try {
        result = await searchContextForRequest(query, options.request, active, options.seenSourceUrls);
        const t = result.telemetry;
        Object.assign(metadata, {
          webSearchApiRequestCount: t.webSearchApiRequestCount ?? metadata.webSearchApiRequestCount,
          webSearchPrimaryProvider: t.primaryProvider,
          webSearchProviderUsed: t.webSearchProviderUsed,
          webSearchFallbackUsed: t.fallbackUsed, webSearchFallbackProvider: t.fallbackProvider,
          webSearchFallbackReason: t.fallbackReason, webSearchAttempts: t.webSearchAttempts,
          webSearchResultCount: t.webSearchResultCount, webSearchSelectedEvidenceCount: t.selectedEvidenceCount,
          webSearchEvidenceMode: t.evidenceMode, webSearchEvidenceQuality: t.evidenceQuality,
          webSearchEvidenceSufficient: t.evidenceSufficient,
          webSearchAssessmentReason: t.assessmentReason, webSearchSelectionReason: t.selectionReason,
          webSearchOfficialEvidenceUsed: t.officialEvidenceUsed,
          webSearchTotalLatencyMs: t.webSearchTotalLatencyMs,
          webUrlReadCount: t.webUrlReadCount, webUrlReadOutcome: t.urlReadOutcome,
        });
        const instruction = webEvidenceInstruction(result.evidence.todayRequested && !result.evidence.publishedToday,
          true, t.evidenceMode !== 'structured_fact');
        return { status: result.hits.length ? 'ok' as const : 'unavailable' as const,
          context: `${instruction}\n\n${result.context}` };
      } catch {
        Object.assign(metadata, { webSearchEvidenceSufficient: false,
          synthesisAccepted: false, synthesisRejectionReason: 'search_unavailable' });
        return { status: 'unavailable' as const, context: currentInformationUnavailable(options.language) };
      }
    })();
    return pending;
  };
  return {
    toolExposed,
    // Explicit current requests are resolved before the model; no extra intent model.
    prepare: () => options.decision.path === 'required' && options.decision.tool.kind === 'web_search'
      ? run(options.decision.tool.query) : Promise.resolve(null),
    nativeTool: toolExposed ? tool({ description: WEB_SEARCH_TOOL_DESCRIPTION,
      parameters: z.object({ query: z.string().trim().min(1).max(300) }).strict(),
      execute: async ({ query }) => {
        metadata.webSearchToolCalled = true;
        metadata.webSearchOptionalToolUsed = options.decision.path === 'optional';
        return run(query);
      },
    }) : undefined,
    evidence: (): readonly WebSearchHit[] | null => searched ? result?.hits ?? [] : null,
    instruction: () => webEvidenceInstruction(Boolean(result?.evidence.todayRequested && !result.evidence.publishedToday),
      true, result?.telemetry.evidenceMode !== 'structured_fact'),
    validateAnswer: (answer: string) => {
      if (!searched) return;
      const outcome = evaluateSearchSynthesis(answer, result?.hits ?? [], options.request,
        options.now, options.language);
      Object.assign(metadata, { synthesisAccepted: outcome.synthesisAccepted,
        synthesisRejectionReason: outcome.synthesisRejectionReason, webSearchCitationsCount: outcome.citationsCount });
    },
    markUnverified: () => Object.assign(metadata, { synthesisAccepted: false,
      synthesisRejectionReason: metadata.synthesisRejectionReason ?? 'insufficient_evidence' }),
    snapshot: () => ({ ...metadata }),
  };
}
