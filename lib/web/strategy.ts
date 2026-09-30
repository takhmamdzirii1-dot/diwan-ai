import type { LanguageModel } from 'ai';
import type { WebSearchHit } from './search.server';
import type { CurrentInformationPolicy } from './selection';

export type NativeSearchCapability = {
  state: 'supported' | 'unsupported' | 'unknown';
  protocol?: string;
  verifiedAt?: string;
  source?: 'provider_documentation' | 'route_probe';
};

/** Implemented server protocols, not arbitrary endpoint/header configuration or function calling. */
export interface NativeSearchAdapter {
  protocol: string;
  documentationUrl: string;
  supportsRequiredSearch: boolean;
  supportsRoute(route: { providerId: string; providerModelId: string }): boolean;
  // The binding must enforce this budget and translate documented native citation events
  // to the returned server IDs. Arbitrary model-authored URLs are not citation events.
  bind(input: { model: LanguageModel; required: boolean; maxSearchInvocations: 1;
    onEvidence: (hits: WebSearchHit[]) => Promise<readonly WebSearchHit[]> }): LanguageModel;
}

export type SearchStrategy = { kind: 'none' | 'vantra_web_tool' | 'provider_native';
  execution: 'none' | 'pre_search' | 'function_tool' | 'native';
  reason: string; nativeAdapter?: NativeSearchAdapter };

export function resolveSearchStrategy(input: {
  policy: CurrentInformationPolicy; toolsSupported: boolean; vantraConfigured: boolean;
  native?: NativeSearchCapability; adapters?: readonly NativeSearchAdapter[]; now?: Date;
  allowOptionalTools?: boolean;
  route?: { providerId: string; providerModelId: string };
}): SearchStrategy {
  if (input.policy.decision.path === 'none' || input.policy.decision.path === 'required'
    && input.policy.decision.tool.kind === 'read_url')
    return { kind: 'none', execution: 'none', reason: 'no_search_needed' };
  const required = input.policy.decision.path === 'required';
  const verified = Date.parse(input.native?.verifiedAt ?? '');
  const age = (input.now ?? new Date()).getTime() - verified;
  const adapter = input.native?.state === 'supported' && input.native.source
    && ['provider_documentation', 'route_probe'].includes(input.native.source)
    && age >= 0 && age <= 30 * 86_400_000
    ? input.adapters?.find((item) => item.protocol === input.native?.protocol
      && /^https:\/\//.test(item.documentationUrl) && input.route && item.supportsRoute(input.route)
      && (!required || item.supportsRequiredSearch)) : undefined;
  if (adapter && (required || input.allowOptionalTools !== false))
    return { kind: 'provider_native', execution: 'native', reason: 'verified_native_protocol', nativeAdapter: adapter };
  if (input.vantraConfigured && (required || input.toolsSupported && input.allowOptionalTools !== false))
    return { kind: 'vantra_web_tool', execution: required ? 'pre_search' : 'function_tool',
      reason: input.native?.state === 'supported' ? 'native_protocol_unavailable' : 'native_not_verified' };
  return { kind: 'none', execution: 'none', reason: required ? 'current_verification_unavailable'
    : 'optional_search_unavailable' };
}

/** No hosted-search protocol has yet been verified/implemented in this deployment.
 * New documented protocols register one adapter here; no provider-name branches in orchestration.
 */
export const verifiedNativeSearchAdapters: readonly NativeSearchAdapter[] = [];
