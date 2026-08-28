import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Provider = 'mock' | 'replicate' | 'fal' | 'together';

const ALLOWED_MODELS = new Set(['flux-1-pro', 'flux-realism-v2', 'sdxl-turbo']);
const ALLOWED_RATIOS = new Set(['1:1', '16:9', '9:16', '4:3']);
const ALLOWED_COUNTS = new Set([1, 2, 4]);

const RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1152, height: 896 },
};

/** Which provider to dispatch to — driven by env, defaults to the mock pipeline. */
function resolveProvider(): Provider {
  if (process.env.REPLICATE_API_TOKEN) return 'replicate';
  if (process.env.FAL_KEY) return 'fal';
  if (process.env.TOGETHER_API_KEY) return 'together';
  return 'mock';
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const model = typeof body.model === 'string' ? body.model : 'flux-1-pro';
    const ratio = typeof body.ratio === 'string' ? body.ratio : '1:1';
    const count = Number(body.count) || 1;

    if (!prompt) {
      return NextResponse.json({ error: 'A prompt is required' }, { status: 400 });
    }
    if (prompt.length > 2000) {
      return NextResponse.json({ error: 'Prompt too long (max 2000 characters)' }, { status: 413 });
    }
    if (!ALLOWED_MODELS.has(model)) {
      return NextResponse.json({ error: `Unsupported model: ${model}` }, { status: 422 });
    }
    if (!ALLOWED_RATIOS.has(ratio)) {
      return NextResponse.json({ error: `Unsupported aspect ratio: ${ratio}` }, { status: 422 });
    }
    if (!ALLOWED_COUNTS.has(count)) {
      return NextResponse.json({ error: 'Count must be 1, 2 or 4' }, { status: 422 });
    }

    const { width, height } = RATIO_DIMENSIONS[ratio];
    const provider = resolveProvider();

    switch (provider) {
      case 'replicate': {
        // TODO: wire Replicate — POST https://api.replicate.com/v1/predictions
        // headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` }
        // body: { version: <model version>, input: { prompt, width, height, num_outputs: count } }
        return NextResponse.json({ error: 'Replicate provider not wired yet' }, { status: 501 });
      }
      case 'fal': {
        // TODO: wire Fal.ai — POST https://fal.run/fal-ai/flux-pro
        // headers: { Authorization: `Key ${process.env.FAL_KEY}` }
        // body: { prompt, image_size: ratio, num_images: count }
        return NextResponse.json({ error: 'Fal.ai provider not wired yet' }, { status: 501 });
      }
      case 'together': {
        // TODO: wire Together AI — POST https://api.together.xyz/v1/images/generations
        // headers: { Authorization: `Bearer ${process.env.TOGETHER_API_KEY}` }
        // body: { model, prompt, width, height, n: count }
        return NextResponse.json({ error: 'Together AI provider not wired yet' }, { status: 501 });
      }
      case 'mock':
      default: {
        // Deterministic placeholders so the full frontend flow works end-to-end.
        await new Promise((resolve) => setTimeout(resolve, 1800));
        const seed = Date.now();
        const images = Array.from({ length: count }, (_, i) => ({
          url: `https://picsum.photos/seed/${seed}-${i}/${width}/${height}`,
          width,
          height,
        }));
        return NextResponse.json({
          provider: 'mock',
          model,
          ratio,
          count,
          creditsUsed: count,
          images,
        });
      }
    }
  } catch {
    return NextResponse.json({ error: 'Image generation failed — please try again' }, { status: 500 });
  }
}
