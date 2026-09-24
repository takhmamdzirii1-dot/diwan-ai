import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getOwnerAccess } from '@/lib/auth/owner';
import { validateModelCapabilities } from '@/lib/models/capability-validation';
import { normalizeModelSurfaceVisibility } from '@/lib/models/capabilities';
import { loadModelRuntimeOverrides, resolveRuntimeModelReference } from '@/lib/models/runtime-config';
import { syncModelCapabilities } from '@/lib/models/capability-sync';

const requestSchema = z.object({
  modelKey: z.string().trim().min(1).max(300),
  capabilities: z.unknown(),
  surfaceVisibility: z.object({
    chat: z.boolean().optional(),
    image: z.boolean().optional(),
    video: z.boolean().optional(),
    textToVideo: z.boolean().optional(),
    imageToVideo: z.boolean().optional(),
    videoToVideo: z.boolean().optional(),
  }).strict().optional(),
}).strict();

function refreshViews() {
  revalidatePath('/admin/models');
  revalidatePath('/admin/audit');
  revalidatePath('/studio', 'layout');
}

async function ownerClient(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return { error: 'FORBIDDEN', status: 403 } as const;
  const access = await getOwnerAccess();
  if (!access.user) return { error: 'AUTHENTICATION_REQUIRED', status: 401 } as const;
  if (!access.isOwner) return { error: 'FORBIDDEN', status: 403 } as const;
  const client = getSupabaseAdminClient();
  if (!client) return { error: 'ADMIN_DATA_UNAVAILABLE', status: 503 } as const;
  return { client, userId: access.user.id };
}

export async function PATCH(request: Request) {
  const access = await ownerClient(request);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'INVALID_MODEL_CAPABILITIES' }, { status: 400 });
  const client = access.client;
  const model = await resolveRuntimeModelReference(client, body.data.modelKey);
  if (!model) return NextResponse.json({ error: 'MODEL_NOT_REGISTERED' }, { status: 404 });

  const capabilities = validateModelCapabilities(model.modality, body.data.capabilities);
  if (!capabilities.success) {
    return NextResponse.json({ error: 'INVALID_MODEL_CAPABILITIES' }, { status: 400 });
  }
  const stored = (await loadModelRuntimeOverrides(client, model.key))[0];
  if (!stored) return NextResponse.json({ error: 'MODEL_RUNTIME_CONFIG_REQUIRED' }, { status: 409 });
  const manualCapabilityChange = JSON.stringify(stored.capabilities) !== JSON.stringify(capabilities.data);
  const nextVisibility = body.data.surfaceVisibility
    ? normalizeModelSurfaceVisibility(model.modality, body.data.surfaceVisibility)
    : stored.surfaceVisibility;
  const visibilityChanged = JSON.stringify(nextVisibility) !== JSON.stringify(stored.surfaceVisibility);
  const current = await client.from('model_runtime_configs')
    .update({
      capabilities: capabilities.data,
      ...(manualCapabilityChange ? {
        capability_source_type: 'admin_override', capability_confidence: 'manual',
        capability_sync_status: 'ok', capability_sync_error: null,
      } : {}),
      ...(body.data.surfaceVisibility ? { surface_visibility: nextVisibility } : {}),
      updated_by: access.userId,
    })
    .eq('model_key', model.key)
    .eq('model_id', model.modelId)
    .eq('modality', model.modality)
    .select('model_key,capabilities,surface_visibility,capability_source_type,capability_confidence,capability_sync_status,updated_at')
    .maybeSingle();
  let data: any = current.data;
  let error = current.error;
  if (error && ['42703', 'PGRST204'].includes(error.code)) {
    if (visibilityChanged) return NextResponse.json({ error: 'CAPABILITY_SCHEMA_UPDATE_REQUIRED' }, { status: 503 });
    const legacy = await client.from('model_runtime_configs')
      .update({ capabilities: capabilities.data, updated_by: access.userId })
      .eq('model_key', model.key).eq('model_id', model.modelId).eq('modality', model.modality)
      .select('model_key,capabilities,updated_at').maybeSingle();
    data = legacy.data ? { ...legacy.data, surface_visibility: stored.surfaceVisibility,
      capability_source_type: stored.capabilitySourceType ?? 'unknown',
      capability_confidence: stored.capabilityConfidence ?? 'unknown',
      capability_sync_status: stored.capabilitySyncStatus ?? 'partial' } : null;
    error = legacy.error;
  }
  if (!error && !data) return NextResponse.json({ error: 'MODEL_RUNTIME_CONFIG_REQUIRED' }, { status: 409 });
  if (error || !data) {
    console.error('[admin models] capability update failed', { code: error?.code, modelKey: model.key });
    return NextResponse.json({ error: 'MODEL_CAPABILITIES_UPDATE_FAILED' }, { status: 409 });
  }
  refreshViews();
  return NextResponse.json({
    config: { modelKey: String(data.model_key), capabilities: data.capabilities,
      surfaceVisibility: normalizeModelSurfaceVisibility(model.modality, data.surface_visibility),
      sourceType: data.capability_source_type, confidence: data.capability_confidence,
      syncStatus: data.capability_sync_status,
      updatedAt: String(data.updated_at) },
  });
}

export async function POST(request: Request) {
  const access = await ownerClient(request);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = z.object({ modelKey: z.string().trim().min(1).max(300) }).strict()
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'INVALID_MODEL_KEY' }, { status: 400 });
  const model = await resolveRuntimeModelReference(access.client, body.data.modelKey);
  if (!model) return NextResponse.json({ error: 'MODEL_NOT_REGISTERED' }, { status: 404 });
  const stored = (await loadModelRuntimeOverrides(access.client, model.key))[0];
  if (!stored) return NextResponse.json({ error: 'MODEL_RUNTIME_CONFIG_REQUIRED' }, { status: 409 });
  try {
    const result = await syncModelCapabilities(access.client, {
      modelKey: model.key, modelId: model.modelId, modality: model.modality,
      capabilities: stored.capabilities, sourceType: stored.capabilitySourceType ?? 'unknown',
      actorId: access.userId,
    });
    refreshViews();
    return NextResponse.json({ config: result });
  } catch (cause) {
    console.error('[admin models] capability sync failed', { modelKey: model.key,
      code: cause instanceof Error ? cause.message : 'MODEL_CAPABILITY_SYNC_FAILED' });
    return NextResponse.json({ error: 'MODEL_CAPABILITY_SYNC_FAILED' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const access = await ownerClient(request);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = z.object({ modelKey: z.string().trim().min(1).max(300) }).strict()
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'INVALID_MODEL_KEY' }, { status: 400 });
  const model = await resolveRuntimeModelReference(access.client, body.data.modelKey);
  if (!model) return NextResponse.json({ error: 'MODEL_NOT_REGISTERED' }, { status: 404 });
  const stored = (await loadModelRuntimeOverrides(access.client, model.key))[0];
  if (!stored) return NextResponse.json({ error: 'MODEL_RUNTIME_CONFIG_REQUIRED' }, { status: 409 });
  const cleared = await access.client.from('model_runtime_configs')
    .update({ capability_source_type: 'unknown', capability_confidence: 'unknown', updated_by: access.userId })
    .eq('model_key', model.key).eq('model_id', model.modelId).select('model_key').maybeSingle();
  if (cleared.error || !cleared.data) return NextResponse.json({ error: 'MODEL_CAPABILITY_SYNC_FAILED' }, { status: 503 });
  try {
    const result = await syncModelCapabilities(access.client, {
      modelKey: model.key, modelId: model.modelId, modality: model.modality,
      capabilities: stored.capabilities, sourceType: 'unknown', actorId: access.userId,
    });
    refreshViews();
    return NextResponse.json({ config: result });
  } catch {
    return NextResponse.json({ error: 'MODEL_CAPABILITY_SYNC_FAILED' }, { status: 503 });
  }
}
