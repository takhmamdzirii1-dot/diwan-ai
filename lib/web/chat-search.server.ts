import 'server-only';
import { tool } from 'ai';
import { z } from 'zod';
import type { ResponseLanguage } from '@/lib/chat/response-language';
import { webEvidenceInstruction, WEB_SEARCH_TOOL_DESCRIPTION } from '@/lib/chat/system-prompt';
import { searchContextForRequest, webPageExcerpt } from './context.server';
import { searchWeb, normalizeSearchEvidence, type SearchExecution, type WebSearchHit } from './search.server';
import { readPublicWebPage } from './url-reader.server';
import type { SearchDecision } from './selection';
import { currentInformationPolicy, requestTimeframe, searchSubject } from './selection';
import { resolveSearchStrategy, type SearchStrategy } from './strategy';
import { evaluateCurrentOutput } from './output';
import { researchEvidence, researchEvidenceText, researchSourceKey } from './research-evidence';
import type { ChatMessagePart } from '@/lib/artifacts/chat-parts';
import type { SearchTurnContext, SearchSubjectContext } from './search-context';

type SearchResult = Awaited<ReturnType<typeof searchContextForRequest>>;
type SearchOperations = NonNullable<Parameters<typeof searchContextForRequest>[2]>;

export function currentInformationUnavailable(language: ResponseLanguage) {
  return language === 'ar' ? 'لم أجد معلومات كافية للإجابة عن هذا التفصيل حاليًا. ما النطاق الذي يهمك تحديدًا؟'
    : language === 'fr' ? 'Je n’ai pas trouvé assez d’informations sur ce détail. Quel périmètre vous intéresse ?'
      : 'I could not establish that detail. Which specific scope matters to you?';
}

/** A bounded research session, shared by pre-search and selected-model tools.
 * Limits protect latency/context, not semantic completeness. Duplicate acquisition
 * is cached; distinct refinement is possible when it materially improves an answer.
 */
export function createChatSearch(options: {
  decision: SearchDecision; request: string; language: ResponseLanguage;
  nativeToolsSupported: boolean; searchConfigured: boolean; allowNativeSearch?: boolean;
  seenSourceUrls?: readonly string[]; operations?: SearchOperations; now?: Date;
  strategy?: SearchStrategy; providerId?: string; providerModelId?: string; modelId?: string;
  contextSubject?: string; signal?: AbortSignal;
}) {
  const canonicalPolicy = currentInformationPolicy(options.request);
  const decision = canonicalPolicy.decision.path === 'required' ? canonicalPolicy.decision : options.decision;
  const policy = { ...canonicalPolicy, decision };
  const strategy = options.strategy ?? resolveSearchStrategy({ policy,
    toolsSupported: options.nativeToolsSupported, vantraConfigured: options.searchConfigured,
    allowOptionalTools: options.allowNativeSearch,
    route: { providerId: options.providerId ?? '', providerModelId: options.providerModelId ?? '' } });
  const toolExposed = strategy.kind === 'vantra_web_tool' && decision.path !== 'none'
    && options.nativeToolsSupported && options.searchConfigured && options.allowNativeSearch !== false;
  let result: SearchResult | null = null;
  let searched = false;
  let retrievalStarted = 0;
  let acquiredChars = 0;
  const queries = new Map<string, Promise<{ status: 'ok' | 'unavailable'; context: string }>>();
  const reads = new Map<string, ReturnType<typeof readPublicWebPage>>();
  const sources = new Map<string, WebSearchHit>();
  const navigation = new Map<string, { url: string; title: string }>();
  const metadata: Record<string, unknown> = {
    webSearchDecision: decision.path, webSearchToolExposed: toolExposed, webSearchToolCalled: false,
    webSearchToolAvailable: toolExposed, webSearchOptionalToolUsed: false,
    webSearchTriggered: false, webSearchApiRequestCount: 0, webSearchQueryCount: 0,
    webSearchProviderUsed: null, webSearchResultCount: 0,
    webSearchEvidenceMode: policy.mode, webSearchEvidenceSufficient: null,
    synthesisAccepted: null, synthesisRejectionReason: null, webUrlReadCount: 0,
    webSearchStrategy: strategy.kind, webSearchExecution: strategy.execution,
    webSearchStrategyReason: strategy.reason, webSearchRequiresVerification: policy.fresh,
    webValidationOutcome: 'not_applicable', webValidationFailureReason: null,
    webSearchActualProvider: options.providerId ?? null,
    webSearchActualProviderModel: options.providerModelId ?? null, webSearchSelectedModel: options.modelId ?? null,
    nativeSearchInvocationCount: 0, webValidationScope: 'delivery_safety_not_factual_certification',
    webSearchAttempts: [], webUrlReadFailures: [], webSearchTotalLatencyMs: 0,
  };
  const permitted = () => {
    options.signal?.throwIfAborted();
    if (!retrievalStarted) retrievalStarted = Date.now();
    return Date.now() - retrievalStarted < 45_000 && acquiredChars < 40_000;
  };
  const recordExecution = (execution: SearchExecution) => {
    metadata.webSearchApiRequestCount = Number(metadata.webSearchApiRequestCount) + execution.apiRequestCount;
    metadata.webSearchTotalLatencyMs = Number(metadata.webSearchTotalLatencyMs) + execution.latencyMs;
    metadata.webSearchAttempts = [...metadata.webSearchAttempts as unknown[], ...execution.attempts];
    Object.assign(metadata, { webSearchPrimaryProvider: execution.primaryProvider,
      webSearchProviderUsed: execution.providerUsed,
      webSearchFallbackUsed: Boolean(metadata.webSearchFallbackUsed) || execution.fallbackUsed,
      webSearchFallbackReason: execution.fallbackReason ?? metadata.webSearchFallbackReason ?? null });
  };
  const register = (hits: readonly WebSearchHit[]) => {
    for (const hit of researchEvidence(hits, options.request, options.seenSourceUrls)) {
      const key = researchSourceKey(hit.url)!;
      const old = sources.get(key);
      const id = old?.evidenceId ?? `S${sources.size + 1}`;
      // IDs never change across queries, reads, or competing observations.
      sources.set(key, { ...old, ...hit, evidenceId: id,
        description: old && old.description.length > hit.description.length ? old.description : hit.description,
        verifiedPage: Boolean(old?.verifiedPage || hit.verifiedPage) });
    }
    metadata.webSearchSelectedEvidenceCount = sources.size;
    metadata.webSearchEvidenceSufficient = sources.size > 0;
    if (result) result.hits = [...sources.values()].map((hit) => ({ ...hit, evidenceId: hit.evidenceId! }));
  };
  const context = () => researchEvidenceText([...sources.values()], options.now, options.request).slice(0, 48_000);
  const active: SearchOperations = {
    read: (url, settings) => {
      const key = researchSourceKey(url) ?? url;
      const cached = reads.get(key);
      if (cached) return cached;
      if (!permitted()) return Promise.reject(new Error('RESEARCH_CONTEXT_LIMIT'));
      metadata.webUrlReadCount = Number(metadata.webUrlReadCount) + 1;
      const pending = (options.operations?.read ?? readPublicWebPage)(url, { ...settings, signal: options.signal })
        .then((page) => {
          acquiredChars += Math.min(page.text.length, 5_000);
          for (const link of [...page.navigationLinks ?? [], ...page.articleLinks ?? []]) {
            if (![...navigation.values()].some((item) => item.url === link.url))
              navigation.set(`P${navigation.size + 1}`, link);
          }
          metadata.webUrlReadOutcome = 'succeeded';
          return page;
        }).catch((cause) => {
          const code = cause instanceof Error && ['URL_UNSAFE', 'URL_UNAVAILABLE', 'URL_CONTENT_UNSUPPORTED'].includes(cause.message)
            ? cause.message : 'URL_READ_FAILED';
          metadata.webUrlReadFailures = [...metadata.webUrlReadFailures as string[], code];
          throw cause;
        });
      reads.set(key, pending);
      return pending;
    },
    search: (query, _provider, scope) => (options.operations?.search ?? searchWeb)(query, undefined,
      { ...scope, signal: options.signal, onExecution: recordExecution }),
  };
  const run = (query: string, operations: SearchOperations = active) => {
    const key = query.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
    const cached = queries.get(key);
    if (cached) return cached;
    if (!permitted()) return Promise.resolve({ status: 'unavailable' as const,
      context: 'Further retrieval would exceed the latency/context limit. Answer the supported portion from available observations.' });
    searched = true;
    metadata.webSearchTriggered = true;
    metadata.webSearchQueryCount = Number(metadata.webSearchQueryCount) + 1;
    const pending = (async () => {
      try {
        const obtained = await searchContextForRequest(query, options.request, operations, options.seenSourceUrls);
        result = obtained;
        register(obtained.hits);
        acquiredChars += obtained.hits.reduce((sum, hit) => sum + Math.min(hit.description.length, 500), 0);
        Object.assign(metadata, { webSearchResultCount: Number(metadata.webSearchResultCount) + obtained.telemetry.webSearchResultCount,
          webSearchEvidenceQuality: obtained.telemetry.evidenceQuality,
          webSearchAssessmentReason: obtained.telemetry.assessmentReason,
          webSearchSelectionReason: obtained.telemetry.selectionReason,
          webSearchOfficialEvidenceUsed: Boolean(metadata.webSearchOfficialEvidenceUsed) || obtained.telemetry.officialEvidenceUsed,
          webUrlIncompleteEvidenceCount: [...sources.values()].filter((hit) => hit.contentComplete === false).length });
        return { status: sources.size ? 'ok' as const : 'unavailable' as const, context: context() };
      } catch {
        options.signal?.throwIfAborted();
        metadata.webSearchAcquisitionFailure = 'search_unavailable';
        return { status: 'unavailable' as const,
          context: 'This retrieval produced no usable observations. Do not invent current facts. Use available context or ask the minimum necessary clarification.' };
      }
    })();
    queries.set(key, pending);
    return pending;
  };
  const evaluateOutput = (text: string, parts: readonly ChatMessagePart[] = []) => {
    // IDs are local to this acquisition session. A model copying an old S1
    // from conversation history has not retrieved or verified that source.
    const hasSourceReference = /\[\[source:/u.test(text) || parts.some((part) => /\[\[source:/u.test(JSON.stringify(part)));
    if (!searched && !(decision.path === 'required' && decision.tool.kind === 'web_search')
      && !hasSourceReference) return null;
    // A complete-answer safety rejection cannot be reversed by a later wire projection.
    if (metadata.webValidationOutcome === 'rejected') return {
      accepted: false, text: '', parts: [], citationsCount: 0, warnings: ['prior_output_rejected'],
      reason: typeof metadata.webValidationFailureReason === 'string' ? metadata.webValidationFailureReason : 'unsafe_output',
    };
    // No observations from a required retrieval is not permission to publish a
    // current-memory answer (particularly on provider-native routes).
    if (decision.path === 'required' && !sources.size) {
      const reason = 'no_external_observations';
      Object.assign(metadata, { synthesisAccepted: false, synthesisRejectionReason: reason,
        webValidationOutcome: 'rejected', webValidationFailureReason: reason });
      return { accepted: false, text: '', parts: [], citationsCount: 0,
        warnings: [reason], reason };
    }
    const outcome = evaluateCurrentOutput({ text, parts, hits: [...sources.values()], request: options.request,
      now: options.now ?? new Date(), language: options.language });
    Object.assign(metadata, { synthesisAccepted: outcome.accepted, synthesisRejectionReason: outcome.reason,
      webValidationOutcome: outcome.accepted ? 'accepted' : 'rejected', webValidationFailureReason: outcome.reason,
      webSearchCitationsCount: outcome.citationsCount, webDeliveryWarnings: outcome.warnings,
      webFactualVerification: 'model_synthesis_requires_independent_assessment' });
    return outcome;
  };
  return {
    strategy, toolExposed,
    prepare: () => decision.path === 'required' && decision.tool.kind === 'web_search'
      ? strategy.kind === 'vantra_web_tool' ? run(decision.tool.query)
        : strategy.kind === 'provider_native' ? Promise.resolve({ status: 'ok' as const, context: '' })
          : Promise.resolve({ status: 'unavailable' as const, context: 'External retrieval is unavailable. Provide useful stable context without claiming current verification.' })
      : Promise.resolve(null),
    ingestNativeEvidence: async (hits: WebSearchHit[]) => {
      if (strategy.kind !== 'provider_native') throw new Error('NATIVE_SEARCH_STRATEGY_MISMATCH');
      searched = true;
      metadata.nativeSearchInvocationCount = Number(metadata.nativeSearchInvocationCount) + 1;
      metadata.webSearchTriggered = true;
      register(normalizeSearchEvidence(hits));
      return { status: sources.size ? 'ok' as const : 'unavailable' as const, context: context() };
    },
    nativeTool: toolExposed ? tool({ description: WEB_SEARCH_TOOL_DESCRIPTION,
      parameters: z.object({ query: z.string().trim().min(1).max(300) }).strict(),
      execute: async ({ query }) => {
        metadata.webSearchToolCalled = true; metadata.webSearchOptionalToolUsed = decision.path === 'optional';
        return run(query);
      } }) : undefined,
    readTool: toolExposed ? tool({
      description: 'Read a returned source or its returned navigation link to resolve a material gap. Supply its S or P ID, never an invented URL. Partial extraction is explicitly marked; do not interpret missing content as a complete inventory.',
      parameters: z.object({ sourceId: z.string().regex(/^[SP][1-9]\d*$/) }).strict(),
      execute: async ({ sourceId }) => {
        const hit = [...sources.values()].find((item) => item.evidenceId === sourceId);
        const target = hit ?? navigation.get(sourceId);
        if (!target) return { status: 'unavailable', reason: 'unknown_source' };
        try {
          const page = await active.read(target.url);
          const bounded = webPageExcerpt(page);
          const excerpt = bounded.text;
          if (!excerpt) return { status: 'unavailable', reason: 'page_content_unavailable', observations: context() };
          register([{ ...hit, title: target.title, url: target.url, description: excerpt,
            verifiedPage: true, contentComplete: bounded.complete, fetchedAt: page.fetchedAt,
            pagePublishedAt: page.pagePublishedAt, pageUpdatedAt: page.pageUpdatedAt }]);
          return { status: 'ok', observations: context(), links: [...navigation].slice(-24)
            .map(([id, link]) => ({ sourceId: id, title: link.title })) };
        } catch {
          options.signal?.throwIfAborted();
          return { status: 'unavailable', reason: 'page_unavailable_or_partial', observations: context() };
        }
      } }) : undefined,
    evidence: (): readonly WebSearchHit[] | null => searched ? [...sources.values()] : null,
    instruction: () => webEvidenceInstruction(false, true),
    validateAnswer: (answer: string) => { evaluateOutput(answer); }, evaluateOutput,
    subjectForPersistence: (): SearchSubjectContext | null => searched || policy.fresh
      ? { version: 1, subject: (options.contextSubject ?? searchSubject(options.request)).slice(0, 300),
        fresh: policy.fresh, mode: policy.mode, timeframe: requestTimeframe(options.request) } : null,
    contextForPersistence: (): SearchTurnContext | null => metadata.webValidationOutcome === 'accepted' && sources.size
      ? { version: 1, subject: (options.contextSubject ?? searchSubject(options.request)).slice(0, 300),
        fresh: policy.fresh, mode: policy.mode, timeframe: requestTimeframe(options.request),
        sourceUrls: [...sources.values()].slice(0, 8).map((hit) => hit.url) } : null,
    markUnverified: () => Object.assign(metadata, { synthesisAccepted: false,
      synthesisRejectionReason: metadata.synthesisRejectionReason ?? 'unsafe_or_missing_output',
      webValidationOutcome: 'rejected', webValidationFailureReason: metadata.synthesisRejectionReason ?? 'unsafe_or_missing_output' }),
    snapshot: () => ({ ...metadata }),
  };
}
