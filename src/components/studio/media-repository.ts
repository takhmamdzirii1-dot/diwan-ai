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

export type ProductionMediaRecord = {
  id: string;
  kind: MediaKind;
  prompt: string;
  model: string;
  assetUrl: string;
  mimeType: string | null;
  createdAt: number;
};

export interface MediaRepository<TItem> {
  list(): Promise<TItem[]>;
  remove(ids: ReadonlySet<string>): Promise<TItem[]>;
}

export function downloadPrivateMedia(assetId: string) {
  const link = document.createElement('a');
  link.href = `/api/library/media/${encodeURIComponent(assetId)}?download=1`;
  link.download = '';
  document.body.appendChild(link);
  link.click();
  link.remove();
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
  type: MediaKind;
  prompt: string;
  model_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const mapGeneration = (row: GenerationRow): ProductionMediaRecord => ({
  id: row.id,
  kind: row.type,
  prompt: row.prompt,
  model: row.model_id,
  assetUrl: `/api/library/media/${row.id}`,
  mimeType: typeof row.metadata?.mimeType === 'string' ? row.metadata.mimeType : null,
  createdAt: Date.parse(row.created_at),
});

export class SupabaseMediaRepository implements MediaRepository<ProductionMediaRecord> {
  constructor(private readonly client: SupabaseClient) {}

  async list() {
    const { data, error } = await this.client
      .from('generations')
      .select('id,type,prompt,model_id,metadata,created_at')
      .eq('status', 'completed')
      .not('storage_path', 'is', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as GenerationRow[]).map(mapGeneration);
  }

  async remove(ids: ReadonlySet<string>) {
    if (ids.size === 0) return [];
    const current = await this.list();
    const removed = current.filter((item) => ids.has(item.id));
    for (const item of removed) {
      const response = await fetch(`/api/library/media/${item.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('LIBRARY_DELETE_FAILED');
    }
    return removed;
  }

  async download(item: ProductionMediaRecord) {
    downloadPrivateMedia(item.id);
  }
}

export const demoMediaRepository = new DemoMediaRepository();
export { runDemoGeneration };
export type { DemoMediaItem };
