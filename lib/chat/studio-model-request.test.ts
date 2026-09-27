import assert from 'node:assert/strict';
import test from 'node:test';
import { canRegenerateAssistantMessage } from './message-history';
import { chatModelRequestBody, requiredChatModel, resolveSelectedChatModel } from './studio-model-request';

const models = [
  { id: 'model-a', enabled: true },
  { id: 'model-b', enabled: true },
  { id: 'unavailable', enabled: false },
];
const selectable = (model: typeof models[number]) => model.enabled;

test('selection and outgoing request use the same model after send or conversation switch', () => {
  const selected = resolveSelectedChatModel(models, 'model-b', selectable);
  assert.equal(selected?.id, 'model-b');
  assert.equal(chatModelRequestBody(selected!.id).model, 'model-b');
  assert.equal(resolveSelectedChatModel(models, 'model-a', selectable)?.id, 'model-a');
  assert.equal(resolveSelectedChatModel(models, 'model-b', selectable)?.id, 'model-b');
});

test('unavailable or removed selection resolves visibly before the next request', () => {
  assert.equal(resolveSelectedChatModel(models, 'unavailable', selectable)?.id, 'model-a');
  assert.equal(resolveSelectedChatModel(models, 'removed', selectable)?.id, 'model-a');
  assert.equal(resolveSelectedChatModel([{ id: 'unavailable', enabled: false }], 'unavailable', selectable), null);
});

test('try again and regenerate keep the selected model with fresh operation IDs', () => {
  const initial = chatModelRequestBody('model-a');
  const retry = chatModelRequestBody('model-a');
  const regenerate = chatModelRequestBody('model-a');
  assert.deepEqual([initial.model, retry.model, regenerate.model], ['model-a', 'model-a', 'model-a']);
  assert.equal(new Set([initial.operationId, retry.operationId, regenerate.operationId]).size, 3);
  for (const body of [initial, retry, regenerate]) assert.match(body.operationId, /^[\da-f-]{36}$/i);
});

test('server rejects a missing model instead of falling back to a default', () => {
  assert.equal(requiredChatModel(undefined), null);
  assert.equal(requiredChatModel(''), null);
  assert.equal(requiredChatModel('  '), null);
  assert.equal(requiredChatModel(' model-a '), 'model-a');
  assert.throws(() => chatModelRequestBody(''), /selected chat model is required/);
});

test('artifact and Agent messages retain their existing regenerate restrictions', () => {
  const ordinary = { role: 'assistant', content: 'Hello' };
  assert.equal(canRegenerateAssistantMessage(ordinary), true);
  assert.equal(canRegenerateAssistantMessage(ordinary, true), false);
  assert.equal(canRegenerateAssistantMessage({ ...ordinary, vantraParts: [{ type: 'presentation', artifact: {} }] }), false);
});
