import 'server-only';
import { createClient } from '@/src/lib/supabase/server';

export async function mediaUser(request: Request) {
  const client = await createClient();
  const header = request.headers.get('authorization');
  const value = header?.startsWith('Bearer ') ? await client.auth.getUser(header.slice(7)) : await client.auth.getUser();
  return value.data.user;
}

export const MEDIA_PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
