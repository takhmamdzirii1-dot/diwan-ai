import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/src/lib/supabase/server';
import {
  getManualTransferDestination,
  PaymentGatewayUnavailableError,
  requireGateway,
} from '@/lib/payments/gateways';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  planId: z.string().uuid(),
  method: z.enum(['baridimob', 'ccp', 'cib', 'edahabia']),
});

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

export async function GET() {
  const { supabase, user } = await authenticatedClient();
  if (!user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  const { data, error } = await supabase
    .from('payment_orders')
    .select('id,plan_id,order_kind,plan_name,plan_description,payment_method,amount_dzd,credits_amount,payment_reference,customer_reference,status,submitted_at,reviewed_at,review_note,resulting_credit_transaction_id,resulting_entitlement_id,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) {
    console.error('[payments] order list failed', { code: error.code });
    return NextResponse.json({ error: 'PAYMENT_ORDERS_UNAVAILABLE' }, { status: 503 });
  }
  const orders = (data ?? []).map((order) => (
    order.status === 'pending' && !order.submitted_at
      ? { ...order, status: 'draft' }
      : order
  ));
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PAYMENT_REQUEST' }, { status: 400 });

  try {
    requireGateway(parsed.data.method);
  } catch (error) {
    if (error instanceof PaymentGatewayUnavailableError) {
      return NextResponse.json({ error: 'GATEWAY_UNAVAILABLE', method: error.method }, { status: 409 });
    }
    throw error;
  }

  const destination = parsed.data.method === 'baridimob' || parsed.data.method === 'ccp'
    ? getManualTransferDestination(parsed.data.method) : null;
  if (!destination) return NextResponse.json({ error: 'MANUAL_TRANSFER_UNAVAILABLE' }, { status: 503 });

  const { supabase, user } = await authenticatedClient();
  if (!user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });

  const { data, error } = await supabase.rpc('create_manual_payment_order', {
    p_plan_id: parsed.data.planId,
    p_payment_method: parsed.data.method,
  });
  if (error || !data) {
    console.error('[payments] order creation failed', { code: error?.code });
    const safeCode = error?.message === 'PAYMENT_PLAN_UNAVAILABLE'
      ? 'PAYMENT_PLAN_UNAVAILABLE'
      : 'PAYMENT_ORDER_CREATE_FAILED';
    return NextResponse.json({ error: safeCode }, { status: safeCode === 'PAYMENT_PLAN_UNAVAILABLE' ? 409 : 500 });
  }

  return NextResponse.json({ order: data, destination }, { status: 201 });
}
