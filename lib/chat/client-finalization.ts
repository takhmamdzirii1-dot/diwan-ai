import { validatedArtifactPartFromToolResult, type ChatMessagePart } from '@/lib/artifacts/chat-parts';
import { getArtifactTool } from '@/lib/artifacts/tool-registry';
import { searchContextReference } from '@/lib/web/search-context';
type SearchReference = NonNullable<ReturnType<typeof searchContextReference>>;

export type CanonicalStreamStatus = 'completed' | 'aborted' | 'error' | 'unverified';
export function hasUsableCanonicalOutput(status: CanonicalStreamStatus, text: string, artifacts: ChatMessagePart[]): boolean {
  return status === 'completed' && (text.trim().length > 0 || artifacts.some((part) =>
    'artifact' in part || part.type === 'file' && 'content' in part));
}
export type ChatTerminationReason = 'completed' | 'provider_error' | 'network_error' | 'user_stop'
  | 'navigation_abort' | 'conversation_switch_abort' | 'verification_failed';
export type ChatRequestOutcome = { requestId: string; conversationId: string; reason: ChatTerminationReason };

export class ChatRequestTracker {
  private active: { requestId: string; conversationId: string; reason: ChatTerminationReason | null } | null = null;

  begin(requestId: string, conversationId: string) {
    this.active = { requestId, conversationId, reason: null };
  }

  finish(requestId: string, conversationId: string, reason: ChatTerminationReason): ChatRequestOutcome | null {
    if (!this.active || this.active.requestId !== requestId || this.active.conversationId !== conversationId || this.active.reason) return null;
    this.active.reason = reason;
    return { requestId, conversationId, reason };
  }

  get current() { return this.active && { ...this.active }; }
}

export function restoreCanonicalAssistantText<T extends { id: string; role: string; content: string }>(
  messages: T[], messageId: string, text: string,
): T[] {
  const index = messages.findIndex((message) => message.id === messageId && message.role === 'assistant');
  if (index < 0 || messages[index].content === text) return messages;
  return messages.map((message, position) => position === index ? { ...message, content: text } : message);
}

export class ChatStreamFinalizer {
  private text = '';
  private artifacts: ChatMessagePart[] = [];
  private rawStatus: CanonicalStreamStatus | null = null;
  private consumerSettled = false;
  private finalized = false;
  private invalidated = false;
  private searchReference: SearchReference | null = null;

  constructor(readonly requestId: string,
    private readonly commit: (result: { requestId: string; text: string; artifacts: ChatMessagePart[];
      status: CanonicalStreamStatus; annotations?: SearchReference[] }) => void) {}

  setSearchReference(reference: SearchReference) { if (!this.invalidated) this.searchReference = reference; }

  append(delta: string) {
    if (!this.rawStatus && !this.invalidated) this.text += delta;
  }

  get textChars() { return this.text.length; }
  get artifactCount() { return this.artifacts.length; }

  appendArtifact(part: ChatMessagePart) {
    if (!this.rawStatus && !this.invalidated && ('artifact' in part || part.type === 'file' && 'content' in part)
      && !this.artifacts.some((existing) => 'artifact' in existing && 'artifact' in part
        && existing.artifact.id === part.artifact.id)) this.artifacts.push(part);
  }

  consumerDone() {
    this.consumerSettled = true;
    this.maybeFinalize();
  }

  rawDone(status: CanonicalStreamStatus) {
    if (this.rawStatus) return;
    this.rawStatus = status;
    this.maybeFinalize();
  }

  invalidate() { this.invalidated = true; }

  private maybeFinalize() {
    if (this.invalidated || this.finalized || !this.rawStatus) return;
    if (this.rawStatus === 'completed' && !this.consumerSettled) return;
    this.finalized = true;
    this.commit({ requestId: this.requestId, text: this.text, artifacts: this.artifacts, status: this.rawStatus,
      ...(this.searchReference ? { annotations: [this.searchReference] } : {}) });
  }
}

// Read a separate branch of the AI SDK data stream. The SDK consumer may fail
// independently; only these original text frames form the canonical answer.
export async function consumeCanonicalChatStream(stream: ReadableStream<Uint8Array>,
  append: (delta: string) => void, signal?: AbortSignal,
  onErrorKind?: (reason: 'provider_error' | 'network_error') => void,
  onArtifact?: (part: ChatMessagePart) => void,
  onToolEvent?: (event: { toolName: string; called: boolean; resultValidated: boolean }) => void,
  onSearchReference?: (reference: SearchReference) => void): Promise<CanonicalStreamStatus> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let streamError = false;
  let providerError = false;
  let verificationFailed = false;
  let hardError = false;
  const toolCalls = new Map<string, string>();
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let newline = pending.indexOf('\n');
      while (newline !== -1) {
        const line = pending.slice(0, newline).trimEnd();
        pending = pending.slice(newline + 1);
        if (line.startsWith('0:')) {
          try {
            const delta: unknown = JSON.parse(line.slice(2));
            if (typeof delta === 'string') append(delta);
            else streamError = true;
          } catch { streamError = true; }
        } else if (line.startsWith('9:')) {
          try {
            const call: unknown = JSON.parse(line.slice(2));
            if (call && typeof call === 'object' && 'toolName' in call && typeof call.toolName === 'string'
              && getArtifactTool(call.toolName) && 'toolCallId' in call && typeof call.toolCallId === 'string') {
              toolCalls.set(call.toolCallId, call.toolName);
              onToolEvent?.({ toolName: call.toolName, called: true, resultValidated: false });
            }
          } catch { streamError = true; }
        } else if (line.startsWith('a:')) {
          try {
            const result: unknown = JSON.parse(line.slice(2));
            if (result && typeof result === 'object' && 'toolCallId' in result
              && typeof result.toolCallId === 'string' && toolCalls.has(result.toolCallId)) {
              const toolName = toolCalls.get(result.toolCallId)!;
              const part = validatedArtifactPartFromToolResult(toolName,
                'result' in result ? result.result : null);
              onToolEvent?.({ toolName, called: false, resultValidated: Boolean(part) });
              if (part) onArtifact?.(part);
              else { streamError = true; providerError = true; }
              toolCalls.delete(result.toolCallId);
            }
          } catch { streamError = true; }
        } else if (line.startsWith('8:')) {
          try {
            const annotations: unknown = JSON.parse(line.slice(2));
            const reference = searchContextReference(annotations);
            if (reference) onSearchReference?.(reference);
            verificationFailed ||= Array.isArray(annotations) && annotations.some((item) => item
              && item.type === 'vantra-web-verification' && item.state === 'unverified'
              && item.code === 'CURRENT_INFORMATION_UNVERIFIED');
          } catch { streamError = true; hardError = true; }
        } else if (line.startsWith('d:')) {
          try {
            const finish: unknown = JSON.parse(line.slice(2));
            if (finish && typeof finish === 'object' && 'finishReason' in finish && finish.finishReason === 'error') {
              streamError = true;
              providerError = true;
            }
          } catch { streamError = true; }
        } else if (line.startsWith('3:')) { streamError = true; providerError = true; hardError = true; }
        newline = pending.indexOf('\n');
      }
    }
    if (signal?.aborted) return 'aborted';
    if (toolCalls.size > 0) { streamError = true; providerError = true; }
    if (verificationFailed && !hardError && !pending.trim() && toolCalls.size === 0) return 'unverified';
    if (streamError || pending.trim()) {
      onErrorKind?.(providerError ? 'provider_error' : 'network_error');
      return 'error';
    }
    return 'completed';
  } catch {
    if (!signal?.aborted) onErrorKind?.('network_error');
    return signal?.aborted ? 'aborted' : 'error';
  } finally {
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
