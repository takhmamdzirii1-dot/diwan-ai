import 'server-only';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { searchContextSchema, searchSubjectSchema, type SearchTurnContext, type SearchSubjectContext } from './search-context';

type SearchExecution = { user_id: string; state: string; modality: string; execution_metadata: unknown };
type Lookup = (executionId: string, userId: string) => Promise<SearchExecution | null>;
const lookup: Lookup = async (executionId, userId) => {
  const client = getSupabaseAdminClient();
  if (!client) return null;
  const { data, error } = await client.from('ai_executions').select('user_id,state,modality,execution_metadata')
    .eq('id', executionId).eq('user_id', userId).eq('modality', 'chat').maybeSingle();
  return error ? null : data;
};

export async function loadSearchTurnContext(userId: string, executionId: string,
  read: Lookup = lookup): Promise<SearchTurnContext | null> {
  const data = await read(executionId, userId).catch(() => null);
  if (!data || data.user_id !== userId || data.modality !== 'chat' || data.state !== 'completed'
    || !data.execution_metadata || typeof data.execution_metadata !== 'object') return null;
  const metadata = data.execution_metadata as Record<string, unknown>;
  if (metadata.webValidationOutcome !== 'accepted') return null;
  const parsed = searchContextSchema.safeParse(metadata.searchTurnContext);
  return parsed.success ? parsed.data : null;
}

/** A failed owned turn may supply subject/timeframe, never trusted source evidence. */
export async function loadSearchSubjectContext(userId: string, executionId: string,
  read: Lookup = lookup): Promise<SearchSubjectContext | null> {
  const data = await read(executionId, userId).catch(() => null);
  if (!data || data.user_id !== userId || data.modality !== 'chat'
    || !['completed', 'failed', 'partial_failed'].includes(data.state)
    || !data.execution_metadata || typeof data.execution_metadata !== 'object') return null;
  const parsed = searchSubjectSchema.safeParse((data.execution_metadata as Record<string, unknown>).searchSubjectContext);
  return parsed.success ? parsed.data : null;
}
