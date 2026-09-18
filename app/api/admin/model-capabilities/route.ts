import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getOwnerAccess } from '@/lib/auth/owner';
import { validateModelCapabilities } from '@/lib/models/capability-validation';
import { resolveRuntimeModelReference } from '@/lib/models/runtime-config';

const requestSchema = z.object({
  modelKey: z.string().trim().min(1).max(300),
  capabilities: z.unknown(),
}).strict();

export async function PATCH(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'INVALID_MODEL_CAPABILITIES' }, { status: 400 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const model = await resolveRuntimeModelReference(client, body.data.modelKey);
  if (!model) return NextResponse.json({ error: 'MODEL_NOT_REGISTERED' }, { status: 404 });

  const capabilities = validateModelCapabilities(model.modality, body.data.capabilities);
  if (!capabilities.success) {
    return NextResponse.json({ error: 'INVALID_MODEL_CAPABILITIES' }, { status: 400 });
  }
  const { data, error } = await client.from('model_runtime_configs')
    .update({ capabilities: capabilities.data, updated_by: access.user.id })
    .eq('model_key', model.key)
    .eq('model_id', model.modelId)
    .eq('modality', model.modality)
    .select('model_key,capabilities,updated_at')
    .maybeSingle();
  if (!error && !data) return NextResponse.json({ error: 'MODEL_RUNTIME_CONFIG_REQUIRED' }, { status: 409 });
  if (error || !data) {
    console.error('[admin models] capability update failed', { code: error?.code, modelKey: model.key });
    return NextResponse.json({ error: 'MODEL_CAPABILITIES_UPDATE_FAILED' }, { status: 409 });
  }
  revalidatePath('/admin/models');
  revalidatePath('/admin/audit');
  revalidatePath('/studio', 'layout');
  return NextResponse.json({
    config: { modelKey: String(data.model_key), capabilities: data.capabilities, updatedAt: String(data.updated_at) },
  });
}
