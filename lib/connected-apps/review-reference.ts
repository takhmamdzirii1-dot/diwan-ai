import { z } from 'zod';

const reference = z.object({ toolName: z.literal('read_connected_file'), state: z.literal('result'),
  result: z.object({ status: z.literal('review_required'), reviewId: z.string().uuid() }) });
export const connectedReviewAnnotation = z.object({ type: z.literal('vantra-connected-review'), reviewId: z.string().uuid() }).strict();
export type ConnectedReviewAnnotation = z.infer<typeof connectedReviewAnnotation>;

/** References are not approval authority. The card loads the exact owned server snapshot. */
export function connectedReviewIds(message: { toolInvocations?: unknown; annotations?: unknown }): string[] {
  const annotations = Array.isArray(message.annotations) ? message.annotations.flatMap(item => {
    const parsed = connectedReviewAnnotation.safeParse(item);
    return parsed.success ? [parsed.data.reviewId] : [];
  }) : [];
  const tools = Array.isArray(message.toolInvocations) ? message.toolInvocations.flatMap(invocation => {
    const parsed = reference.safeParse(invocation);
    return parsed.success ? [parsed.data.result.reviewId] : [];
  }) : [];
  return [...new Set([...annotations, ...tools])].slice(0, 8);
}
