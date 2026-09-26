export type CanonicalStreamStatus = 'completed' | 'aborted' | 'error';

export function restoreCanonicalAssistantText<T extends { id: string; role: string; content: string }>(
  messages: T[], messageId: string, text: string,
): T[] {
  const index = messages.findIndex((message) => message.id === messageId && message.role === 'assistant');
  if (index < 0 || messages[index].content === text) return messages;
  return messages.map((message, position) => position === index ? { ...message, content: text } : message);
}

export class ChatStreamFinalizer {
  private text = '';
  private rawStatus: CanonicalStreamStatus | null = null;
  private consumerSettled = false;
  private finalized = false;
  private invalidated = false;

  constructor(readonly requestId: string,
    private readonly commit: (result: { requestId: string; text: string; status: CanonicalStreamStatus }) => void) {}

  append(delta: string) {
    if (!this.rawStatus && !this.invalidated) this.text += delta;
  }

  get textChars() { return this.text.length; }

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
    this.commit({ requestId: this.requestId, text: this.text, status: this.rawStatus });
  }
}

// Read a separate branch of the AI SDK data stream. The SDK consumer may fail
// independently; only these original text frames form the canonical answer.
export async function consumeCanonicalChatStream(stream: ReadableStream<Uint8Array>,
  append: (delta: string) => void, signal?: AbortSignal): Promise<CanonicalStreamStatus> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let streamError = false;
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
        } else if (line.startsWith('3:')) streamError = true;
        newline = pending.indexOf('\n');
      }
    }
    return signal?.aborted ? 'aborted' : streamError || pending.trim() ? 'error' : 'completed';
  } catch {
    return signal?.aborted ? 'aborted' : 'error';
  } finally {
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
