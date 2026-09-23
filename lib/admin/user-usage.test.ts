import assert from 'node:assert/strict';
import test from 'node:test';
import { currentPlanView, inUsageRange, settledBucketTotal, sumStored, summarizeChat, summarizeMedia, summarizeTrials, usageRangeStart } from './user-usage';

const now = Date.parse('2026-09-23T12:00:00.000Z');
const at = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();

test('rolling Chat usage matches the runtime windows and counts live holds', () => {
  const snapshot = summarizeChat([
    { model_key: 'a', weight: 9, status: 'completed', created_at: at(1), expires_at: null },
    { model_key: 'a', weight: 6, status: 'completed', created_at: at(6), expires_at: null },
    { model_key: 'b', weight: 4, status: 'reserved', created_at: at(2), expires_at: at(-1) },
    { model_key: 'b', weight: 8, status: 'reserved', created_at: at(2), expires_at: at(1) },
    { model_key: 'a', weight: 30, status: 'completed', created_at: at(200), expires_at: null },
  ], now, { fiveHour: 20, weekly: 100 });
  assert.equal(snapshot.fiveHourUsed, 13);
  assert.equal(snapshot.weeklyUsed, 19);
  assert.equal(snapshot.fiveHourRemaining, 7);
  assert.equal(snapshot.weeklyRemaining, 81);
  assert.equal(snapshot.activeReservations, 1);
});

test('Chat capacity release uses the completed-record roll-off, not expired reservations', () => {
  const snapshot = summarizeChat([
    { model_key: 'a', weight: 10, status: 'completed', created_at: at(4), expires_at: null },
    { model_key: 'b', weight: 1, status: 'reserved', created_at: at(1), expires_at: at(-1) },
  ], now, { fiveHour: 10, weekly: 100 });
  assert.equal(snapshot.nextFiveHourAt, new Date(now + 3_600_000).toISOString());
  assert.equal(snapshot.nextWeeklyAt, null);
});

test('users with no Chat usage show zero recorded consumption and DB limits', () => {
  const snapshot = summarizeChat([], now, { fiveHour: 120, weekly: 800 });
  assert.equal(snapshot.fiveHourUsed, 0);
  assert.equal(snapshot.weeklyRemaining, 800);
  assert.equal(snapshot.activeReservations, 0);
});

test('activity ranges respect the paid cycle or Free account start', () => {
  assert.equal(usageRangeStart('cycle', now, at(240)), at(240));
  assert.equal(usageRangeStart('7d', now, at(240)), at(168));
  assert.equal(usageRangeStart('all', now, at(240)), null);
  assert.equal(inUsageRange(at(48), at(24)), false);
  assert.equal(inUsageRange(at(12), at(24)), true);
});

test('an expired paid period displays the effective Free plan and its prior status', () => {
  assert.deepEqual(currentPlanView(null, { name: 'Pro', status: 'expired' }, at(240)), {
    name: 'free', status: 'active', startsAt: at(240), endsAt: null, previousPaid: 'Pro · expired',
  });
});

test('unknown ledger amounts stay unavailable rather than becoming zero', () => {
  assert.equal(sumStored([{ amount: '10' }, { amount: '2' }]), '12');
  assert.equal(sumStored([{ amount: null }]), null);
  assert.equal(sumStored([]), '0');
});

test('Free media counts successful and failed jobs separately; unknown charges stay unavailable', () => {
  const media = summarizeMedia([
    { model_key: 'image-a', modality: 'image', state: 'completed', reservation_id: 'r1' },
    { model_key: 'image-a', modality: 'image', state: 'failed', reservation_id: 'r2' },
    { model_key: 'video-a', modality: 'video', state: 'completed', reservation_id: null },
  ], [
    { reservation_id: 'r1', modality: 'image', status: 'completed', credits_charged: '0' },
  ], (key) => key);
  assert.deepEqual([media[0].successful, media[0].failed, media[0].credits], [1, 1, '0']);
  assert.equal(media[0].breakdown[0].credits, '0');
  assert.equal(media[1].breakdown[0].credits, null);
});

test('paid media credits use settled records, not failed reservation amounts', () => {
  const [image] = summarizeMedia([
    { model_key: 'image-a', modality: 'image', state: 'completed', reservation_id: 'r1' },
    { model_key: 'image-a', modality: 'image', state: 'failed', reservation_id: 'r2' },
  ], [
    { reservation_id: 'r1', modality: 'image', status: 'completed', credits_charged: '25' },
  ], (key) => key);
  assert.equal(image.credits, '25');
  assert.deepEqual([image.successful, image.failed], [1, 1]);
});

test('paid subscription consumption covers the whole current cycle regardless of activity range', () => {
  const ledger = [
    { transaction_type: 'settle', metadata: { subscription_charged: 20, purchased_charged: 0 }, created_at: at(200) },
    { transaction_type: 'settle', metadata: { subscription_charged: 8, purchased_charged: 5 }, created_at: at(12) },
    { transaction_type: 'reserve', metadata: { subscription_charged: 99 }, created_at: at(1) },
  ];
  assert.equal(settledBucketTotal(ledger, 'subscription_charged', at(240), null), '28');
  assert.equal(settledBucketTotal(ledger, 'purchased_charged', at(168), null), '5');
});

test('Trial usage is scoped to the current paid period and counts live reservations', () => {
  const configs = [{ model_key: 'grok', trial_allowance: 1 }, { model_key: 'seedance', trial_allowance: null }];
  const usages = [
    { model_key: 'grok', trial_scope: 'entitlement:new', state: 'completed', expires_at: at(1) },
    { model_key: 'grok', trial_scope: 'entitlement:old', state: 'completed', expires_at: at(1) },
    { model_key: 'seedance', trial_scope: 'entitlement:new', state: 'released', expires_at: at(1) },
  ];
  const result = summarizeTrials(configs, usages, 'lite', 'entitlement:new', now, (key) => key);
  assert.deepEqual([result[0].used, result[0].remaining, result[0].exhausted], [1, 0, true]);
  assert.deepEqual([result[1].used, result[1].remaining, result[1].exhausted], [0, null, true]);
});
