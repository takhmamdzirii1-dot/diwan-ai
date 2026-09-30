import { z } from 'zod';

export const searchContextSchema = z.object({
  version: z.literal(1), subject: z.string().trim().min(1).max(300),
  timeframe: z.string().max(80), fresh: z.boolean(),
  mode: z.enum(['structured_fact', 'fresh_news', 'general_web']),
  sourceUrls: z.array(z.string().url().max(2048).refine((url) => url.startsWith('https://'))).max(8),
}).strict();
export type SearchTurnContext = z.infer<typeof searchContextSchema>;
// Conversational intent only: no evidence or URLs can enter through this schema.
export const searchSubjectSchema = searchContextSchema.omit({ sourceUrls: true }).strict();
export type SearchSubjectContext = z.infer<typeof searchSubjectSchema>;
const reference = z.object({ type: z.literal('vantra-search-context'), executionId: z.string().uuid() }).strict();

/** A reference is not evidence. The server must load it with user ownership and terminal validation. */
export function searchContextReference(annotations: unknown) {
  if (!Array.isArray(annotations)) return null;
  for (const annotation of annotations.slice(0, 8)) {
    const parsed = reference.safeParse(annotation);
    if (parsed.success) return parsed.data;
  }
  return null;
}

export function precedingSearchReference(messages: readonly { role?: string; annotations?: unknown }[]) {
  const last = messages.at(-1);
  return last?.role === 'assistant' ? searchContextReference(last.annotations) : null;
}
