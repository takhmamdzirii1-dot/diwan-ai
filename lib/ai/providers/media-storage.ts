import 'server-only';

export type TemporaryProviderMedia = {
  kind: 'temporary_provider_url';
  url: string;
  expiresAt: string | null;
  providerOperationId: string;
};

export type PermanentMediaObject = {
  kind: 'permanent_object';
  storageKey: string;
  contentType: string;
  sizeBytes: number | null;
};

export interface PermanentMediaStorage {
  readonly kind: 's3-compatible';
  createDirectUploadTarget(input: {
    userId: string;
    modality: 'image' | 'video';
    contentType: string;
  }): Promise<{ storageKey: string; uploadUrl: string; expiresAt: string }>;
  createPrivateReadUrl(storageKey: string): Promise<{ url: string; expiresAt: string }>;
  deleteObject(storageKey: string): Promise<void>;
}

/**
 * Persistent media intentionally remains unavailable until a signed S3-compatible
 * adapter is configured. Provider URLs must be treated as temporary and must not
 * be written into the permanent Library as if they were durable objects.
 */
export function getPermanentMediaStorage(): PermanentMediaStorage | null {
  return null;
}
