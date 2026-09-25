export const CHAT_NATIVE_CAPABILITIES = ['streaming', 'visionInput', 'fileInput', 'structuredOutput', 'tools', 'parallelTools'] as const;
export type ChatNativeCapability = typeof CHAT_NATIVE_CAPABILITIES[number];
export type CapabilityState = 'supported' | 'unsupported' | 'unknown';
export type CapabilityOverride = 'auto' | 'force_enabled' | 'force_disabled';
export type CapabilityEvidenceSource = 'provider_metadata' | 'vantra_catalog' | 'route_probe' | 'manual_override';
export type CapabilityEvidence = { state: CapabilityState; source: CapabilityEvidenceSource; checkedAt?: string; errorCode?: string };
export type RouteCapabilityRecord = {
  providerId: string;
  providerModelId: string;
  evidence: Partial<Record<ChatNativeCapability, CapabilityEvidence>>;
  overrides: Partial<Record<ChatNativeCapability, CapabilityOverride>>;
};
export type RouteCapabilityStore = Record<string, RouteCapabilityRecord>;
export type RouteIdentity = { id: string; providerId: string; providerModelId: string };
const VERIFIED_CACHE_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeRouteCapabilityStore(value: unknown): RouteCapabilityStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: RouteCapabilityStore = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    if (typeof record.providerId !== 'string' || typeof record.providerModelId !== 'string') continue;
    const evidence: RouteCapabilityRecord['evidence'] = {};
    const overrides: RouteCapabilityRecord['overrides'] = {};
    const rawEvidence = record.evidence && typeof record.evidence === 'object' ? record.evidence as Record<string, unknown> : {};
    const rawOverrides = record.overrides && typeof record.overrides === 'object' ? record.overrides as Record<string, unknown> : {};
    for (const key of CHAT_NATIVE_CAPABILITIES) {
      const entry = rawEvidence[key];
      if (entry && typeof entry === 'object') {
        const item = entry as Record<string, unknown>;
        if (['supported', 'unsupported', 'unknown'].includes(String(item.state))
          && ['provider_metadata', 'vantra_catalog', 'route_probe'].includes(String(item.source))) {
          evidence[key] = { state: item.state as CapabilityState, source: item.source as CapabilityEvidenceSource,
            ...(typeof item.checkedAt === 'string' ? { checkedAt: item.checkedAt } : {}),
            ...(typeof item.errorCode === 'string' ? { errorCode: item.errorCode.slice(0, 80) } : {}) };
        }
      }
      if (['auto', 'force_enabled', 'force_disabled'].includes(String(rawOverrides[key]))) overrides[key] = rawOverrides[key] as CapabilityOverride;
    }
    result[id] = { providerId: record.providerId, providerModelId: record.providerModelId, evidence, overrides };
  }
  return result;
}

export function resolveRouteCapabilities(input: {
  route: RouteIdentity;
  providerMetadata?: Partial<Record<ChatNativeCapability, boolean>>;
  catalog?: Partial<Record<ChatNativeCapability, boolean>>;
  stored?: RouteCapabilityStore;
  now?: string;
}) {
  const saved = input.stored?.[input.route.id];
  const matching = saved?.providerId === input.route.providerId && saved.providerModelId === input.route.providerModelId ? saved : undefined;
  const evidence: RouteCapabilityRecord['evidence'] = {};
  const resolved = {} as Record<ChatNativeCapability, { state: CapabilityState; source: CapabilityEvidenceSource | 'unknown'; override: CapabilityOverride; checkedAt?: string; errorCode?: string }>;
  for (const key of CHAT_NATIVE_CAPABILITIES) {
    const metadata = input.providerMetadata?.[key];
    const catalog = input.catalog?.[key];
    const fresh: CapabilityEvidence | undefined = typeof metadata === 'boolean'
      ? { state: metadata ? 'supported' : 'unsupported', source: 'provider_metadata', checkedAt: input.now }
      : typeof catalog === 'boolean' ? { state: catalog ? 'supported' : 'unsupported', source: 'vantra_catalog', checkedAt: input.now } : undefined;
    const prior = matching?.evidence[key];
    const currentTime = Date.parse(input.now ?? new Date().toISOString());
    const cacheValid = prior?.source === 'vantra_catalog' || (prior?.checkedAt
      && Number.isFinite(Date.parse(prior.checkedAt)) && currentTime - Date.parse(prior.checkedAt) <= VERIFIED_CACHE_MS
      && currentTime >= Date.parse(prior.checkedAt));
    const selected = fresh ?? (prior?.state !== 'unknown' && cacheValid ? prior : undefined);
    if (selected) evidence[key] = selected;
    const override = matching?.overrides[key] ?? 'auto';
    resolved[key] = override === 'auto'
      ? { state: selected?.state ?? 'unknown', source: selected?.source ?? 'unknown', override, checkedAt: selected?.checkedAt, errorCode: selected?.errorCode }
      : { state: override === 'force_enabled' ? 'supported' : 'unsupported', source: 'manual_override', override };
  }
  return { resolved, record: { providerId: input.route.providerId, providerModelId: input.route.providerModelId, evidence, overrides: matching?.overrides ?? {} } satisfies RouteCapabilityRecord };
}
