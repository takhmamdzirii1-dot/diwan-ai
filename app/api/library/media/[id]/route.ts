import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { getPermanentMediaStorage } from '@/lib/ai/providers/media-storage';

export const dynamic = 'force-dynamic';

async function ownedAsset(id: string) {
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { client, status: 401 as const, asset: null };
  const { data, error } = await client.from('generations')
    .select('id,type,storage_path,status')
    .eq('id', id)
    .eq('status', 'completed')
    .maybeSingle();
  if (error || !data?.storage_path) return { client, status: 404 as const, asset: null };
  return { client, status: 200 as const, asset: data };
}

function downloadFilename(asset: { type: string; storage_path: string }) {
  const extension = asset.storage_path.split('.').pop()?.toLowerCase();
  const allowed = asset.type === 'video'
    ? new Set(['mp4', 'webm', 'mov'])
    : new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
  const safeExtension = extension && allowed.has(extension)
    ? (extension === 'jpeg' ? 'jpg' : extension)
    : asset.type === 'video' ? 'mp4' : 'png';
  return `vantra-${asset.type === 'video' ? 'video' : 'image'}.${safeExtension}`;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const owned = await ownedAsset(id);
  if (owned.status !== 200 || !owned.asset) {
    return NextResponse.json(
      { error: owned.status === 401 ? 'AUTHENTICATION_REQUIRED' : 'NOT_FOUND' },
      { status: owned.status }
    );
  }
  const storage = getPermanentMediaStorage();
  if (!storage) return NextResponse.json({ error: 'MEDIA_STORAGE_UNAVAILABLE' }, { status: 503 });
  const shouldDownload = new URL(request.url).searchParams.get('download') === '1';
  const signed = await storage.createPrivateReadUrl(
    owned.asset.storage_path,
    shouldDownload ? { downloadFilename: downloadFilename(owned.asset) } : undefined
  );
  const response = NextResponse.redirect(signed.url, 307);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const owned = await ownedAsset(id);
  if (owned.status !== 200 || !owned.asset) {
    return NextResponse.json(
      { error: owned.status === 401 ? 'AUTHENTICATION_REQUIRED' : 'NOT_FOUND' },
      { status: owned.status }
    );
  }
  const storage = getPermanentMediaStorage();
  if (!storage) return NextResponse.json({ error: 'MEDIA_STORAGE_UNAVAILABLE' }, { status: 503 });
  await storage.deleteObject(owned.asset.storage_path);
  const { error } = await owned.client.from('generations').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'LIBRARY_DELETE_FAILED' }, { status: 503 });
  return NextResponse.json({ deleted: true });
}
