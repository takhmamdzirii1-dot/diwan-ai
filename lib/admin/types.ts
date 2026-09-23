export type AdminDataResult<T> = {
  available: boolean;
  data: T;
  reason?: 'not_configured' | 'query_failed';
};

export type CostAmount = { currency: string; minor: string };

export type AdminActivity = {
  id: string;
  kind: 'payment' | 'generation' | 'subscription' | 'provider' | 'model' | 'plan' | 'credit';
  title: string;
  context: string;
  status: string;
  createdAt: string;
  href: string;
};

export type AdminOverviewData = {
  generatedAt: string;
  totalUsers: number | null;
  usersThisMonth: number | null;
  generations7d: number | null;
  generationsPrevious7d: number | null;
  successfulJobs7d: number | null;
  failedJobs7d: number | null;
  providerIssues: number | null;
  modelsMissingPricing: number | null;
  modelsMissingRoute: number | null;
  pendingPayments: number | null;
  providerHealth: {
    ready: number;
    degraded: number;
    unavailable: number;
    misconfigured: number;
    enabled: number;
  } | null;
  activeModels: number | null;
  testingModels: number | null;
  disabledModels: number | null;
  recentActivity: AdminActivity[];
  partialFailures: string[];
};

export type AdminProviderRow = {
  id: string;
  name: string;
  modalities: string[];
  enabled: boolean;
  status: 'ready' | 'disabled' | 'misconfigured' | 'unavailable';
  adapterType: string;
  baseEndpoint: string | null;
  archived: boolean;
  routeCount: number;
  testSupported: boolean;
  role: 'primary' | 'backup' | 'optional' | 'unassigned';
  requestCount: number;
  successfulAttempts: number;
  terminalAttempts: number;
  metricsComplete: boolean;
  failures: number;
  averageLatencyMs: number | null;
  lastActivityAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  dailyUsage: { date: string; successful: number; failed: number; other: number; spendUsdMinor: string | null }[];
  costByModel: { providerModelId: string; name: string; records: number; cost: CostAmount }[];
  recentIssues: { at: string; message: string }[];
  history: { id: string; action: string; at: string; previousState: Record<string, unknown> | null; newState: Record<string, unknown> | null }[];
  associatedModels: {
    key: string;
    name: string;
    providerModelId: string;
    routeId: string;
    modality: string;
    enabled: boolean;
    fallback: boolean;
    priority: number;
  }[];
  accumulatedCosts: CostAmount[];
  lastError: string | null;
  configured: boolean;
  priority: number;
  emergencyDisabled: boolean;
  dailySpendLimitMinor: string | null;
  spendCurrency: string | null;
};

export type AdminModelRow = {
  key: string;
  catalogOnly?: boolean;
  provider: string;
  modelId: string;
  displayName: string;
  modality: string;
  enabled: boolean;
  availability: string;
  providerCost: CostAmount | null;
  providerCostState: 'free' | 'known' | 'unknown';
  creditPrice: number | null;
  priority: 'primary' | 'backup' | 'unassigned';
  activationSupported: boolean;
  persisted: boolean;
  updatedAt: string | null;
  shortDescription: string | null;
  mediaUrl: string | null;
  category: string | null;
  sortOrder: number;
  visibleInStudio: boolean;
  availabilityLabel: string | null;
  capabilities: import('@/lib/models/capabilities').ModelCapabilities;
  allowedPlans: import('@/lib/models/plan-entitlements').ModelPlanCode[];
  planAccess: import('@/lib/models/model-access').ModelPlanAccessMap;
  archived: boolean;
  routes: AdminModelRoute[];
  providerOptions: AdminModelProviderOption[];
  audit: { id: string; action: string; createdAt: string; previousState: Record<string, unknown> | null; newState: Record<string, unknown> | null }[];
};

export type AdminModelProviderOption = {
  id: string;
  name: string;
  configured: boolean;
  enabled: boolean;
};

export type AdminModelRoute = {
  id: string;
  providerId: string;
  providerModelId: string;
  enabled: boolean;
  priority: number;
  fallback: boolean;
  configured: boolean;
  providerEnabled: boolean;
};

export type AdminUserRow = {
  id: string;
  email: string;
  plan: string;
  isOwner: boolean;
  creditBalance: string | null;
  subscriptionBalance: string | null;
  subscriptionRolloverBalance: string | null;
  purchasedBalance: string | null;
  freeImageRemaining: number | null;
  freeVideoRemaining: number | null;
  liteVideoRemaining: number | null;
  creditsUsed: string;
  generationCount: number;
  paymentOrderCount: number;
  status: 'active' | 'unconfirmed' | 'suspended';
  emailConfirmed: boolean;
  displayName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
};

export type AdminUsersData = {
  users: AdminUserRow[];
  total: number;
  query: string;
  truncated: boolean;
};

export type AdminJobRow = {
  id: string;
  source: 'generation' | 'execution';
  userId: string;
  userEmail: string | null;
  modality: string;
  provider: string | null;
  modelId: string;
  modelName: string | null;
  vantraModelName: string | null;
  status: string;
  providerCost: CostAmount | null;
  creditsCharged: string | null;
  latencyMs: number | null;
  error: string | null;
  prompt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  providerModelId: string | null;
  reservationState: string | null;
  attempts: { provider: string; state: string; error: string | null; startedAt: string; finishedAt: string | null }[];
  usageMetadata: Record<string, unknown> | null;
};

export type AdminJobsData = {
  jobs: AdminJobRow[];
  nextCursor: string | null;
  total: number;
};

export type AdminAuditRow = {
  id: string;
  action: string;
  actor: string | null;
  resource: string;
  resourceType: string;
  resourceId: string;
  detail: string;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  createdAt: string;
};

export type AdminPaymentAudit = {
  id: string;
  action: string;
  actorUserId: string | null;
  createdAt: string;
};

export type AdminPaymentRow = {
  id: string;
  userId: string;
  userEmail: string;
  planId: string;
  planName: string;
  orderKind: 'credit_pack' | 'subscription';
  paymentMethod: 'baridimob' | 'ccp' | 'cib' | 'edahabia';
  amountDzd: number;
  creditsAmount: string | null;
  entitlementSnapshot: Record<string, unknown> | null;
  paymentReference: string;
  customerReference: string | null;
  proofUrl: string | null;
  proofStoragePath: string | null;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  resultingCreditTransactionId: string | null;
  resultingEntitlementId: string | null;
  createdAt: string;
  audit: AdminPaymentAudit[];
};

export type AdminPaymentPlan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: 'credit_pack' | 'subscription';
  priceDzd: number;
  unifiedCredits: number;
  subscriptionCreditAllowance: number | null;
  includedVideoAllowance: number | null;
  active: boolean;
  displayOrder: number;
  featured: boolean;
  publicVisible?: boolean;
  eligibilityRequired?: boolean;
  frozen?: boolean;
  planCode?: string | null;
  accessPeriodDays?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  history?: { id: string; action: string; at: string; previousState: Record<string, unknown> | null; newState: Record<string, unknown> | null }[];
};
