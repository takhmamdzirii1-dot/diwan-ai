import { randomBytes, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/src/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { readInstallationIdentity } from '@/lib/access/free-device.server';
import { deviceProofMac, verifiedBrowserKeyHash } from '@/lib/access/free-device-identity';
import { getStudioAccess } from '@/lib/access/trial-access';

export const dynamic = 'force-dynamic';

const proofSchema = z.object({
  challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  expires: z.number().int(),
  mac: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  publicKey: z.string().regex(/^[A-Za-z0-9_-]{80,300}$/),
  signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
});

function challengeMac(userId: string, installationHash: string, challenge: string, expires: number) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('DEVICE_IDENTITY_UNAVAILABLE');
  return deviceProofMac(secret, userId, installationHash, challenge, expires);
}

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const installationHash = await readInstallationIdentity();
  if (!installationHash) return null;
  return { user, installationHash };
}

export async function GET() {
  const current = await context();
  if (!current) return NextResponse.json({ error: 'DEVICE_PROOF_UNAVAILABLE' }, { status: 409 });
  const access = await getStudioAccess(current.user);
  if (access.kind === 'paid_active') return new Response(null, { status: 204 });
  const challenge = randomBytes(32).toString('base64url');
  const expires = Date.now() + 5 * 60_000;
  return NextResponse.json({ challenge, expires,
    mac: challengeMac(current.user.id, current.installationHash, challenge, expires) },
    { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const current = await context();
  if (!current) return NextResponse.json({ error: 'DEVICE_PROOF_UNAVAILABLE' }, { status: 409 });
  const access = await getStudioAccess(current.user);
  if (access.kind === 'paid_active') return NextResponse.json({ freeEligibility: null });
  const parsed = proofSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_DEVICE_PROOF' }, { status: 400 });
  const proof = parsed.data;
  if (proof.expires <= Date.now() || proof.expires > Date.now() + 5 * 60_000) {
    return NextResponse.json({ error: 'DEVICE_PROOF_EXPIRED' }, { status: 400 });
  }
  const expected = Buffer.from(challengeMac(current.user.id, current.installationHash, proof.challenge, proof.expires), 'base64url');
  const received = Buffer.from(proof.mac, 'base64url');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: 'INVALID_DEVICE_PROOF' }, { status: 400 });
  }
  const keyHash = verifiedBrowserKeyHash(proof.publicKey, proof.signature, proof.challenge);
  if (!keyHash) {
    return NextResponse.json({ error: 'INVALID_DEVICE_PROOF' }, { status: 400 });
  }
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: 'DEVICE_IDENTITY_UNAVAILABLE' }, { status: 503 });
  const { data, error } = await admin.rpc('link_free_device_identity', {
    p_user_id: current.user.id, p_identity_kind: 'webcrypto', p_identity_hash: keyHash,
  });
  if (error && !['PGRST202', '42883'].includes(error.code)) {
    return NextResponse.json({ error: 'DEVICE_IDENTITY_UNAVAILABLE' }, { status: 503 });
  }
  return NextResponse.json({ freeEligibility: error ? null : data },
    { headers: { 'Cache-Control': 'private, no-store' } });
}
