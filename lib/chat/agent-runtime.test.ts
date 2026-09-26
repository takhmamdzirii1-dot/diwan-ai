import assert from 'node:assert/strict';
import test from 'node:test';
import type { SpreadsheetArtifact } from '@/lib/artifacts/core';
import { runArtifactTool, runReadSpreadsheetContextTool } from '@/lib/artifacts/tool-registry';
import { executeAgentSemanticStep } from './agent-client';
import { agentTaskFor, cancelAgentRun, createAgentRun, executeAgentRun, isCurrentAgentUpdate, type AgentRun } from './agent-runtime';

const request = 'Analyze this spreadsheet, create two useful charts, and build a 6-slide presentation.';
const sheet: SpreadsheetArtifact = { schemaVersion: 1, id: 'book', type: 'spreadsheet', title: 'Sales', language: 'en',
  direction: 'ltr', metadata: {}, sheets: [{ id: 's1', name: 'Results', columns: ['Month', 'Revenue', 'Units'],
    rows: [['Jan', 10, 2], ['Feb', 20, 4], ['Mar', 30, 5]] }] };
const presentation = runArtifactTool('create_presentation', { title: 'Results', slides: [
  { title: 'Results', variant: 'cover', blocks: [] },
  ...Array.from({ length: 5 }, (_, index) => ({ title: `Finding ${index + 1}`, variant: 'insights' as const,
    blocks: [{ kind: 'bullets' as const, items: ['Revenue grew.'] }] })),
] });
assert.equal(presentation.status, 'ok');
if (presentation.status !== 'ok' || presentation.artifact.type !== 'presentation') throw new Error('Fixture invalid');
const presentationPart = { type: 'presentation' as const, artifact: presentation.artifact };

function setup(overrides?: Partial<AgentRun>) {
  const run = { ...createAgentRun(request, 'conversation-a', 'agent-a')!, ...overrides };
  const controller = new AbortController();
  const calls: Array<{ stage: string; operationId: string; toolBudget: number }> = [];
  let ids = 0;
  const deps = { signal: controller.signal, operationId: () => `operation-${++ids}`, onUpdate: (_state: AgentRun) => {},
    semantic: async (stage: 'analysis' | 'presentation', _prompt: string, operationId: string, toolBudget: number) => {
      calls.push({ stage, operationId, toolBudget });
      return stage === 'analysis' ? { text: 'Revenue increased.', artifacts: [], toolCallCount: 0 }
        : { text: '', artifacts: [presentationPart], toolCallCount: 1 };
    } };
  return { run, controller, calls, deps };
}

test('normal Q&A and one document bypass Agent; multi-step activates with relevant plan', () => {
  assert.equal(agentTaskFor('What is compound interest?'), null);
  assert.equal(agentTaskFor('Write a professional report about AI adoption.'), null);
  assert.equal(agentTaskFor('Create a chart from this table.'), null);
  assert.deepEqual(agentTaskFor(request), { kind: 'spreadsheet_presentation', chartCount: 2, slideCount: 6 });
});

test('two semantic steps have distinct normal Chat operation IDs; deterministic tools add no AI calls', async () => {
  const { run, calls, deps } = setup();
  const result = await executeAgentRun(run, sheet, deps);
  assert.equal(result.status, 'completed');
  assert.equal(result.semanticCallCount, 2);
  assert.deepEqual(calls.map((entry) => entry.operationId), ['operation-1', 'operation-2']);
  assert.deepEqual(calls.map((entry) => entry.stage), ['analysis', 'presentation']);
  assert.equal(result.artifacts.filter((part) => part.type === 'chart').length, 2);
  assert.equal(result.artifacts.filter((part) => part.type === 'presentation').length, 1);
  assert.equal(result.toolCallCount, 4); // bounded read, two charts, one model-request tool result
  assert.equal(result.analysisText, 'Revenue increased.');
});

test('read_spreadsheet_context is bounded and validates the workbook without AI', () => {
  const large = { ...sheet, sheets: [{ ...sheet.sheets[0], rows: Array.from({ length: 200 }, (_, index) => [`M${index}`, index, index]) }] };
  const read = runReadSpreadsheetContextTool(large, 's1', 0, 200);
  assert.equal(read.status, 'ok');
  if (read.status === 'ok') {
    assert.equal(read.rowCount, 200);
    assert.ok(read.context.length <= 12_500);
    assert.doesNotMatch(read.context, /M199/);
  }
  assert.deepEqual(runReadSpreadsheetContextTool(sheet, 'unknown'), { status: 'error' });
});

test('missing workbook waits; resume completes without repeating finished steps', async () => {
  const { run, calls, deps } = setup();
  const waiting = await executeAgentRun(run, null, deps);
  assert.equal(waiting.status, 'waiting_for_user');
  assert.equal(waiting.waitingForUser, true);
  assert.equal(calls.length, 0);
  const done = await executeAgentRun(waiting, sheet, deps);
  assert.equal(done.status, 'completed');
  assert.equal(done.completedSteps.length, 4);
  assert.equal(calls.length, 2);
});

test('partial charts survive later model failure and resume skips completed analysis/tools', async () => {
  const { run, calls, deps } = setup();
  let fail = true;
  const semantic = deps.semantic;
  deps.semantic = async (...args) => {
    if (args[0] === 'presentation' && fail) { fail = false; calls.push({ stage: 'presentation', operationId: args[2], toolBudget: args[3] }); throw new Error('MODEL_FAILURE'); }
    return semantic(...args);
  };
  const failed = await executeAgentRun(run, sheet, deps);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.artifacts.filter((part) => part.type === 'chart').length, 2);
  assert.deepEqual(failed.completedSteps, ['reading', 'analyzing', 'charts']);
  const resumed = await executeAgentRun(failed, sheet, deps);
  assert.equal(resumed.status, 'completed');
  assert.equal(resumed.artifacts.filter((part) => part.type === 'chart').length, 2);
  assert.equal(calls.filter((call) => call.stage === 'analysis').length, 1);
});

test('semantic, tool, retry and cancellation limits are enforced', async () => {
  const semantic = setup({ maxSemanticCalls: 1 });
  assert.equal((await executeAgentRun(semantic.run, sheet, semantic.deps)).status, 'failed');
  assert.equal(semantic.calls.length, 1);
  const tool = setup({ maxToolCalls: 2 });
  const limited = await executeAgentRun(tool.run, sheet, tool.deps);
  assert.equal(limited.status, 'failed');
  assert.ok(limited.toolCallCount <= 2);
  const bad = await executeAgentRun(setup().run, { ...sheet, sheets: [{ ...sheet.sheets[0], rows: [['Jan', 10]] }] }, setup().deps);
  assert.equal(bad.status, 'failed');
  assert.equal(bad.toolCallCount, 2); // one initial attempt plus one retry
  const stopped = cancelAgentRun(setup().run);
  assert.equal((await executeAgentRun(stopped, sheet, setup().deps)).status, 'cancelled');
});

test('Stop aborts the active semantic request without accepting late output', async () => {
  const { run, controller, deps } = setup();
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  deps.semantic = async () => { entered(); await new Promise<void>((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('AGENT_CANCELLED')), { once: true });
  }); return { text: 'late', artifacts: [], toolCallCount: 0 }; };
  const pending = executeAgentRun(run, sheet, deps);
  await started;
  controller.abort();
  const result = await pending;
  assert.equal(result.status, 'cancelled');
  assert.equal(result.artifacts.length, 0);
});

test('old request/conversation updates cannot modify the active run', () => {
  const current = setup().run;
  assert.equal(isCurrentAgentUpdate({ ...current, agentRunId: 'old' }, current), false);
  assert.equal(isCurrentAgentUpdate({ ...current, conversationId: 'other' }, current), false);
  assert.equal(isCurrentAgentUpdate(current, current), true);
});

test('client semantic step uses one existing Chat HTTP request and validates artifact-only output', async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<{ operationId: string; agentStep: string; agentToolBudget: number }> = [];
  globalThis.fetch = (async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    bodies.push(body);
    const stream = body.agentStep === 'analysis' ? '0:"Revenue increased."\n'
      : `9:${JSON.stringify({ toolCallId: 'call-1', toolName: 'create_presentation', args: {} })}\n`
        + `a:${JSON.stringify({ toolCallId: 'call-1', result: presentation })}\n`;
    return new Response(stream, { status: 200 });
  }) as typeof fetch;
  try {
    const controller = new AbortController();
    const history = [{ role: 'user', content: request }];
    const first = await executeAgentSemanticStep({ stage: 'analysis', prompt: 'Analyze bounded data', model: 'selected', history,
      operationId: 'op-1', toolBudget: 8, signal: controller.signal });
    const second = await executeAgentSemanticStep({ stage: 'presentation', prompt: 'Create presentation', model: 'selected', history,
      operationId: 'op-2', toolBudget: 5, signal: controller.signal });
    assert.equal(first.text, 'Revenue increased.');
    assert.equal(second.text, '');
    assert.equal(second.artifacts[0].type, 'presentation');
    assert.deepEqual(bodies.map((body) => body.operationId), ['op-1', 'op-2']);
    assert.deepEqual(bodies.map((body) => body.agentToolBudget), [8, 5]);
  } finally { globalThis.fetch = originalFetch; }
});

test('invalid native result fails safely without exposing tool JSON', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('9:{"toolCallId":"c","toolName":"create_presentation"}\na:{"toolCallId":"c","result":{"status":"ok","artifact":{"type":"presentation"}}}\n', { status: 200 })) as typeof fetch;
  try {
    await assert.rejects(executeAgentSemanticStep({ stage: 'presentation', prompt: 'Create', model: 'selected', history: [],
      operationId: 'op', toolBudget: 1, signal: new AbortController().signal }), /MODEL_FAILURE/);
  } finally { globalThis.fetch = originalFetch; }
});

test('unverified tool route asks for a compatible model before any Agent model output', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response(JSON.stringify({ error: 'MODEL_CAPABILITY_UNSUPPORTED' }),
    { status: 409, headers: { 'content-type': 'application/json' } }); }) as typeof fetch;
  try {
    await assert.rejects(executeAgentSemanticStep({ stage: 'analysis', prompt: 'Analyze', model: 'selected', history: [],
      operationId: 'op', toolBudget: 8, signal: new AbortController().signal }), /SWITCH_MODEL/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
