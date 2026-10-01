import 'server-only';
import { referenceFilesAdapter } from './reference';
import type { ConnectedAppAdapter } from './core';
import { googleDriveAdapter } from './google-drive';
import { isEncryptionConfigured } from '@/lib/ai/provider-connections';

/** Known adapters remain available for disconnect/revocation if configuration is removed. */
export function knownConnectedApp(id: string): ConnectedAppAdapter | undefined {
  if (id === 'google_drive') return googleDriveAdapter();
  if (id === 'vantra_example_files') return referenceFilesAdapter();
  return undefined;
}

/** Recognize private file requests even before OAuth setup; never send them to public Search. */
export function discoverableConnectedApps(): ConnectedAppAdapter[] {
  const configured = configuredConnectedApps();
  return configured.some(app => app.id === 'google_drive') ? configured : [...configured, googleDriveAdapter()];
}

/** Curated registry. Future OAuth/REST/MCP adapters implement the same interface. */
export function configuredConnectedApps(): ConnectedAppAdapter[] {
  const apps: ConnectedAppAdapter[] = [];
  if (process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && isEncryptionConfigured()) apps.push(googleDriveAdapter());
  if (process.env.VANTRA_REFERENCE_CONNECTED_APP_ENABLED === 'true') apps.push(referenceFilesAdapter());
  return apps;
}
