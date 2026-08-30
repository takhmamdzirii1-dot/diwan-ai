import { NextResponse } from 'next/server';
import { generateWithPollinations } from '@/lib/ai/image-providers/pollinations';
import { generateWithMock } from '@/lib/ai/image-providers/mock';
import { createClient } from '@/lib/supabase/server';
import { getUserPollinationsConnection } from '@/lib/ai/provider-connections';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PROMPT_LEN = 2000;
const MAX_COUNT = 4;

const RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1152, height: 896 },
};

const PROVIDER_MODELS: Record<string, Set<string>> = {
  pollinations: new Set(['flux', 'turbo', 'kontext']),
  mock: new Set(['placeholder']),
};
const ALLOWED_RATIOS = new Set(Object.keys(RATIO_DIMENSIONS));
const ALLOWED_PROVIDERS = new Set(['pollinations', 'mock']);

/** App-level abuse guard: 1 generation / 5s per caller, 1 concurrent.
 *  In-memory by design (single-region instance); swap for Upstash/Supabase
 *  when the app scales horizontally. */
const RATE_WINDOW_MS = 5000;
const lastRequestAt = new Map<string, number>();
const inFlight = new Set<string>();

function rateLimit(key: string): string | null {
  const now = Date.now();
  const last = lastRequestAt.get(key) ?? 0;
  if (now - last < RATE_WINDOW_MS) return 'Cooldown active — wait a few seconds between renders';
  if (inFlight.has(key)) return 'A render is already in progress for this account';
  return null;
}

export async function POST(request: Request) {
  const started = Date.now();

  // ── Auth (optional — guests allowed on free providers) ──
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {
    userId = null;
  }

  // ── Body validation ──
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const provider = typeof body.provider === 'string' ? body.provider : 'mock';
  const model = typeof body.model === 'string' ? body.model : 'flux';
  const ratio = typeof body.ratio === 'string' ? body.ratio : '1:1';
  const count = Math.min(Number(body.count) || 1, MAX_COUNT);
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : undefined;

  if (!prompt) return NextResponse.json({ error: 'A prompt is required' }, { status: 400 });
  if (prompt.length > MAX_PROMPT_LEN) {
    return NextResponse.json({ error: `Prompt too long (max ${MAX_PROMPT_LEN} characters)` }, { status: 413 });
  }
  if (!ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 422 });
  }
  if (!PROVIDER_MODELS[provider]?.has(model)) {
    return NextResponse.json(
      { error: `Model ${model} is not available for provider ${provider}` },
      { status: 422 }
    );
  }
  if (!ALLOWED_RATIOS.has(ratio)) {
    return NextResponse.json({ error: `Unsupported aspect ratio: ${ratio}` }, { status: 422 });
  }

  // ── Rate limit (per authenticated user, else per IP) ──
  let rateKey = 'anon';
  if (userId) rateKey = `user:${userId}`;
  else {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    rateKey = `ip:${ip}`;
  }
  const limited = rateLimit(rateKey);
  if (limited) {
    return NextResponse.json({ error: limited }, { status: 429 });
  }
  inFlight.add(rateKey);

  try {
    const dims = RATIO_DIMENSIONS[ratio];

    if (provider === 'pollinations') {
      const connection = userId ? await getUserPollinationsConnection(userId) : null;
      const pollinationsToken = connection && !connection.expired ? connection.token : undefined;
      const result = await generateWithPollinations({
        prompt,
        model,
        width: dims.width,
        height: dims.height,
        userId: userId ?? undefined,
        imageUrl,
        token: pollinationsToken ?? undefined,
      });

      if (!result.success) {
        const status = /rate limit/i.test(result.error || '') ? 429 : 502;
        return NextResponse.json({ error: result.error }, { status });
      }

      // Analytics only — no prompt/image retention beyond the response.
      console.info(
        `[image-gen] user=${userId ?? 'guest'} provider=pollinations model=${model} ` +
          `ratio=${ratio} ms=${Date.now() - started} ok=true`
      );

      return NextResponse.json({
        provider: 'pollinations',
        model,
        ratio,
        count: 1,
        creditsUsed: 0, // free tier — user-funded ecosystem, not VANTRA credits
        images: [{ url: result.imageData, width: dims.width, height: dims.height }],
        reconnectRequired: connection?.expired ?? false,
        requestId: result.requestId,
      });
    }

    // provider === 'mock'
    const result = await generateWithMock({
      prompt,
      width: dims.width,
      height: dims.height,
      count,
    });

    console.info(
      `[image-gen] user=${userId ?? 'guest'} provider=mock model=placeholder ` +
        `ratio=${ratio} ms=${Date.now() - started} ok=true`
    );

    return NextResponse.json({
      provider: 'mock',
      model: 'placeholder',
      ratio,
      count,
      creditsUsed: 0,
      images: result.images,
    });
  } catch {
    return NextResponse.json(
      { error: 'Image generation failed — please try again' },
      { status: 500 }
    );
  } finally {
    inFlight.delete(rateKey);
    lastRequestAt.set(rateKey, Date.now());
  }
}
