import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  'audio/webm',
  'audio/wav',
  'audio/mpeg',
  'audio/mp4',
  // Some browsers report variants — accept only these explicit aliases
  'audio/webm;codecs=opus',
  'audio/x-wav',
  'audio/x-m4a',
]);

export async function POST(request: Request) {
  try {
    // Validate the request body FIRST (cheap, no info leak, testable without key)
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      // 400 — not multipart / malformed body
      return NextResponse.json({ error: 'Expected multipart/form-data with an audio file' }, { status: 400 });
    }
    const audio = formData.get('audio');

    // 400 — missing / wrong type
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }
    if (audio.size === 0) {
      return NextResponse.json({ error: 'Recording is empty — try again' }, { status: 400 });
    }

    // 413 — size limit
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: 'Recording too large (max 10MB)' },
        { status: 413 }
      );
    }

    // 415 — MIME allowlist
    const mime = (audio.type || '').toLowerCase();
    const baseMime = mime.split(';')[0].trim();
    if (!ALLOWED_MIME.has(mime) && !ALLOWED_MIME.has(baseMime)) {
      return NextResponse.json(
        { error: `Unsupported audio format (${mime || 'unknown'}). Allowed: webm, wav, mpeg, mp4.` },
        { status: 415 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Voice transcription is not configured (missing GROQ_API_KEY)' },
        { status: 500 }
      );
    }

    const upstream = new FormData();
    upstream.append('file', audio, audio.name || 'recording.webm');
    upstream.append('model', 'whisper-large-v3');
    upstream.append('response_format', 'json');

    const res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Transcription service error (${res.status})`, detail: detail.slice(0, 300) },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ text: typeof data.text === 'string' ? data.text : '' });
  } catch {
    return NextResponse.json({ error: 'Transcription failed — please try again' }, { status: 500 });
  }
}
