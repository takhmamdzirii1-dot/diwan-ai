import { NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';
import { getChatUsageState } from '@/lib/chat/chat-usage.server';

export const dynamic = 'force-dynamic';

/**
 * Customer-safe chat capacity state. Exposes only the facing level
 * (Standard / Extended / High-usage Chat), the qualitative state, and the
 * next availability timestamp — never raw units, weights, or limits.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    let user = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const { data } = await supabase.auth.getUser(authHeader.substring(7));
      user = data.user;
    } else {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }
    if (!user) {
      return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
    }
    const state = await getChatUsageState(user.id);
    return NextResponse.json(state);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CHAT_USAGE_UNAVAILABLE';
    const status = /UNAVAILABLE/.test(code) ? 503 : 500;
    return NextResponse.json({ error: code }, { status });
  }
}
