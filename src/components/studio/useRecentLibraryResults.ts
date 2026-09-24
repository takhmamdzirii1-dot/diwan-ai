'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase/client';
import { SupabaseMediaRepository, type MediaKind } from './media-repository';

export type LibraryRailItem = {
  libraryAssetId: string;
  src: string;
  mimeType: string;
  thumbnail: null;
};

const repository = new SupabaseMediaRepository(supabase);

/**
 * Recent private Library assets for the result rail. Session results stay
 * first and instant; Library rows backfill behind them (deduped by the
 * caller). Metadata-only list call — no media bytes are fetched, thumbnails
 * fall back to the rail icon tile, and failures leave session-only behavior.
 */
export function useRecentLibraryResults(kind: MediaKind, limit = 12) {
  const [items, setItems] = useState<LibraryRailItem[]>([]);
  useEffect(() => {
    let active = true;
    repository
      .list()
      .then((records) => {
        if (!active) return;
        setItems(
          records
            .filter((record) => record.kind === kind)
            .slice(0, limit)
            .map((record) => ({
              libraryAssetId: record.id,
              src: record.assetUrl,
              mimeType: record.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/png'),
              thumbnail: null,
            }))
        );
      })
      .catch(() => { /* Rail stays session-only. */ });
    return () => {
      active = false;
    };
  }, [kind, limit]);
  return items;
}
