import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';

export const dynamic = 'force-dynamic';
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf',
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'INVALID_PAYMENT_ORDER' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const customerReference = String(form?.get('customerReference') ?? '').trim();
  if (customerReference.length < 2 || customerReference.length > 200) {
    return NextResponse.json({ error: 'INVALID_TRANSFER_REFERENCE' }, { status: 400 });
  }

  const proof = form?.get('proof');
  let proofPath: string | null = null;
  if (proof instanceof File && proof.size > 0) {
    const extension = MIME_EXTENSIONS[proof.type];
    if (!extension || proof.size > MAX_PROOF_BYTES) {
      return NextResponse.json({ error: 'INVALID_PAYMENT_PROOF' }, { status: 400 });
    }
    proofPath = `${user.id}/payments/${id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(proofPath, proof, {
      contentType: proof.type,
      upsert: false,
    });
    if (uploadError) {
      console.error('[payments] proof upload failed', { code: uploadError.name });
      return NextResponse.json({ error: 'PAYMENT_PROOF_UPLOAD_FAILED' }, { status: 500 });
    }
  }

  const { data, error } = await supabase.rpc('submit_manual_payment', {
    p_payment_order_id: id,
    p_customer_reference: customerReference,
    p_proof_storage_path: proofPath,
  });
  if (error || !data) {
    if (proofPath) await supabase.storage.from('payment-proofs').remove([proofPath]);
    console.error('[payments] payment submission failed', { code: error?.code });
    const safeCode = error?.message === 'PAYMENT_ORDER_EXPIRED'
      ? 'PAYMENT_ORDER_EXPIRED'
      : error?.message === 'PAYMENT_ORDER_NOT_SUBMITTABLE'
        ? 'PAYMENT_ORDER_NOT_SUBMITTABLE'
        : 'PAYMENT_SUBMISSION_FAILED';
    return NextResponse.json({ error: safeCode }, { status: safeCode === 'PAYMENT_SUBMISSION_FAILED' ? 500 : 409 });
  }
  return NextResponse.json({ order: data });
}
