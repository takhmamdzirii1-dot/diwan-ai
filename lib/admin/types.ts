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
  modality: string;
  provider: string | null;
  modelId: string;
  status: string;
  providerCost: CostAmount | null;
  error: string | null;
  prompt: string | null;
  createdAt: string;
  updatedAt: string;
};
