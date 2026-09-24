import assert from 'node:assert/strict';
import test from 'node:test';
import { modelBrand } from './model-catalog';

// Regression: Studio brand groups must never derive from the execution
// provider. Order: explicit saved Brand → catalog → legacy alias → Other.
test('explicit saved Brand is authoritative over provider inference', () => {
  assert.equal(modelBrand('GPT-5.6 Sol', 'chat', 'OpenRouter', 'x', 'OpenAI').name, 'OpenAI');
  assert.equal(modelBrand('Some Model', 'chat', 'Agnes', null, 'Agnes AI').name, 'Agnes AI');
});

test('catalog brand wins even when the execution provider differs', () => {
  const brand = modelBrand('GPT-5.6 Sol', 'chat', 'Agnes', null, null);
  assert.equal(brand.name, 'OpenAI');
});

test('provider-only names never become brand groups', () => {
  assert.equal(modelBrand('Brand New Model', 'chat', 'Agnes AI', null, null).name, 'Other');
  assert.equal(modelBrand('Brand New Model', 'chat', 'VANTRA', null, null).name, 'Other');
});

test('legacy alias brand still resolves without catalog match', () => {
  assert.equal(modelBrand('GLM-5.3', 'chat', 'VANTRA', 'vantra-glm-5.3-flash', null).name, 'Z.ai / GLM');
});
