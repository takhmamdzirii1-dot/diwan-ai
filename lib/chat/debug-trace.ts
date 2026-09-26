export type ChatStreamTrace = {
  requestId: string;
  textChars: number;
  status: 'completed' | 'aborted' | 'error';
  errorCategory?: 'stream_error';
};

export function isChatTraceId(value: string | null): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// Count AI SDK data-stream text frames while forwarding the original bytes unchanged.
export function traceChatDataStream(response: Response, requestId: string,
  record: (event: ChatStreamTrace) => void, signal?: AbortSignal): Response {
  if (!response.body) {
    record({ requestId, textChars: 0, status: 'error', errorCategory: 'stream_error' });
    return response;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let textChars = 0;
  let streamError = false;
  let finished = false;
  const finish = (status: ChatStreamTrace['status']) => {
    if (finished) return;
    finished = true;
    record({ requestId, textChars, status,
      ...(status === 'error' ? { errorCategory: 'stream_error' as const } : {}) });
  };
  signal?.addEventListener('abort', () => finish('aborted'), { once: true });
  const count = (chunk: Uint8Array) => {
    pending += decoder.decode(chunk, { stream: true });
    let newline = pending.indexOf('\n');
    while (newline !== -1) {
      const line = pending.slice(0, newline).trimEnd();
      pending = pending.slice(newline + 1);
      if (line.startsWith('0:')) {
        try {
          const delta: unknown = JSON.parse(line.slice(2));
          if (typeof delta === 'string') textChars += delta.length;
        } catch { /* Malformed frames remain the stream consumer's responsibility. */ }
      } else if (line.startsWith('3:')) streamError = true;
      newline = pending.indexOf('\n');
    }
  };
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish(signal?.aborted ? 'aborted' : streamError ? 'error' : 'completed');
          controller.close();
          return;
        }
        count(value);
        controller.enqueue(value);
      } catch (error) {
        finish(signal?.aborted ? 'aborted' : 'error');
        controller.error(error);
      }
    },
    async cancel(reason) {
      finish('aborted');
      await reader.cancel(reason);
    },
  });
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}
