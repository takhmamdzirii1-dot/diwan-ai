import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'INVALID_PAYMENT_ORDER' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('cancel_manual_payment', {
    p_payment_order_id: id,
  });
  if (error || !data) {
    const safeCode = error?.message === 'PAYMENT_ORDER_NOT_FOUND'
      ? 'PAYMENT_ORDER_NOT_FOUND'
      : error?.message === 'PAYMENT_ORDER_NOT_CANCELLABLE'
        ? 'PAYMENT_ORDER_NOT_CANCELLABLE'
        : 'PAYMENT_CANCELLATION_FAILED';
    return NextResponse.json({ error: safeCode }, {
      status: safeCode === 'PAYMENT_ORDER_NOT_FOUND' ? 404 : safeCode === 'PAYMENT_CANCELLATION_FAILED' ? 500 : 409,
    });
  }

  return NextResponse.json({ result: data });
}
