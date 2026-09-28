import 'server-only';
import { referenceFilesAdapter } from './reference';
import type { ConnectedAppAdapter } from './core';

/** Curated registry. Future OAuth/REST/MCP adapters implement the same interface. */
export function configuredConnectedApps(): ConnectedAppAdapter[] {
  return process.env.VANTRA_REFERENCE_CONNECTED_APP_ENABLED === 'true' ? [referenceFilesAdapter()] : [];
}
