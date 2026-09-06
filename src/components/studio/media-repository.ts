'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEMO_LIBRARY_EVENT,
  addDemoMedia,
  downloadDemoMedia,
  readDemoLibrary,
  runDemoGeneration,
  writeDemoLibrary,
  type DemoMediaItem,
} from './demo-media';

export type MediaKind = 'image' | 'video';
export type MediaStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type ProductionMediaRecord = {
  id: string;
  userId: string;
  kind: MediaKind;
  prompt: string;
  modelId: string;
  status: MediaStatus;
  storagePath: string | null;
  thumbnailPath: string | null;
  metadata: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface MediaRepository<TItem> {
  list(): Promise<TItem[]>;
  remove(ids: ReadonlySet<string>): Promise<TItem[]>;
}

export class DemoMediaRepository implements MediaRepository<DemoMediaItem> {
  async list() { return readDemoLibrary(); }
  async create(input: Omit<DemoMediaItem, 'id' | 'assetUrl' | 'createdAt' | 'demo'>) {
    return addDemoMedia(input);
  }
  async replace(items: DemoMediaItem[]) { writeDemoLibrary(items); }
  async remove(ids: ReadonlySet<string>) {
    const current = readDemoLibrary();
    const removed = current.filter((item) => ids.has(item.id));
    writeDemoLibrary(current.filter((item) => !ids.has(item.id)));
    return removed;
  }
  async download(item: DemoMediaItem) { downloadDemoMedia(item); }
  subscribe(listener: () => void) {
    window.addEventListener(DEMO_LIBRARY_EVENT, listener);
    return () => window.removeEventListener(DEMO_LIBRARY_EVENT, listener);
  }
}

type GenerationRow = {
  id: string;
  user_id: string;
  type: MediaKind;
  prompt: string;
  model_id: string;
  status: MediaStatus;
  storage_path: string | null;
  thumbnail_path: string | null;
  metadata: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

const mapGeneration = (row: GenerationRow): ProductionMediaRecord => ({
  id: row.id,
  userId: row.user_id,
  kind: row.type,
  prompt: row.prompt,
  modelId: row.model_id,
  status: row.status,
  storagePath: row.storage_path,
  thumbnailPath: row.thumbnail_path,
  metadata: row.metadata ?? {},
  errorMessage: row.error_message,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Prepared production adapter. It is intentionally not activated while Studio is in Demo mode.
 * Production boundary: create one job, let the provider run asynchronously, receive the result by
 * webhook into Supabase, and deliver media directly from Storage/provider CDN. Never poll a Vercel
 * Function or proxy large media downloads through one.
 */
export class SupabaseMediaRepository implements MediaRepository<ProductionMediaRecord> {
  constructor(private readonly client: SupabaseClient) {}

  async list() {
    const { data, error } = await this.client
      .from('generations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as GenerationRow[]).map(mapGeneration);
  }

  async remove(ids: ReadonlySet<string>) {
    if (ids.size === 0) return [];
    const { data, error } = await this.client
      .from('generations')
      .delete()
      .in('id', [...ids])
      .select('*');
    if (error) throw error;
    return ((data ?? []) as GenerationRow[]).map(mapGeneration);
  }

  async createSignedMediaUrl(path: string, expiresInSeconds = 60) {
    const { data, error } = await this.client.storage.from('media').createSignedUrl(path, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  }
}

export const demoMediaRepository = new DemoMediaRepository();
export { runDemoGeneration };
export type { DemoMediaItem };
