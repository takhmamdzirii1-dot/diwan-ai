import assert from 'node:assert/strict';
import test from 'node:test';
import { modelNeedsAttention, modelStatusBadgeOf, modelStatusOf } from './model-status';
import type { AdminModelRow } from './types';

function row(overrides: Partial<AdminModelRow>): AdminModelRow {
  return {
    key: 'k',
    catalogOnly: false,
    provider: 'p',
    modelId: 'm',
    displayName: 'M',
    modality: 'chat',
    enabled: false,
    availability: 'available',
    providerCost: null,
    providerCostState: 'unknown',
    creditPrice: 10,
    priority: 'unassigned',
    activationSupported: true,
    persisted: true,
    updatedAt: null,
    shortDescription: null,
    mediaUrl: null,
    category: null,
    sortOrder: 0,
    visibleInStudio: false,
    availabilityLabel: null,
    capabilities: {},
    allowedPlans: [],
    planAccess: {},
    archived: false,
    routes: [],
    providerOptions: [],
    audit: [],
    ...overrides,
  } as AdminModelRow;
}

const readyRoute = {
  id: 'r',
  providerId: 'p1',
  providerModelId: 'backend-1',
  enabled: true,
  priority: 0,
  fallback: false,
  configured: true,
  providerEnabled: true,
};

// Regression: an enabled model with provider_config_required availability
// (e.g. Gemini 3.8 Flash) must read Active everywhere, not Unconfigured.
test('enabled model with missing setup stays Active, flagged separately', () => {
  const gemini = row({ displayName: 'Gemini 3.8 Flash', enabled: true, availability: 'provider_config_required' });
  assert.equal(modelStatusOf(gemini), 'enabled');
  assert.equal(modelStatusBadgeOf(gemini), 'enabled');
  assert.equal(modelNeedsAttention(gemini), true);
});

test('healthy enabled model is Active with no attention marker', () => {
  const healthy = row({ enabled: true, routes: [readyRoute] });
  assert.equal(modelStatusOf(healthy), 'enabled');
  assert.equal(modelNeedsAttention(healthy), false);
});

test('availability alone never forces Unconfigured', () => {
  const model = row({ enabled: true, availability: 'provider_config_required', routes: [readyRoute] });
  assert.equal(modelStatusOf(model), 'enabled');
  assert.equal(modelNeedsAttention(model), false);
});

test('disabled model reads Disabled with no marker', () => {
  const model = row({ enabled: false });
  assert.equal(modelStatusOf(model), 'disabled');
  assert.equal(modelStatusBadgeOf(model), 'disabled');
  assert.equal(modelNeedsAttention(model), false);
});

test('archived model filters as Disabled but keeps the Archived badge', () => {
  const model = row({ archived: true, enabled: false });
  assert.equal(modelStatusOf(model), 'disabled');
  assert.equal(modelStatusBadgeOf(model), 'archived');
  assert.equal(modelNeedsAttention(model), false);
});

test('catalog-only rows read Unconfigured, never Active', () => {
  const model = row({ catalogOnly: true, enabled: false });
  assert.equal(modelStatusOf(model), 'unconfigured');
  assert.equal(modelNeedsAttention(model), false);
});

test('undecided trial allowance flags attention without inventing a value', () => {
  const undecided = row({
    enabled: true,
    routes: [readyRoute],
    planAccess: {
      free: { state: 'trial', trialAllowance: null },
      lite: { state: 'included', trialAllowance: null },
      pro: { state: 'included', trialAllowance: null },
      max: { state: 'included', trialAllowance: null },
    },
  });
  assert.equal(modelStatusOf(undecided), 'enabled');
  assert.equal(modelNeedsAttention(undecided), true);
  const decided = row({
    enabled: true,
    routes: [readyRoute],
    planAccess: {
      free: { state: 'trial', trialAllowance: 1 },
      lite: { state: 'included', trialAllowance: null },
      pro: { state: 'included', trialAllowance: null },
      max: { state: 'included', trialAllowance: null },
    },
  });
  assert.equal(modelNeedsAttention(decided), false);
});

test('missing customer price flags attention on enabled models', () => {
  assert.equal(modelNeedsAttention(row({ enabled: true, creditPrice: null, routes: [readyRoute] })), true);
  assert.equal(modelNeedsAttention(row({ enabled: false, creditPrice: null, routes: [readyRoute] })), false);
});

test('unready routes flag attention; ready route clears it', () => {
  const base = { enabled: true, creditPrice: 10 };
  assert.equal(
    modelNeedsAttention(row({ ...base, routes: [{ ...readyRoute, configured: false }] })),
    true
  );
  assert.equal(
    modelNeedsAttention(row({ ...base, routes: [{ ...readyRoute, providerEnabled: false }] })),
    true
  );
  assert.equal(
    modelNeedsAttention(row({ ...base, routes: [{ ...readyRoute, enabled: false }] })),
    true
  );
  assert.equal(modelNeedsAttention(row({ ...base, routes: [readyRoute] })), false);
});

test('badge, filter, and count agree on one canonical meaning', () => {
  const models = [
    row({ key: 'a', enabled: true, availability: 'provider_config_required' }),
    row({ key: 'b', enabled: true, routes: [readyRoute] }),
    row({ key: 'c', enabled: false }),
    row({ key: 'd', archived: true, enabled: false }),
    row({ key: 'e', catalogOnly: true, enabled: false }),
  ];
  const activeKeys = new Set(['a', 'b']);
  // Filter predicate (mirrors ModelsView).
  assert.deepEqual(
    new Set(models.filter((m) => modelStatusOf(m) === 'enabled').map((m) => m.key)),
    activeKeys
  );
  // Badge predicate.
  assert.deepEqual(
    new Set(
      models
        .filter((m) => (m.archived ? 'archived' : modelStatusOf(m)) === 'enabled')
        .map((m) => m.key)
    ),
    activeKeys
  );
  // Summary count predicate.
  assert.equal(models.filter((m) => modelStatusOf(m) === 'enabled').length, 2);
});
