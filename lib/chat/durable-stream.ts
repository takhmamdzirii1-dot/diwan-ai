import { consumeCanonicalChatStream, ChatStreamFinalizer } from './client-finalization';
import { CHAT_CHECKPOINT_MS } from './durable-history';

type Snapshot = { content: string; metadata: Record<string, unknown>; status: 'streaming' | 'complete' | 'interrupted' };

/** Consume only the existing customer-safe wire stream. Disconnect cancels the
 * browser branch, not the authoritative consumer. No provider retry or new call. */
export function continueChatResponse(response: Response, options: {
  operationId: string;
  save: (snapshot: Snapshot) => Promise<boolean>;
  abort: () => void;
  completed: () => boolean;
  onSaveError: () => void;
  checkpointMs?: number;
}) {
  if (!response.body) throw new Error('CHAT_STREAM_MISSING');
  const [browser, durable] = response.body.tee();
  let content = '';
  let metadata: Record<string, unknown> = {};
  let saves: Promise<void> = Promise.resolve();
  let saving = false;
  const queueSave = (status: Snapshot['status']) => {
    if (status === 'streaming' && saving) return saves;
    saving = true;
    const snapshot = { content, metadata, status };
    saves = saves.then(async () => {
      if (!await options.save(snapshot)) options.abort();
    }).catch(() => { options.onSaveError(); options.abort(); }).finally(() => { saving = false; });
    return saves;
  };
  const finalizer = new ChatStreamFinalizer(options.operationId, result => {
    content = result.text;
    metadata = { ...(result.artifacts.length ? { vantraParts: [
      ...(content ? [{ type: 'text', text: content }] : []), ...result.artifacts] } : {}),
      ...(result.annotations ? { annotations: result.annotations } : {}) };
  });
  // Serialized, bounded writes; no server-side retrieval/status polling loop.
  // A heartbeat also keeps held/search/tool answers from looking stale.
  const timer = setInterval(() => { void queueSave('streaming'); }, options.checkpointMs ?? CHAT_CHECKPOINT_MS);
  const completion = (async () => {
    try {
      const status = await consumeCanonicalChatStream(durable, delta => { content += delta; finalizer.append(delta); },
        undefined, undefined, part => finalizer.appendArtifact(part), undefined,
        reference => finalizer.setSearchReference(reference), sources => finalizer.setWebSources(sources),
        review => finalizer.addConnectedReview(review));
      finalizer.consumerDone();
      finalizer.rawDone(status);
      clearInterval(timer);
      await queueSave(status === 'completed' && options.completed() ? 'complete' : 'interrupted');
    } finally { clearInterval(timer); }
  })();
  return { response: new Response(browser, { status: response.status, statusText: response.statusText, headers: response.headers }),
    completion };
}
