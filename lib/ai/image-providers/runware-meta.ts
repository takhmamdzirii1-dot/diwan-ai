import type { ProviderMeta } from './types';

/** Model identifier verified against Runware's text-to-image documentation. */
export const RUNWARE_TEST_MODEL = 'runware:101@1';

export const runwareMeta: ProviderMeta = {
  id: 'runware',
  name: 'Runware',
  type: 'image',
  pricing: 'platform',
  requiresApiKey: true,
  requiresAuthorization: false,
  clientSide: false,
  models: [{ id: RUNWARE_TEST_MODEL, name: RUNWARE_TEST_MODEL }],
  note: 'Internal server-side provider test only',
};
