import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'INVALID_PAYMENT_ORDER' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  const { data, error } = await supabase.from('payment_orders')
    .select('id,plan_id,payment_method,status,plan_name,amount_dzd')
    .eq('id', id).eq('user_id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'PAYMENT_STATUS_UNAVAILABLE' }, { status: 503 });
  if (!data) return NextResponse.json({ error: 'PAYMENT_ORDER_NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ order: data });
}
