import { NextResponse } from 'next/server';
import { generateWithRunware } from '@/lib/ai/image-providers/runware';
import { RUNWARE_TEST_MODEL } from '@/lib/ai/image-providers/runware-meta';
import { isOwnerUser } from '@/lib/auth/owner';
import { createClient } from '@/src/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PROMPT_LENGTH = 2000;
const COOLDOWN_MS = 5_000;
const lastRequestAt = new Map<string, number>();
const inFlight = new Set<string>();

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return json({ error: 'Request origin is not allowed' }, 403);
  }

  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getUser();
  const user = data.user;

  if (authError || !user) return json({ error: 'Authentication required' }, 401);
  if (!isOwnerUser(user)) return json({ error: 'Not found' }, 404);
  if (!process.env.RUNWARE_API_KEY) return json({ error: 'Runware is not configured' }, 503);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Expected a JSON body' }, 400);
  }

  const provider = typeof body.provider === 'string' ? body.provider : '';
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

  if (provider !== 'runware') return json({ error: 'Provider is not allowed' }, 422);
  if (!prompt) return json({ error: 'A prompt is required' }, 400);
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return json({ error: `Prompt is too long (maximum ${MAX_PROMPT_LENGTH} characters)` }, 413);
  }

  const now = Date.now();
  if (inFlight.has(user.id)) return json({ error: 'A provider test is already running' }, 429);
  if (now - (lastRequestAt.get(user.id) ?? 0) < COOLDOWN_MS) {
    return json({ error: 'Wait a few seconds before running another provider test' }, 429);
  }

  inFlight.add(user.id);
  try {
    const result = await generateWithRunware({
      prompt,
      model: RUNWARE_TEST_MODEL,
      width: 512,
      height: 512,
      userId: user.id,
    });

    if (!result.success || !result.imageUrl) {
      console.error('[runware-test] owner test failed', {
        userId: user.id,
        requestId: result.requestId ?? null,
        error: result.error ?? 'Unknown provider error',
      });
      return json(
        { error: result.error ?? 'Image generation failed', requestId: result.requestId ?? null },
        502
      );
    }

    console.info('[runware-test] owner test completed', {
      userId: user.id,
      requestId: result.requestId ?? null,
      model: result.model,
    });

    return json({
      provider: result.provider,
      model: result.model,
      imageUrl: result.imageUrl,
      summary: result.summary,
    });
  } catch (error) {
    console.error('[runware-test] unexpected route failure', {
      userId: user.id,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return json({ error: 'Image generation failed' }, 500);
  } finally {
    inFlight.delete(user.id);
    lastRequestAt.set(user.id, Date.now());
  }
}
