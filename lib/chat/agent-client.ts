import type { ChatMessagePart } from '@/lib/artifacts/chat-parts';
import { consumeCanonicalChatStream } from './client-finalization';
import type { AgentSemanticResult } from './agent-runtime';

/** Each invocation enters the existing Chat route with a fresh operation ID. */
export async function executeAgentSemanticStep(input: {
  stage: 'analysis' | 'presentation'; prompt: string; model: string;
  history: Array<{ role: string; content: string }>; operationId: string; signal: AbortSignal; toolBudget: number;
  debug?: boolean;
}): Promise<AgentSemanticResult> {
  const response = await fetch('/api/generate/chat', { method: 'POST', credentials: 'same-origin', signal: input.signal,
    headers: { 'content-type': 'application/json', ...(input.debug ? { 'x-vantra-chat-debug-id': input.operationId } : {}) }, body: JSON.stringify({
      model: input.model, operationId: input.operationId, agentStep: input.stage, agentToolBudget: input.toolBudget,
      max_tokens: input.stage === 'presentation' ? 4096 : 2048,
      messages: [...input.history, { role: 'user', content: input.prompt }],
    }) });
  if (!response.ok || !response.body) {
    const category = await response.json().catch(() => ({})) as { error?: string };
    if (response.status === 409 && category.error === 'MODEL_CAPABILITY_UNSUPPORTED') throw new Error('SWITCH_MODEL');
    throw new Error('MODEL_FAILURE');
  }
  let text = '';
  let toolCallCount = 0;
  let presentationToolCalls = 0;
  let validatedPresentationResults = 0;
  const artifacts: ChatMessagePart[] = [];
  const status = await consumeCanonicalChatStream(response.body, (delta) => { text += delta; }, input.signal,
    undefined, (part) => artifacts.push(part), (event) => {
      if (event.called) toolCallCount++;
      if (event.toolName === 'create_presentation' && event.called) presentationToolCalls++;
      if (event.toolName === 'create_presentation' && event.resultValidated) validatedPresentationResults++;
    });
  if (input.debug) console.info('[VANTRA_CHAT_DEBUG] CLIENT_PRESENTATION_STEP', {
    requestId: input.operationId, agentStep: input.stage, presentationToolCalls,
    validatedPresentationResults, clientArtifactPartCount: artifacts.length,
    textChars: text.length, status,
  });
  if (status === 'aborted') throw new Error('AGENT_CANCELLED');
  if (status !== 'completed') throw Object.assign(new Error('MODEL_FAILURE'), { toolCallCount });
  return { text, artifacts, toolCallCount };
}
