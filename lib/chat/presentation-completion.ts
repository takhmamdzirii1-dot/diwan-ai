import { parseChatArtifact, type ChatMessagePart } from '@/lib/artifacts/chat-parts';

/** Resolve a structured fallback through the same validated artifact parser used by Chat. */
export function presentationCompletion(text: string, artifacts: ChatMessagePart[], requestedSlideCount: number | null,
  language: string): { text: string; artifacts: ChatMessagePart[]; valid: boolean } {
  if (requestedSlideCount === null) return { text, artifacts, valid: true };
  const parsed = parseChatArtifact(text, language);
  const parts: ChatMessagePart[] = parsed?.type === 'presentation'
    ? [...artifacts, { type: 'presentation', artifact: parsed }] : artifacts;
  const valid = parts.some((part) => part.type === 'presentation'
    && part.artifact.slides.length === requestedSlideCount);
  return { text: parsed?.type === 'presentation' ? '' : text, artifacts: parts, valid };
}
