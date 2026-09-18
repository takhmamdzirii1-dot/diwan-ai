import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getOwnerAccess } from '@/lib/auth/owner';
import { findRegistryModel } from '@/lib/models/runtime-config';

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const mediaUrl = z.string().trim().max(500).refine((value) => {
  if (!value) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'INVALID_MODEL_MEDIA_URL').transform((value) => value || null);

const schema = z.object({
  modelKey: z.string().trim().min(1).max(300),
  displayName: z.string().trim().min(1).max(80),
  shortDescription: optionalText(240),
  mediaUrl,
  category: optionalText(60),
  sortOrder: z.number().int().min(0).max(10_000),
  visibleInStudio: z.boolean(),
  availabilityLabel: optionalText(60),
}).strict();

export async function PATCH(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_MODEL_PRESENTATION' }, { status: 400 });
  const registryModel = findRegistryModel(parsed.data.modelKey);
  if (!registryModel) return NextResponse.json({ error: 'MODEL_NOT_REGISTERED' }, { status: 404 });

  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { data, error } = await client.rpc('admin_update_model_presentation', {
    p_model_key: registryModel.key,
    p_model_id: registryModel.modelId,
    p_modality: registryModel.modality,
    p_display_name: parsed.data.displayName,
    p_short_description: parsed.data.shortDescription,
    p_media_url: parsed.data.mediaUrl,
    p_category: parsed.data.category,
    p_sort_order: parsed.data.sortOrder,
    p_studio_visible: parsed.data.visibleInStudio,
    p_availability_label: parsed.data.availabilityLabel,
    p_updated_by: access.user.id,
  });
  if (error) {
    console.error('[admin models] presentation update failed', { code: error.code, modelKey: registryModel.key });
    return NextResponse.json({ error: 'MODEL_PRESENTATION_UPDATE_FAILED' }, { status: 409 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ error: 'MODEL_PRESENTATION_UPDATE_FAILED' }, { status: 409 });
  revalidatePath('/admin/models');
  revalidatePath('/admin/audit');
  revalidatePath('/studio', 'layout');
  return NextResponse.json({ presentation: {
    modelKey: registryModel.key,
    displayName: String(row.customer_display_name),
    shortDescription: row.customer_short_description == null ? null : String(row.customer_short_description),
    mediaUrl: row.customer_media_url == null ? null : String(row.customer_media_url),
    category: row.customer_category == null ? null : String(row.customer_category),
    sortOrder: Number(row.customer_sort_order),
    visibleInStudio: Boolean(row.studio_visible),
    availabilityLabel: row.customer_availability_label == null ? null : String(row.customer_availability_label),
    updatedAt: String(row.updated_at),
  } });
}
