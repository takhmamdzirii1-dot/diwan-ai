import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultModelPlanAccess, resolveConfiguredModelAccess } from './model-access';
import type { StudioModality } from '@/src/config/studio-registry';

const states = (name: string, modality: StudioModality) => {
  const access = defaultModelPlanAccess(name, modality, []);
  return [access.free.state, access.lite.state, access.pro.state, access.max.state];
};

test('final Chat access matrix is canonical by customer-facing identity', () => {
  for (const model of ['GPT-5.6 Luna', 'GPT-5.6 Terra', 'Gemini 3.8 Flash']) {
    assert.deepEqual(states(model, 'chat'), ['included','included','included','included']);
  }
  for (const model of ['Claude Sonnet 5', 'GPT-5.6 Sol', 'Kimi K3']) {
    assert.deepEqual(states(model, 'chat'), ['trial','included','included','included']);
  }
  for (const model of ['GPT-6 Astra', 'Claude Fable 5.1', 'Claude Opus 5', 'Grok 4.6', 'Gemini 3.1 Pro']) {
    assert.deepEqual(states(model, 'chat'), ['trial','trial','included','included']);
  }
});

test('final Image matrix includes the one-use model trials', () => {
  assert.deepEqual(states('Seedream 5.0 Pro', 'image'), ['included','included','included','included']);
  assert.deepEqual(states('Nano Banana 2 Pro', 'image'), ['included','included','included','included']);
  const gpt = defaultModelPlanAccess('GPT Image 2.5', 'image', []);
  assert.deepEqual(states('GPT Image 2.5', 'image'), ['trial','included','included','included']);
  assert.equal(gpt.free.trialAllowance, 1);
  const grok = defaultModelPlanAccess('Grok Imagine Image 2.0', 'image', []);
  assert.deepEqual(states('Grok Imagine Image 2.0', 'image'), ['locked','trial','included','included']);
  assert.equal(grok.lite.trialAllowance, 1);
});

test('final Video matrix and unconfigured Trial allowance fail closed', () => {
  assert.deepEqual(states('Gemini Omni Flash', 'video'), ['included','included','included','included']);
  assert.deepEqual(states('Kling 3.0 Pro', 'video'), ['locked','included','included','included']);
  const seedance = defaultModelPlanAccess('Seedance 2.5', 'video', []);
  assert.deepEqual(states('Seedance 2.5', 'video'), ['locked','trial','included','included']);
  assert.equal(seedance.lite.trialAllowance, null);
  assert.equal(defaultModelPlanAccess('GPT-6 Astra', 'chat', []).free.trialAllowance, null);
});

test('required plan comes from access state rather than brand or provider', () => {
  const access = defaultModelPlanAccess('Grok Imagine Image 2.0', 'image', []);
  assert.deepEqual(resolveConfiguredModelAccess(access, 'free'), {
    state: 'locked', trialAllowance: null, requiredPlan: 'lite',
  });
});
