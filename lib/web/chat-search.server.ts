import 'server-only';
import { tool } from 'ai';
import { z } from 'zod';
import type { ResponseLanguage } from '@/lib/chat/response-language';
import { webEvidenceInstruction, WEB_SEARCH_TOOL_DESCRIPTION } from '@/lib/chat/system-prompt';
import { searchContextForRequest } from './context.server';
import { searchWeb, normalizeSearchEvidence, type SearchExecution, type WebSearchHit } from './search.server';
import { readPublicWebPage } from './url-reader.server';
import type { SearchDecision } from './selection';
import { currentInformationPolicy, requestTimeframe, searchSubject } from './selection';
import { resolveSearchStrategy, type SearchStrategy } from './strategy';
import { evaluateCurrentOutput } from './output';
import type { ChatMessagePart } from '@/lib/artifacts/chat-parts';
import type { SearchTurnContext, SearchSubjectContext } from './search-context';
import { driverRequestScope, driverScopeQuestion } from './driver-scope';

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
  strategy?: SearchStrategy;
  providerId?: string;
  providerModelId?: string;
  modelId?: string;
  contextSubject?: string;
}) {
  const canonicalPolicy = currentInformationPolicy(options.request);
  // A stale optional/none caller cannot downgrade the canonical required-current contract.
  const decision = canonicalPolicy.decision.path === 'required' ? canonicalPolicy.decision : options.decision;
  const policy = { ...canonicalPolicy, decision };
  const driverScope = policy.fresh ? driverRequestScope(options.request) : null;
  const strategy = options.strategy ?? resolveSearchStrategy({ policy,
    toolsSupported: options.nativeToolsSupported, vantraConfigured: options.searchConfigured,
    allowOptionalTools: options.allowNativeSearch,
    route: { providerId: options.providerId ?? '', providerModelId: options.providerModelId ?? '' } });
  // Required VANTRA turns already retrieve before the selected model runs.
  // Exposing the same search again invites an unnecessary model continuation
  // (even with cached retrieval); optional turns keep it alongside artifact tools.
  const toolExposed = strategy.kind === 'vantra_web_tool' && decision.path === 'optional' && options.nativeToolsSupported
    && options.searchConfigured && options.allowNativeSearch !== false;
  let result: SearchResult | null = null;
  let pending: Promise<{ status: 'ok' | 'unavailable'; context: string }> | null = null;
  let searched = false;
  const metadata: Record<string, unknown> = {
    webSearchDecision: decision.path,
    webSearchToolExposed: toolExposed, webSearchToolCalled: false,
    webSearchToolAvailable: toolExposed, webSearchOptionalToolUsed: false,
    webSearchTriggered: false, webSearchApiRequestCount: 0,
    webSearchProviderUsed: null, webSearchResultCount: 0,
    webSearchEvidenceMode: null, webSearchEvidenceSufficient: null,
    synthesisAccepted: null, synthesisRejectionReason: null,
    webUrlReadCount: 0,
    webSearchStrategy: strategy.kind, webSearchExecution: strategy.execution,
    webSearchStrategyReason: strategy.reason, webSearchRequiresVerification: policy.fresh,
    webValidationOutcome: 'not_applicable', webValidationFailureReason: null,
    webSearchActualProvider: options.providerId ?? null,
    webSearchActualProviderModel: options.providerModelId ?? null,
    webSearchSelectedModel: options.modelId ?? null,
    nativeSearchInvocationCount: 0,
    webValidationScope: 'evidence_and_output_contract',
    webSearchScopeMissing: driverScope?.missing ?? [],
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
    search: (query: string, _provider?: Parameters<typeof searchWeb>[1], scope?: Parameters<typeof searchWeb>[2]) =>
      (options.operations?.search ?? searchWeb)(query, undefined, { ...scope, onExecution: recordExecution }) };
  const run = (query: string, operations: SearchOperations = active) => {
    // Repeated/parallel tool calls reuse the same result, including failed searches.
    if (pending) return pending;
    searched = true;
    metadata.webSearchTriggered = true;
    pending = (async () => {
      try {
        result = await searchContextForRequest(query, options.request, operations, options.seenSourceUrls);
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
          webUrlReadFailures: t.webUrlReadFailures,
          webUrlIncompleteEvidenceCount: t.webUrlIncompleteEvidenceCount,
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
  const evaluateOutput = (text: string, parts: readonly ChatMessagePart[] = []) => {
    if (!searched && !(decision.path === 'required' && decision.tool.kind === 'web_search')) return null;
    // onFinish validates the complete model output before the wire gate runs. A later
    // projection/suffix must never turn that request's rejected outcome into success.
    if (metadata.webValidationOutcome === 'rejected') return {
      accepted: false, text: '', parts: [], citationsCount: 0,
      reason: typeof metadata.webValidationFailureReason === 'string'
        ? metadata.webValidationFailureReason : 'insufficient_evidence',
    };
    const outcome = evaluateCurrentOutput({ text, parts, hits: result?.hits ?? [], request: options.request,
      now: options.now ?? new Date(), language: options.language });
    Object.assign(metadata, { synthesisAccepted: outcome.accepted, synthesisRejectionReason: outcome.reason,
      webValidationOutcome: outcome.accepted ? 'accepted' : 'rejected',
      webValidationFailureReason: outcome.reason, webSearchCitationsCount: outcome.citationsCount });
    return outcome;
  };
  return {
    strategy,
    toolExposed,
    // Explicit current requests are resolved before the model; no extra intent model.
    prepare: () => decision.path === 'required' && decision.tool.kind === 'web_search'
      ? driverScope?.missing.length ? Promise.resolve({ status: 'clarification_required' as const,
          context: driverScopeQuestion(driverScope, options.language) })
        : strategy.kind === 'vantra_web_tool' ? run(decision.tool.query)
        : strategy.kind === 'provider_native' ? Promise.resolve({ status: 'ok' as const, context: '' })
          : Promise.resolve({ status: 'unavailable' as const, context: currentInformationUnavailable(options.language) })
      : Promise.resolve(null),
    ingestNativeEvidence: async (hits: WebSearchHit[]) => {
      if (strategy.kind !== 'provider_native') throw new Error('NATIVE_SEARCH_STRATEGY_MISMATCH');
      if (pending) return pending;
      metadata.nativeSearchInvocationCount = 1;
      const normalized = normalizeSearchEvidence(hits);
      // Native evidence is supplied by the selected model's implemented protocol adapter.
      // This resolver performs no Brave/Tavily request and no second model call.
      const nativeOperations: SearchOperations = { read: active.read, search: async () => ({
        sourceId: 'native-search', name: 'Native search evidence', mimeType: 'text/markdown', text: '', hits: normalized,
        execution: { primaryProvider: options.providerId ?? 'native', providerUsed: options.providerId ?? 'native',
          providerAttempted: [], attempts: [], apiRequestCount: 0, fallbackUsed: false, fallbackReason: null,
          failureCategory: null, latencyMs: 0, resultCount: normalized.length, truncated: normalized.length >= 8 },
      }) };
      return run(options.request, nativeOperations);
    },
    nativeTool: toolExposed ? tool({ description: WEB_SEARCH_TOOL_DESCRIPTION,
      parameters: z.object({ query: z.string().trim().min(1).max(300) }).strict(),
      execute: async ({ query }) => {
        metadata.webSearchToolCalled = true;
        metadata.webSearchOptionalToolUsed = decision.path === 'optional';
        return run(query);
      },
    }) : undefined,
    evidence: (): readonly WebSearchHit[] | null => searched ? result?.hits ?? [] : null,
    instruction: () => webEvidenceInstruction(Boolean(result?.evidence.todayRequested && !result.evidence.publishedToday),
      true, result?.telemetry.evidenceMode !== 'structured_fact'),
    validateAnswer: (answer: string) => { evaluateOutput(answer); },
    evaluateOutput,
    subjectForPersistence: (): SearchSubjectContext | null => policy.fresh
      ? { version: 1, subject: (options.contextSubject ?? searchSubject(options.request)).slice(0, 300),
        fresh: true, mode: policy.mode, timeframe: requestTimeframe(options.request) } : null,
    contextForPersistence: (): SearchTurnContext | null => metadata.webValidationOutcome === 'accepted' && result
      ? { version: 1, subject: (options.contextSubject ?? searchSubject(options.request)).slice(0, 300),
        fresh: policy.fresh, mode: policy.mode, timeframe: requestTimeframe(options.request),
        sourceUrls: result.hits.slice(0, 8).map((hit) => hit.url) } : null,
    markUnverified: () => Object.assign(metadata, { synthesisAccepted: false,
      synthesisRejectionReason: metadata.synthesisRejectionReason ?? 'insufficient_evidence',
      webValidationOutcome: 'rejected', webValidationFailureReason: metadata.synthesisRejectionReason ?? 'insufficient_evidence' }),
    snapshot: () => ({ ...metadata }),
  };
}
