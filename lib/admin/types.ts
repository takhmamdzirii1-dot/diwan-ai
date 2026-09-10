export type AdminDataResult<T> = {
  available: boolean;
  data: T;
  reason?: 'not_configured' | 'query_failed';
};

export type CostAmount = { currency: string; minor: string };

export type AdminActivity = {
  id: string;
  kind: 'generation' | 'credit';
  label: string;
  detail: string;
  status: string;
  createdAt: string;
};

export type AdminOverviewData = {
  totalUsers: number | null;
  totalGenerations: number | null;
  successfulJobs: number | null;
  failedJobs: number | null;
  creditsConsumed: string | null;
  pendingPayments: number | null;
  providerCosts: CostAmount[];
  recentActivity: AdminActivity[];
};

export type AdminProviderRow = {
  id: string;
  name: string;
  modalities: string[];
  enabled: boolean;
  status: 'healthy' | 'attention' | 'idle' | 'unconfigured' | 'demo' | 'client_managed';
  role: 'primary' | 'backup' | 'optional' | 'unassigned';
  requestCount: number;
  failures: number;
  averageLatencyMs: number | null;
  lastActivityAt: string | null;
  associatedModels: string[];
  accumulatedCosts: CostAmount[];
  lastError: string | null;
};

export type AdminModelRow = {
  key: string;
  provider: string;
  modelId: string;
  displayName: string;
  modality: string;
  enabled: boolean;
  availability: string;
  providerCost: CostAmount | null;
  creditPrice: number | null;
  priority: 'primary' | 'backup' | 'unassigned';
};

export type AdminUserRow = {
  id: string;
  email: string;
  plan: 'Free';
  creditBalance: string | null;
  creditsUsed: string;
  generationCount: number;
  paymentOrderCount: number;
  status: 'active' | 'unconfirmed' | 'suspended';
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
  source: 'generation' | 'dispatch';
  userId: string;
  userEmail: string | null;
  modality: string;
  provider: string | null;
  modelId: string;
  status: string;
  providerCost: CostAmount | null;
  creditsCharged: string | null;
  latencyMs: number | null;
  error: string | null;
  prompt: string | null;
  createdAt: string;
  updatedAt: string;
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
  paymentReference: string;
  customerReference: string | null;
  proofUrl: string | null;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
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
  active: boolean;
  displayOrder: number;
  featured: boolean;
};
