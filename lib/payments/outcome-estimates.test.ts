import assert from 'node:assert/strict';
import test from 'node:test';
import { estimatePlanOutcomes } from './outcome-estimates';

test('uses configured eligible model prices for a realistic range', () => {
  const models = [
    { modality: 'image', customerCreditPrice: 100, enabled: true, archived: false, visibleInStudio: true, allowedPlans: ['pro'] },
    { modality: 'image', customerCreditPrice: 300, enabled: true, archived: false, visibleInStudio: true, allowedPlans: ['pro'] },
    { modality: 'image', customerCreditPrice: 1, enabled: true, archived: false, visibleInStudio: true, allowedPlans: ['max'] },
  ];
  assert.deepEqual(estimatePlanOutcomes(models, 'pro', 'image', 3000), { min: 10, max: 30 });
});

test('omits estimates when no configured paid model is eligible', () => {
  assert.equal(estimatePlanOutcomes([], 'pro', 'video', 3000), null);
});
