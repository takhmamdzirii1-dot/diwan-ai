import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_MODEL_ALLOWED_PLANS,
  ModelPlanAccessError,
  applyModelPlanAccess,
  assertModelPlanAccess,
  defaultAllowedPlansForModel,
} from './plan-entitlements';

test('Free selected strong model succeeds', () => {
  assert.equal(assertModelPlanAccess(defaultAllowedPlansForModel('vantra-glm-5.3-flash'), 'free'), 'free');
});

test('Free blocked model is rejected with its required plan', () => {
  assert.throws(
    () => assertModelPlanAccess(defaultAllowedPlansForModel('vantra-union-alpha'), 'free'),
    (cause) => cause instanceof ModelPlanAccessError && cause.requiredPlan === 'pro'
  );
});

test('Lite Core model succeeds', () => {
  assert.equal(assertModelPlanAccess(defaultAllowedPlansForModel('vantra-hy3'), 'lite'), 'lite');
});

test('Lite cannot use a Pro-only model independently of Credits', () => {
  assert.throws(
    () => assertModelPlanAccess(defaultAllowedPlansForModel('vantra-h3-max'), 'lite'),
    (cause) => cause instanceof ModelPlanAccessError && cause.requiredPlan === 'pro'
  );
});

test('Pro can use Premium models', () => {
  assert.equal(assertModelPlanAccess(defaultAllowedPlansForModel('vantra-h3-max'), 'pro'), 'pro');
});

test('frontend access state uses the same resolver as backend enforcement', () => {
  const model = applyModelPlanAccess({ allowedPlans: ['pro', 'max'] as const }, 'lite');
  assert.deepEqual({ allowed: model.planAccessible, requiredPlan: model.requiredPlan }, {
    allowed: false,
    requiredPlan: 'pro',
  });
});

test('MAX remains allowed for every explicitly configured model', () => {
  for (const allowedPlans of Object.values(DEFAULT_MODEL_ALLOWED_PLANS)) {
    assert.equal(assertModelPlanAccess(allowedPlans, 'max'), 'max');
  }
});

test('Lite can access most explicitly configured models', () => {
  const configured = Object.values(DEFAULT_MODEL_ALLOWED_PLANS);
  const accessible = configured.filter((plans) => plans.includes('lite')).length;
  assert.ok(accessible > configured.length - accessible);
});
