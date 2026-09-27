import assert from 'node:assert/strict';
import test from 'node:test';
import { InvalidToolArgumentsError, streamText, tool } from 'ai';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import { z } from 'zod';
import { runArtifactTool } from '@/lib/artifacts/tool-registry';
import { buildNativeArtifactTools } from '@/lib/artifacts/tool-native.server';
import { partMatchesRequestedAction, validateRequestedChatOutput } from './action-routing';
import { assessChatCompletion, emptyToolLifecycle, validatedExpectedActionPart } from './action-completion';

const presentationInput = { title: 'Quarterly review', slides: [
  { title: 'Quarterly review', layout: 'title', variant: 'cover', blocks: [] },
  { title: 'Key metrics', variant: 'kpi', blocks: [{ kind: 'table', rows: [['Revenue', '$1,200']] }] },
] };

test('tool-calls finish without a result is incomplete, never Completed', () => {
  const result = assessChatCompletion({ expectedAction: 'create_presentation', finishReason: 'tool-calls',
    outputStarted: false, expectedResultValid: false, lifecycle: emptyToolLifecycle() });
  assert.deepEqual(result, { completed: false, failureCategory: 'tool_call_incomplete', stage: 'tool_selection' });
});

test('invalid tool arguments and execution failure have distinct failure categories', () => {
  const invalid = emptyToolLifecycle();
  invalid.callStarted = true;
  invalid.toolNameReceived = true;
  invalid.argumentsInvalid = true;
  assert.equal(runArtifactTool('create_presentation', { title: 'Bad', slides: [] }).status, 'error');
  assert.equal(assessChatCompletion({ expectedAction: 'create_presentation', finishReason: 'error',
    outputStarted: false, expectedResultValid: false, lifecycle: invalid }).failureCategory, 'tool_arguments_invalid');
  const execution = { ...invalid, argumentsInvalid: false, argumentsCompleted: true, argumentsValid: true,
    executionStarted: true, executionFailed: true };
  assert.equal(assessChatCompletion({ expectedAction: 'create_presentation', finishReason: 'tool-calls',
    outputStarted: false, expectedResultValid: false, lifecycle: execution }).failureCategory, 'tool_execution_failed');
});

test('valid native presentation must be validated and emitted before completion', () => {
  const result = runArtifactTool('create_presentation', presentationInput);
  assert.equal(result.status, 'ok');
  const toolResults = [{ toolName: 'create_presentation', toolCallId: 'call-1', result }];
  assert.equal(validatedExpectedActionPart('create_presentation', 'native', '', toolResults, new Set()), null);
  const part = validatedExpectedActionPart('create_presentation', 'native', '', toolResults, new Set(['call-1']));
  assert.equal(part?.type, 'presentation');
  const lifecycle = { ...emptyToolLifecycle(), callStarted: true, toolNameReceived: true,
    argumentsCompleted: true, argumentsValid: true, executionStarted: true, executionCompleted: true,
    resultEmitted: true, resultValidated: true };
  assert.equal(assessChatCompletion({ expectedAction: 'create_presentation', finishReason: 'tool-calls',
    outputStarted: true, expectedResultValid: Boolean(part), lifecycle }).completed, true);
  assert.equal(assessChatCompletion({ expectedAction: 'create_presentation', finishReason: 'tool-calls',
    outputStarted: true, expectedResultValid: false, lifecycle: { ...lifecycle, resultEmitted: false } }).failureCategory,
    'tool_result_missing');
});

test('explicit action prose or refusal is not a result; ordinary Chat text is', () => {
  assert.equal(validatedExpectedActionPart('create_presentation', 'structured',
    'I cannot create a presentation.', [], new Set()), null);
  const explicit = assessChatCompletion({ expectedAction: 'create_presentation', finishReason: 'stop',
    outputStarted: true, expectedResultValid: false, lifecycle: emptyToolLifecycle() });
  assert.equal(explicit.completed, false);
  assert.equal(explicit.failureCategory, 'expected_artifact_missing');
  assert.equal(assessChatCompletion({ expectedAction: null, finishReason: 'stop',
    outputStarted: true, expectedResultValid: false, lifecycle: emptyToolLifecycle() }).completed, true);
  assert.equal(validateRequestedChatOutput('presentation', 'I cannot create it.', [], 'en',
    'create_presentation').valid, false);
});

test('structured presentation and TXT file require their exact validated result', () => {
  const presentation = validatedExpectedActionPart('create_presentation', 'structured',
    JSON.stringify({ tool: 'create_presentation', input: presentationInput }), [], new Set());
  assert.equal(presentation?.type, 'presentation');
  const txt = validatedExpectedActionPart('create_text_file', 'structured',
    JSON.stringify({ tool: 'create_text_file', input: { title: 'Notes', content: 'Complete text.' } }), [], new Set());
  assert.equal(txt?.type, 'file');
  assert.equal(txt?.type === 'file' && 'format' in txt ? txt.format : null, 'txt');
  assert.equal(validatedExpectedActionPart('create_text_file', 'structured',
    JSON.stringify({ tool: 'create_csv_file', input: { title: 'Notes', content: 'a,b\n1,2' } }), [], new Set()), null);
  assert.equal(txt ? partMatchesRequestedAction(txt, 'create_text_file') : false, true);
  assert.equal(txt ? partMatchesRequestedAction(txt, 'create_csv_file') : false, false);
});

test('AI SDK invalid native arguments are observable before terminal classification', async () => {
  const model: LanguageModelV1 = {
    specificationVersion: 'v1', provider: 'fixture', modelId: 'fixture', defaultObjectGenerationMode: undefined,
    doGenerate: async () => { throw new Error('not used'); },
    doStream: async () => ({ rawCall: { rawPrompt: [], rawSettings: {} },
      stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: 'tool-call', toolCallType: 'function', toolCallId: 'invalid-1',
          toolName: 'create_presentation', args: '{"count":"invalid"}' });
        controller.enqueue({ type: 'finish', finishReason: 'tool-calls',
          usage: { promptTokens: 1, completionTokens: 1 } });
        controller.close();
      } }),
    }),
  };
  let invalidArguments = false;
  let invalidAtFinish = false;
  let finishReason: string | null = null;
  const result = await streamText({ model, prompt: 'fixture', maxRetries: 0, maxSteps: 1,
    tools: { create_presentation: tool({ parameters: z.object({ count: z.number() }),
      execute: async () => ({ status: 'ok' }) }) },
    onFinish: ({ finishReason: reason }) => { finishReason = reason; invalidAtFinish = invalidArguments; },
  });
  const response = result.toDataStreamResponse({ getErrorMessage: (error) => {
    invalidArguments = InvalidToolArgumentsError.isInstance(error);
    return '';
  } });
  await response.arrayBuffer();
  assert.equal(invalidArguments, true);
  assert.equal(finishReason, 'tool-calls');
  assert.equal(invalidAtFinish, true);
  assert.equal(assessChatCompletion({ expectedAction: 'create_presentation', finishReason,
    outputStarted: false, expectedResultValid: false,
    lifecycle: { ...emptyToolLifecycle(), callStarted: true, argumentsCompleted: true,
      argumentsInvalid: invalidAtFinish } }).failureCategory, 'tool_arguments_invalid');
});

test('AI SDK executes and emits a valid presentation result in the same model step', async () => {
  const model: LanguageModelV1 = {
    specificationVersion: 'v1', provider: 'fixture', modelId: 'fixture', defaultObjectGenerationMode: undefined,
    doGenerate: async () => { throw new Error('not used'); },
    doStream: async () => ({ rawCall: { rawPrompt: [], rawSettings: {} },
      stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: 'tool-call', toolCallType: 'function', toolCallId: 'valid-1',
          toolName: 'create_presentation', args: JSON.stringify(presentationInput) });
        controller.enqueue({ type: 'finish', finishReason: 'tool-calls',
          usage: { promptTokens: 1, completionTokens: 1 } });
        controller.close();
      } }),
    }),
  };
  const events: string[] = [];
  const emitted = new Set<string>();
  let finishResults: Array<{ toolName: string; toolCallId: string; result: unknown }> = [];
  const result = await streamText({ model, prompt: 'fixture', maxRetries: 0, maxSteps: 1,
    tools: buildNativeArtifactTools({ names: ['create_presentation'], skill: null }, 1,
      ({ stage }) => { events.push(`execute:${stage}`); }),
    onChunk: ({ chunk }) => {
      events.push(chunk.type);
      if (chunk.type === 'tool-result') emitted.add(chunk.toolCallId);
    },
    onFinish: ({ toolResults }) => { finishResults = toolResults; },
  });
  await result.toDataStreamResponse().arrayBuffer();
  assert.ok(events.includes('tool-call'));
  assert.ok(events.includes('execute:completed'));
  assert.ok(events.includes('tool-result'));
  assert.equal(validatedExpectedActionPart('create_presentation', 'native', '', finishResults, emitted)?.type,
    'presentation');
});
