import 'server-only';
import { parseChatArtifact, validatedArtifactPartFromToolResult, type ChatMessagePart } from '@/lib/artifacts/chat-parts';
import { currentInformationUnavailable, type createChatSearch } from './chat-search.server';
import type { ResponseLanguage } from '@/lib/chat/response-language';
import type { StreamTerminalDiagnostics } from './stream-diagnostics';
import { webSourcesSchema, sourceClass } from '@/lib/chat/web-sources';

type Search = ReturnType<typeof createChatSearch>;

/** Same validated content contract before either text or tool results reach the customer.
 * Static Chat remains incremental. Turns that can search are held from the first frame:
 * deciding to search later must not leave an unvalidated prefix on the wire.
 */
export function guardCurrentInformationStream(response: Response, search: Search, options: {
  required: boolean; language: ResponseLanguage; executionId: string;
  operationId?: string;
  onValidated?: () => Promise<void>;
  signal?: AbortSignal;
  onDiagnostics?: (diagnostics: StreamTerminalDiagnostics) => void;
  onReadError?: (error: unknown) => void;
  onTerminated?: (reason: 'cancelled' | 'provider_error' | 'missing_terminal' | 'validation_error') => Promise<void>;
}) {
  if (!response.body) return response;
  const reader = response.body.getReader();
  const encoder = new TextEncoder(); const decoder = new TextDecoder();
  let held = options.required || search.toolExposed || search.strategy.kind === 'provider_native';
  let partial = ''; let bytes = 0; const lines: string[] = [];
  let finalized = false;
  let cancelled = false;
  let downstreamCancelled = false;
  let terminalSeen = false;
  let providerError = false;
  let readFailed = false;
  let wireFinishReason: string | null = null;
  let errorFrameSeen = false;
  const diagnostics = () => options.onDiagnostics?.({ streamTerminalFrameSeen: terminalSeen,
    streamTerminalFrameMissing: !terminalSeen, streamWireFinishReason: wireFinishReason,
    streamReadFailed: readFailed, streamErrorFrameSeen: errorFrameSeen });
  const finalize = async () => { if (!finalized) { finalized = true; diagnostics(); await options.onValidated?.(); } };
  const terminate = async (reason: 'cancelled' | 'provider_error' | 'missing_terminal' | 'validation_error') => {
    if (!finalized) { finalized = true; diagnostics(); await options.onTerminated?.(reason); }
  };
  const abort = () => { cancelled = true; void reader.cancel().catch(() => undefined); };
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sourceStatus = (state: 'searching' | 'read') => {
        const hits = search.evidence() ?? [];
        const parsed = webSourcesSchema.safeParse({ type: 'vantra-web-sources', state,
          sources: hits.slice(0, 24).map((hit, index) => ({ id: hit.evidenceId ?? `S${index + 1}`,
            title: hit.title.slice(0, 300), url: hit.url,
            sourceClass: sourceClass(hit.url, hit.evidenceLevel?.startsWith('primary') ?? false) })),
          readCount: hits.length });
        if (parsed.success && !cancelled) controller.enqueue(encoder.encode(`8:${JSON.stringify([parsed.data])}\n`));
      };
      if (search.evidence() !== null) sourceStatus('read');
      else if (options.required) sourceStatus('searching');
      const progressCalls = new Map<string, string>();
      const processLine = (line: string) => {
        if (/^[9a]:/.test(line)) {
          const value = JSON.parse(line.slice(2));
          if (line.startsWith('9:')) {
            progressCalls.set(value.toolCallId, value.toolName);
            if (value.toolName === 'web_search') sourceStatus('searching');
          } else if (['web_search', 'read_web_page'].includes(progressCalls.get(value.toolCallId) ?? '')) sourceStatus('read');
        }
        if (line.startsWith('3:')) { providerError = true; errorFrameSeen = true; }
        if (line.startsWith('d:')) {
          const terminal = JSON.parse(line.slice(2));
          terminalSeen = typeof terminal?.finishReason === 'string';
          wireFinishReason = ['stop', 'length', 'content-filter', 'tool-calls', 'error', 'other', 'unknown']
            .includes(terminal?.finishReason) ? terminal.finishReason : null;
          if (terminal?.finishReason === 'error') providerError = true;
        }
        if (!held && (search.evidence() !== null || line.startsWith('9:') && (() => {
          try { return JSON.parse(line.slice(2)).toolName === 'web_search'; } catch { return false; }
        })())) held = true;
        if (held) {
          bytes += encoder.encode(line).byteLength;
          if (bytes > 1_000_000) throw new Error('WEB_OUTPUT_TOO_LARGE');
          lines.push(line);
        } else controller.enqueue(encoder.encode(`${line}\n`));
      };
      try {
        while (true) {
          const next = await reader.read().catch((error: unknown) => {
            readFailed = true; options.onReadError?.(error); throw error;
          });
          partial += next.done ? decoder.decode() : decoder.decode(next.value, { stream: true });
          if (held && partial.length > 1_000_000) throw new Error('WEB_OUTPUT_TOO_LARGE');
          const complete = partial.split('\n'); partial = complete.pop() ?? '';
          for (const line of complete) if (line) processLine(line);
          if (next.done) break;
        }
        if (partial) processLine(partial);
        if (cancelled || options.signal?.aborted) {
          await terminate('cancelled');
          if (!downstreamCancelled) controller.close();
          return;
        }
        if (providerError || !terminalSeen) {
          await terminate(providerError ? 'provider_error' : 'missing_terminal');
          if (!cancelled) {
            controller.enqueue(encoder.encode('3:"PROVIDER_STREAM_FAILED"\nd:{"finishReason":"error"}\n'));
            controller.close();
          }
          return;
        }
        if (held) {
          const calls = new Map<string, string>();
          const parts: ChatMessagePart[] = [];
          const frames = new Map<number, { toolCallId: string; result: unknown }>();
          let text = '';
          for (const [index, line] of lines.entries()) {
            if (!/^[09a]:/.test(line)) continue;
            const value = JSON.parse(line.slice(2));
            if (line.startsWith('0:') && typeof value === 'string') text += value;
            if (line.startsWith('9:')) calls.set(value.toolCallId, value.toolName);
            if (line.startsWith('a:')) {
              const part = validatedArtifactPartFromToolResult(calls.get(value.toolCallId) ?? '', value.result);
              if (part) { parts.push(part); frames.set(index, value); }
            }
          }
          const structured = !parts.length ? parseChatArtifact(text, options.language) : null;
          const outcome = search.evaluateOutput(structured ? '' : text,
            structured ? [{ type: structured.type, artifact: structured } as ChatMessagePart] : parts);
          await finalize();
          if (search.evidence() !== null) sourceStatus('read');
          if (outcome && !outcome.accepted) {
            // Never emit an unverified artifact, partial arguments, or model-memory answer.
            // The execution is failed/released by finalize above. Deliver the
            // honest inability message rather than an SDK error frame, which
            // would discard it and replace it with a generic transport failure.
            controller.enqueue(encoder.encode(`0:${JSON.stringify(currentInformationUnavailable(options.language))}\n8:${JSON.stringify([{ type: 'vantra-search-context', executionId: options.executionId }, { type: 'vantra-web-verification', state: 'unverified', code: 'CURRENT_INFORMATION_UNVERIFIED' }])}\nd:{"finishReason":"error"}\n`));
          } else {
            const partKey = (part: ChatMessagePart) => 'artifact' in part ? `artifact:${part.artifact.id}`
              : part.type === 'file' ? `file:${part.name}` : null;
            const retained = new Map(outcome?.parts.map((part) => [partKey(part), part]) ?? []);
            let textWritten = false;
            for (const [index, line] of lines.entries()) {
              if (/^[9a]:/.test(line)) {
                const value = JSON.parse(line.slice(2));
                if (['web_search', 'read_web_page'].includes(calls.get(value.toolCallId) ?? '')) continue;
              }
              if (outcome && line.startsWith('0:')) {
                if (!textWritten) controller.enqueue(encoder.encode(`0:${JSON.stringify(structured
                  && outcome.parts[0] && 'artifact' in outcome.parts[0]
                  ? JSON.stringify(outcome.parts[0].artifact) : outcome.text)}\n`));
                textWritten = true;
              } else if (outcome && frames.has(index)) {
                const frame = frames.get(index)!;
                const original = validatedArtifactPartFromToolResult(calls.get(frame.toolCallId) ?? '', frame.result);
                const part = original ? retained.get(partKey(original)) : null;
                // A withheld part must never fall back to its unvalidated wire result.
                if (!part) continue;
                const result = part && 'artifact' in part ? { status: 'ok', artifact: part.artifact }
                  : part.type === 'file' && 'content' in part ? { status: 'ok', file: { ...part, type: 'file' } } : null;
                if (!result) continue;
                controller.enqueue(encoder.encode(`a:${JSON.stringify({ ...frame, result })}\n`));
              } else controller.enqueue(encoder.encode(`${line}\n`));
            }
            if (outcome?.accepted && search.contextForPersistence()) controller.enqueue(encoder.encode(
              `8:${JSON.stringify([{ type: 'vantra-search-context', executionId: options.executionId }])}\n`));
          }
        }
        await finalize();
        console.info('WEB_TURN_VERIFICATION', { executionId: options.executionId,
          operationId: options.operationId ?? null, stage: 'stream_validation_finalization', ...search.snapshot() });
        controller.close();
      } catch {
        if (!cancelled && !options.signal?.aborted && !readFailed) search.markUnverified();
        await terminate(cancelled || options.signal?.aborted ? 'cancelled'
          : readFailed ? 'provider_error' : 'validation_error').catch(() => undefined);
        if (!cancelled && !options.signal?.aborted) {
          controller.enqueue(encoder.encode(`3:${JSON.stringify(readFailed ? 'PROVIDER_STREAM_FAILED'
            : 'CURRENT_INFORMATION_UNVERIFIED')}\nd:{"finishReason":"error"}\n`));
          controller.close();
        } else if (!downstreamCancelled) {
          controller.close();
        }
        await reader.cancel().catch(() => undefined);
      } finally { options.signal?.removeEventListener('abort', abort); reader.releaseLock(); }
    },
    async cancel(reason) {
      cancelled = true;
      downstreamCancelled = true;
      await reader.cancel(reason).catch(() => undefined);
      await terminate('cancelled');
    },
  });
  const headers = new Headers(response.headers); headers.delete('content-length');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
