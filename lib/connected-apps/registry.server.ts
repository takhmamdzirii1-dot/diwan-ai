import 'server-only';
import { referenceFilesAdapter } from './reference';
import type { ConnectedAppAdapter } from './core';
import { googleDriveAdapter } from './google-drive';
import { isEncryptionConfigured } from '@/lib/ai/provider-connections';
import { gmailAdapter } from './gmail';
import { githubAdapter } from './github';
import { canvaAdapter } from './canva';
import { googleWorkspaceAdapter } from './google-workspace';
import { shopifyAdapter } from './shopify';
import { wooCommerceAdapter } from './woocommerce';

/** Known adapters remain available for disconnect/revocation if configuration is removed. */
export function knownConnectedApp(id: string): ConnectedAppAdapter | undefined {
  if (id === 'google_drive') return googleDriveAdapter();
  if (id === 'gmail') return gmailAdapter();
  if (id === 'github') return githubAdapter();
  if (id === 'canva') return canvaAdapter();
  if (id === 'google_workspace') return googleWorkspaceAdapter();
  if (id === 'shopify') return shopifyAdapter();
  if (id === 'woocommerce') return wooCommerceAdapter();
  if (id === 'vantra_example_files') return referenceFilesAdapter();
  return undefined;
}

/** Recognize private file requests even before OAuth setup; never send them to public Search. */
export function discoverableConnectedApps(): ConnectedAppAdapter[] {
  const configured = configuredConnectedApps();
  for (const adapter of [googleDriveAdapter(), gmailAdapter(), githubAdapter(), canvaAdapter(), googleWorkspaceAdapter(), shopifyAdapter(), wooCommerceAdapter()])
    if (!configured.some(app => app.id === adapter.id)) configured.push(adapter);
  return configured;
}

/** Curated registry. Future OAuth/REST/MCP adapters implement the same interface. */
export function configuredConnectedApps(): ConnectedAppAdapter[] {
  const apps: ConnectedAppAdapter[] = [];
  if (process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && isEncryptionConfigured()) apps.push(googleDriveAdapter());
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && isEncryptionConfigured()) apps.push(gmailAdapter());
  if (process.env.GITHUB_CONNECTED_APP_CLIENT_ID && process.env.GITHUB_CONNECTED_APP_CLIENT_SECRET && isEncryptionConfigured()) apps.push(githubAdapter());
  if (process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET && isEncryptionConfigured()) apps.push(canvaAdapter());
  // Public merchant onboarding remains disabled until mandatory privacy/uninstall
  // webhooks are implemented. Credentials alone must not advertise a finished flow.
  if (process.env.CONNECTED_APPS_WOOCOMMERCE_ENABLED === 'true' && process.env.CONNECTED_APPS_WRITES_ENABLED === 'true'
    && isEncryptionConfigured()) apps.push(wooCommerceAdapter());
  if (process.env.CONNECTED_APPS_WRITES_ENABLED === 'true' && process.env.GOOGLE_WORKSPACE_CLIENT_ID
    && process.env.GOOGLE_WORKSPACE_CLIENT_SECRET && isEncryptionConfigured()) apps.push(googleWorkspaceAdapter());
  if (process.env.VANTRA_REFERENCE_CONNECTED_APP_ENABLED === 'true') apps.push(referenceFilesAdapter());
  return apps;
}
