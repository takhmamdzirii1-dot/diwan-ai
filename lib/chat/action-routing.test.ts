import assert from 'node:assert/strict';
import test from 'node:test';
import { actionRoutingCases } from './action-routing.eval';
import { routeConversationIntent, routeChatIntent } from './intent-router';
import { deterministicContextOutput, expectedOutputType, routesForChatAction, validateRequestedChatOutput } from './action-routing';
import { artifactTaskInstruction, requiredArtifactToolChoice, resolveArtifactToolPath, runArtifactTool, selectArtifactTools } from '@/lib/artifacts/tool-registry';
import { chatPartsFromMessage, chatPartsFromToolInvocations, streamingSafeText } from '@/lib/artifacts/chat-parts';
import { ChatStreamFinalizer, consumeCanonicalChatStream, hasUsableCanonicalOutput } from './client-finalization';
import type { RouteCapabilityStore } from '@/lib/models/capability-v2';

test('small multilingual corpus selects explicit actions and protects informational questions', () => {
  for (const [input, expected] of actionRoutingCases) assert.equal(routeChatIntent(input).intent, expected, input);
  assert.equal(routeChatIntent('something I could present to my team').confidence, 'low');
  assert.deepEqual(selectArtifactTools('What is PowerPoint?', { semantic: true }).names, []);
  assert.deepEqual(selectArtifactTools('ما هو PDF', { semantic: true }).names, []);
  assert.ok(selectArtifactTools('Haz una presentación para el equipo', { semantic: true }).names.includes('create_presentation'));
  const semantic = selectArtifactTools('ديرلي منها حاجة نعرضها قدام الفريق', { semantic: true, spreadsheet: true });
  assert.deepEqual(semantic.names, ['create_chart', 'create_presentation', 'create_spreadsheet', 'create_document', 'create_text_file']);
  assert.equal(requiredArtifactToolChoice(semantic, 'native'), undefined);
});

test('follow-up reuses the compact prior output intent without another model call', () => {
  const route = routeConversationIntent('انت ولدلي الملف', ['give it to me txt']);
  assert.equal(route.intent, 'export_txt');
  assert.deepEqual(selectArtifactTools('انت ولدلي الملف', { route }).names, ['create_text_file']);
  assert.equal(routeConversationIntent('What is a chart?', ['give it to me txt']).intent, 'normal_chat');
  assert.equal(routeConversationIntent('انت ولدلي الملف', ['give it to me txt', 'What is a chart?']).intent, 'normal_chat');
});

test('verified capability metadata selects a compatible existing route before invocation', () => {
  const routes = [
    { id: 'unsupported', providerId: 'future_adapter', providerModelId: 'a' },
    { id: 'structured', providerId: 'future_adapter', providerModelId: 'b' },
    { id: 'native', providerId: 'future_adapter', providerModelId: 'c' },
  ];
  const evidence = (state: 'supported' | 'unsupported') => ({ state, source: 'vantra_catalog' as const });
  const stored: RouteCapabilityStore = {
    unsupported: { providerId: 'future_adapter', providerModelId: 'a', evidence: {
      tools: evidence('unsupported'), structuredOutput: evidence('unsupported') }, overrides: {} },
    structured: { providerId: 'future_adapter', providerModelId: 'b', evidence: {
      tools: evidence('unsupported'), structuredOutput: evidence('supported') }, overrides: {} },
    native: { providerId: 'future_adapter', providerModelId: 'c', evidence: {
      tools: evidence('supported'), structuredOutput: evidence('unsupported') }, overrides: {} },
  };
  const forced = selectArtifactTools('give it to me as pptx');
  assert.deepEqual(routesForChatAction(routes, stored, forced).map((route) => route.id), ['structured', 'native']);
  assert.deepEqual(routesForChatAction(routes.slice(0, 1), stored, forced), []);
  const semantic = selectArtifactTools('make something I can share with my team', { semantic: true });
  assert.deepEqual(routesForChatAction(routes, stored, semantic).map((route) => route.id), ['structured', 'native', 'unsupported']);
  assert.equal(expectedOutputType(forced), 'presentation');
});

test('Arabic presentation intent selects only compatible routes and forces the verified native tool', () => {
  const request = 'اعطيني على شكل عرض تقديمي';
  const intent = routeChatIntent(request);
  assert.equal(intent.intent, 'create_presentation');
  assert.equal(intent.confidence, 'high');
  const selection = selectArtifactTools(request, { route: intent, semantic: true });
  assert.deepEqual(selection.names, ['create_presentation']);
  const routes = [
    { id: 'not-capable', providerId: 'future_adapter', providerModelId: 'model-a' },
    { id: 'capable', providerId: 'future_adapter', providerModelId: 'model-b' },
  ];
  const evidence = (state: 'supported' | 'unsupported') => ({ state, source: 'vantra_catalog' as const });
  const stored: RouteCapabilityStore = {
    'not-capable': { providerId: 'future_adapter', providerModelId: 'model-a',
      evidence: { tools: evidence('unsupported'), structuredOutput: evidence('unsupported') }, overrides: {} },
    capable: { providerId: 'future_adapter', providerModelId: 'model-b',
      evidence: { tools: evidence('supported'), structuredOutput: evidence('unsupported') }, overrides: {} },
  };
  assert.deepEqual(routesForChatAction(routes, stored, selection).map((route) => route.id), ['capable']);
  const path = resolveArtifactToolPath(selection, { tools: { state: 'supported' }, structuredOutput: { state: 'unsupported' } });
  assert.equal(path, 'native');
  assert.deepEqual(requiredArtifactToolChoice(selection, path), { type: 'tool', toolName: 'create_presentation' });
  assert.match(artifactTaskInstruction(selection, path), /supplied tool/);
  const structured = resolveArtifactToolPath(selection, { tools: { state: 'unsupported' }, structuredOutput: { state: 'supported' } });
  assert.equal(structured, 'structured');
  assert.equal(requiredArtifactToolChoice(selection, structured), undefined);
  assert.match(artifactTaskInstruction(selection, structured), /one JSON object/);
  assert.equal(validateRequestedChatOutput('presentation', 'I cannot create PowerPoint files.', [], 'en').valid, false);
});

test('real TXT, Markdown, JSON, and CSV outputs validate and survive artifact-only completion', () => {
  const cases = [
    ['create_text_file', 'Notes', 'A note', 'txt'],
    ['create_markdown_file', 'Notes', '# A note', 'md'],
    ['create_json_file', 'Notes', '{"value":1}', 'json'],
    ['create_csv_file', 'Notes', 'name,value\nA,1', 'csv'],
  ] as const;
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => { calls++; throw new Error('Unexpected network request'); }) as typeof fetch;
  try {
    for (const [toolName, title, content, extension] of cases) {
      const result = runArtifactTool(toolName, { title, content });
      assert.equal(result.status, 'ok');
      const native = chatPartsFromToolInvocations([{ state: 'result', toolName, result }], 'en');
      assert.equal(native[0]?.type, 'file');
      if (native[0]?.type === 'file') assert.match(native[0].name, new RegExp(`\\.${extension}$`));
      assert.equal(hasUsableCanonicalOutput('completed', '', native), true);
      const structured = chatPartsFromMessage(JSON.stringify({ tool: toolName, input: { title, content } }), 'en');
      assert.equal(structured[0]?.type, 'file');
      let finalized = native;
      const finalizer = new ChatStreamFinalizer(toolName, ({ artifacts }) => { finalized = artifacts; });
      finalizer.appendArtifact(native[0]); finalizer.rawDone('completed'); finalizer.consumerDone();
      assert.equal(finalized[0]?.type, 'file');
    }
    assert.equal(runArtifactTool('create_json_file', { title: 'Bad', content: '{broken' }).status, 'error');
    assert.equal(runArtifactTool('create_text_file', { title: 'Bad', content: 'x', executable: true }).status, 'error');
    assert.equal(chatPartsFromToolInvocations([{ state: 'result', toolName: 'create_text_file', result: {
      status: 'ok', file: { type: 'file', name: '../../secret.txt', mimeType: 'text/plain;charset=utf-8', format: 'txt', content: 'x' },
    } }], 'en')[0]?.type, 'text');
    assert.equal(streamingSafeText('{"tool":"create_text_file","input":{'), '');
    assert.equal(validateRequestedChatOutput('file', 'I cannot send a TXT file.', [], 'en').valid, false);
    const file = chatPartsFromMessage(JSON.stringify({ tool: 'create_text_file', input: { title: 'Notes', content: 'A note' } }), 'en');
    assert.equal(validateRequestedChatOutput('file', '', file, 'en').valid, true);
    assert.equal(validateRequestedChatOutput('file', JSON.stringify({ tool: 'create_text_file',
      input: { title: 'Notes', content: 'A note' } }), [], 'en').text, '');
    const sheet = { schemaVersion: 1 as const, id: 'sheet', type: 'spreadsheet' as const,
      title: 'Products', language: 'en', direction: 'ltr' as const, metadata: {},
      sheets: [{ id: 's', name: 'Products', columns: ['Product', 'Price'], rows: [['A, B', 12], ['C', 18]] }] };
    const csv = deterministicContextOutput('export_csv', 'make this CSV', sheet, []);
    assert.equal(csv?.type, 'file');
    if (csv?.type === 'file' && 'content' in csv) assert.match(csv.content, /"A, B",12/);
    assert.equal(deterministicContextOutput('export_xlsx', 'give me XLSX', sheet, [])?.type, 'spreadsheet');
    assert.equal(deterministicContextOutput('export_json', 'put this in JSON', sheet, [])?.type, 'file');
    assert.equal(deterministicContextOutput('export_txt', 'give it to me txt', null,
      [{ type: 'text', text: 'Previous answer.' }])?.type, 'file');
    const priorFile = file[0];
    assert.equal(deterministicContextOutput('export_txt', 'انت ولدلي الملف', null,
      priorFile ? [priorFile] : []), priorFile);
    assert.equal(deterministicContextOutput('export_txt', 'write new notes as txt', null,
      [{ type: 'text', text: 'Unrelated prior answer.' }]), null);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = oldFetch; }
});

test('file-only native stream reaches the canonical client result', async () => {
  const result = runArtifactTool('create_text_file', { title: 'Notes', content: 'Complete text.' });
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode(`9:${JSON.stringify({ toolCallId: 'file-1', toolName: 'create_text_file', args: {} })}\n`));
    controller.enqueue(new TextEncoder().encode(`a:${JSON.stringify({ toolCallId: 'file-1', result })}\n`));
    controller.close();
  } });
  let final: { text: string; artifacts: import('@/lib/artifacts/chat-parts').ChatMessagePart[]; status: string } | null = null;
  const finalizer = new ChatStreamFinalizer('file', (value) => { final = value; });
  const status = await consumeCanonicalChatStream(stream, (delta) => finalizer.append(delta), undefined, undefined,
    (part) => finalizer.appendArtifact(part));
  finalizer.rawDone(status); finalizer.consumerDone();
  assert.equal(status, 'completed');
  assert.equal(final?.text, '');
  assert.equal(final?.artifacts[0]?.type, 'file');
  assert.equal(hasUsableCanonicalOutput(status, final!.text, final!.artifacts), true);
});
