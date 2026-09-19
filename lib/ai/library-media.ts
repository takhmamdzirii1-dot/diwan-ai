import 'server-only';

import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getPermanentMediaStorage } from '@/lib/ai/providers/media-storage';

type PersistMediaInput = {
  executionId: string;
  userId: string;
  modality: 'image' | 'video';
  modelId: string;
  prompt: string;
  mimeType?: string;
  mediaBase64?: string;
  mediaUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
};

type GenerationRow = {
  id: string;
  user_id: string;
  type: 'image' | 'video';
  storage_path: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
};

const MAX_MEDIA_BYTES = 200 * 1024 * 1024;

function normalizedMimeType(value: string | null | undefined, modality: 'image' | 'video') {
  const mimeType = value?.split(';', 1)[0]?.trim().toLowerCase();
  if (!mimeType?.startsWith(`${modality}/`)) throw new Error('INVALID_LIBRARY_MEDIA_TYPE');
  return mimeType;
}

function extensionFor(mimeType: string) {
  const extensions: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };
  const extension = extensions[mimeType];
  if (!extension) throw new Error('UNSUPPORTED_LIBRARY_MEDIA_TYPE');
  return extension;
}

function verifyExisting(row: GenerationRow, input: PersistMediaInput) {
  if (row.user_id !== input.userId || row.type !== input.modality
    || row.status !== 'completed' || !row.storage_path) {
    throw new Error('LIBRARY_ASSET_IDEMPOTENCY_CONFLICT');
  }
  return {
    id: row.id,
    src: `/api/library/media/${row.id}`,
    mimeType: typeof row.metadata?.mimeType === 'string'
      ? row.metadata.mimeType
      : input.mimeType ?? (input.modality === 'image' ? 'image/png' : 'video/mp4'),
  };
}

async function mediaBytes(input: PersistMediaInput) {
  if (input.mediaBase64) {
    const dataUri = /^data:([^;,]+);base64,(.+)$/s.exec(input.mediaBase64);
    const mimeType = normalizedMimeType(dataUri?.[1] ?? input.mimeType, input.modality);
    const value = dataUri?.[2] ?? input.mediaBase64;
    const bytes = Buffer.from(value, 'base64');
    if (!bytes.byteLength || bytes.byteLength > MAX_MEDIA_BYTES) {
      throw new Error('INVALID_LIBRARY_MEDIA_SIZE');
    }
    return { bytes, mimeType };
  }
  if (!input.mediaUrl) throw new Error('LIBRARY_MEDIA_SOURCE_MISSING');
  const source = new URL(input.mediaUrl);
  if (source.protocol !== 'https:') throw new Error('INVALID_LIBRARY_MEDIA_URL');
  const response = await fetch(source, { cache: 'no-store', signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`LIBRARY_MEDIA_DOWNLOAD_FAILED_${response.status}`);
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_MEDIA_BYTES) throw new Error('INVALID_LIBRARY_MEDIA_SIZE');
  const mimeType = normalizedMimeType(response.headers.get('content-type') ?? input.mimeType, input.modality);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > MAX_MEDIA_BYTES) {
    throw new Error('INVALID_LIBRARY_MEDIA_SIZE');
  }
  return { bytes, mimeType };
}

export async function persistGeneratedMedia(input: PersistMediaInput) {
  const client = getSupabaseAdminClient();
  const storage = getPermanentMediaStorage();
  if (!client) throw new Error('LIBRARY_METADATA_UNAVAILABLE');
  if (!storage) throw new Error('PERMANENT_MEDIA_STORAGE_UNAVAILABLE');

  const existing = await client.from('generations')
    .select('id,user_id,type,storage_path,status,metadata')
    .eq('id', input.executionId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message || 'LIBRARY_METADATA_READ_FAILED');
  if (existing.data) return verifyExisting(existing.data as GenerationRow, input);

  const media = await mediaBytes(input);
  const folder = input.modality === 'image' ? 'images' : 'videos';
  const storageKey = `${input.userId}/${folder}/${input.executionId}.${extensionFor(media.mimeType)}`;
  const object = await storage.putObject({
    storageKey,
    contentType: media.mimeType,
    body: media.bytes,
  });
  const metadata = {
    executionId: input.executionId,
    mimeType: media.mimeType,
    sizeBytes: object.sizeBytes,
    ...(input.width == null ? {} : { width: input.width }),
    ...(input.height == null ? {} : { height: input.height }),
    ...(input.duration == null ? {} : { duration: input.duration }),
  };
  const inserted = await client.from('generations').insert({
    id: input.executionId,
    user_id: input.userId,
    type: input.modality,
    prompt: input.prompt,
    model_id: input.modelId,
    status: 'completed',
    storage_path: storageKey,
    metadata,
  }).select('id,user_id,type,storage_path,status,metadata').single();
  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const replay = await client.from('generations')
        .select('id,user_id,type,storage_path,status,metadata')
        .eq('id', input.executionId)
        .single();
      if (!replay.error && replay.data) return verifyExisting(replay.data as GenerationRow, input);
    }
    await storage.deleteObject(storageKey).catch(() => undefined);
    throw new Error(inserted.error.message || 'LIBRARY_METADATA_WRITE_FAILED');
  }
  return verifyExisting(inserted.data as GenerationRow, input);
}
