import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeModelPlanCode } from '../models/plan-entitlements';
import {
  CHAT_WINDOW_5H_MS,
  CHAT_WINDOW_7D_MS,
  chatLevelForPlan,
  chatUsageState,
  evaluateChatWindows,
  formatCapacityWait,
  isValidChatWeight,
  windowUtilization,
  type ChatPlanLimits,
} from './chat-usage';

// ── Plan → customer-facing level ────────────────────────────────────────────

test('plan maps to customer-facing chat level', () => {
  assert.equal(chatLevelForPlan('free'), 'standard');
  assert.equal(chatLevelForPlan('lite'), 'extended');
  assert.equal(chatLevelForPlan('pro'), 'high');
  assert.equal(chatLevelForPlan('max'), 'high');
  assert.equal(chatLevelForPlan(normalizeModelPlanCode('unknown-plan')), 'standard');
});

// ── Weight validation (fail closed, never invent) ───────────────────────────

test('only non-negative safe integers are valid chat weights', () => {
  assert.equal(isValidChatWeight(null), false);
  assert.equal(isValidChatWeight(undefined), false);
  assert.equal(isValidChatWeight('5'), false);
  assert.equal(isValidChatWeight(-1), false);
  assert.equal(isValidChatWeight(1.5), false);
  assert.equal(isValidChatWeight(Number.NaN), false);
  assert.equal(isValidChatWeight(0), true);
  assert.equal(isValidChatWeight(7), true);
});

// ── Utilization and customer-facing state ───────────────────────────────────

test('null limit means unlimited utilization', () => {
  assert.equal(windowUtilization(9999, null), 0);
  assert.equal(windowUtilization(60, 120), 0.5);
  assert.equal(windowUtilization(0, 0), 0);
  assert.equal(windowUtilization(3, 0), 2);
});

test('state thresholds never expose raw numbers', () => {
  assert.equal(chatUsageState(0.2, 0.3), 'plenty');
  assert.equal(chatUsageState(0.69, 0.69), 'plenty');
  assert.equal(chatUsageState(0.7, 0.1), 'high');
  assert.equal(chatUsageState(0.1, 0.89), 'high');
  assert.equal(chatUsageState(0.9, 0.2), 'near');
  assert.equal(chatUsageState(1, 0.2), 'limit');
  assert.equal(chatUsageState(0.2, 1.4), 'limit');
});

// ── Countdown formatting ────────────────────────────────────────────────────

test('capacity wait formats calmly or stays silent', () => {
  const now = Date.parse('2026-09-22T10:00:00Z');
  assert.equal(formatCapacityWait(null, now), null);
  assert.equal(formatCapacityWait('2026-09-22T09:59:00Z', now), null);
  assert.equal(formatCapacityWait('2026-09-22T10:05:00Z', now), '5m');
  assert.equal(formatCapacityWait('2026-09-22T11:24:00Z', now), '1h 24m');
  assert.equal(formatCapacityWait('2026-09-22T12:00:00Z', now), '2h');
  assert.equal(formatCapacityWait('2026-09-25T12:00:00Z', now), '3d 2h');
  assert.equal(formatCapacityWait('not-a-date', now), null);
});

// ── Window decision core ────────────────────────────────────────────────────

const LIMITS: ChatPlanLimits = { fiveHour: 120, weekly: 800 };

test('requests under both windows are allowed', () => {
  const decision = evaluateChatWindows(
    { fiveHourUsed: 100, weeklyUsed: 700, oldest5h: null, oldest7d: null },
    LIMITS, 10, Date.now()
  );
  assert.equal(decision.allowed, true);
  assert.equal(decision.nextAvailableAt, null);
});

test('exact boundary fill is allowed, one unit more is refused', () => {
  const now = Date.now();
  const oldest = new Date(now - 3_600_000).toISOString();
  const snap = { fiveHourUsed: 110, weeklyUsed: 700, oldest5h: oldest, oldest7d: oldest };
  assert.equal(evaluateChatWindows(snap, LIMITS, 10, now).allowed, true);
  const refused = evaluateChatWindows(snap, LIMITS, 11, now);
  assert.equal(refused.allowed, false);
  assert.equal(refused.bindingWindow, 'five_hour');
  assert.equal(refused.nextAvailableAt, new Date(new Date(oldest).getTime() + CHAT_WINDOW_5H_MS).toISOString());
});

test('weekly binding reports the weekly roll-off', () => {
  const now = Date.now();
  const oldest = new Date(now - 86_400_000).toISOString();
  const refused = evaluateChatWindows(
    { fiveHourUsed: 0, weeklyUsed: 799, oldest5h: null, oldest7d: oldest },
    LIMITS, 10, now
  );
  assert.equal(refused.allowed, false);
  assert.equal(refused.bindingWindow, 'weekly');
  assert.equal(refused.nextAvailableAt, new Date(new Date(oldest).getTime() + CHAT_WINDOW_7D_MS).toISOString());
});

test('unlimited windows never refuse', () => {
  const decision = evaluateChatWindows(
    { fiveHourUsed: 50_000, weeklyUsed: 9_000_000, oldest5h: null, oldest7d: null },
    { fiveHour: null, weekly: null }, 10, Date.now()
  );
  assert.equal(decision.allowed, true);
});

test('single request heavier than the limit is refused without a countdown', () => {
  const refused = evaluateChatWindows(
    { fiveHourUsed: 0, weeklyUsed: 0, oldest5h: null, oldest7d: null },
    LIMITS, 500, Date.now()
  );
  assert.equal(refused.allowed, false);
  assert.equal(refused.nextAvailableAt, null);
});

// ── Store semantics: idempotency, concurrency, expiry, plan change ──────────
// Mirrors the consume_chat_usage RPC contract with an in-memory store so the
// algorithm itself is verified (Postgres locking reviewed separately).

interface UsageRecord {
  operationKey: string;
  userId: string;
  weight: number;
  createdAtMs: number;
}

class MemoryChatStore {
  limits: Record<string, ChatPlanLimits>;
  records: UsageRecord[] = [];
  private tail = Promise.resolve();

  constructor(limits: Record<string, ChatPlanLimits>) {
    this.limits = limits;
  }

  private exclusive<T>(work: () => T | Promise<T>): Promise<T> {
    const run = this.tail.then(work);
    this.tail = run.then(() => undefined, () => undefined);
    return run;
  }

  async checkAndConsume(args: {
    userId: string; operationKey: string; planCode: string; weight: number; nowMs: number;
  }) {
    return this.exclusive(() => {
      const duplicate = this.records.some(
        (record) => record.operationKey === args.operationKey && record.userId === args.userId
      );
      const limits = this.limits[args.planCode] ?? null;
      if (!limits) return { allowed: false as const, duplicate: false, reason: 'limits_unconfigured' as const };
      const inWindow = this.records.filter((record) =>
        record.userId === args.userId && record.createdAtMs > args.nowMs - CHAT_WINDOW_7D_MS);
      const sums = {
        fiveHourUsed: inWindow.filter((r) => r.createdAtMs > args.nowMs - CHAT_WINDOW_5H_MS).reduce((n, r) => n + r.weight, 0),
        weeklyUsed: inWindow.reduce((n, r) => n + r.weight, 0),
        oldest5h: inWindow.filter((r) => r.createdAtMs > args.nowMs - CHAT_WINDOW_5H_MS).map((r) => r.createdAtMs).sort((a, b) => a - b)[0],
        oldest7d: inWindow.map((r) => r.createdAtMs).sort((a, b) => a - b)[0],
      };
      const snapshot = {
        fiveHourUsed: sums.fiveHourUsed,
        weeklyUsed: sums.weeklyUsed,
        oldest5h: sums.oldest5h == null ? null : new Date(sums.oldest5h).toISOString(),
        oldest7d: sums.oldest7d == null ? null : new Date(sums.oldest7d).toISOString(),
      };
      if (duplicate) {
        return { allowed: true as const, duplicate: true, reason: 'already_recorded' as const, ...sums };
      }
      const decision = evaluateChatWindows(snapshot, limits, args.weight, args.nowMs);
      if (!decision.allowed) {
        return { allowed: false as const, duplicate: false, reason: 'limit_reached' as const, nextAvailableAt: decision.nextAvailableAt };
      }
      this.records.push({ operationKey: args.operationKey, userId: args.userId, weight: args.weight, createdAtMs: args.nowMs });
      return { allowed: true as const, duplicate: false, reason: 'recorded' as const };
    });
  }

  totals(userId: string, nowMs: number) {
    return {
      fiveHour: this.records.filter((r) => r.userId === userId && r.createdAtMs > nowMs - CHAT_WINDOW_5H_MS).reduce((n, r) => n + r.weight, 0),
      weekly: this.records.filter((r) => r.userId === userId && r.createdAtMs > nowMs - CHAT_WINDOW_7D_MS).reduce((n, r) => n + r.weight, 0),
    };
  }
}

const NOW = Date.parse('2026-09-22T10:00:00Z');

test('duplicate operation keys never double-charge', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 120, weekly: 800 } });
  const first = await store.checkAndConsume({ userId: 'u1', operationKey: 'op-1', planCode: 'free', weight: 10, nowMs: NOW });
  assert.equal(first.allowed, true);
  const replay = await store.checkAndConsume({ userId: 'u1', operationKey: 'op-1', planCode: 'free', weight: 10, nowMs: NOW + 1000 });
  assert.equal(replay.allowed, true);
  assert.equal(replay.duplicate, true);
  assert.deepEqual(store.totals('u1', NOW + 1000), { fiveHour: 10, weekly: 10 });
});

test('ten concurrent retries with one key charge exactly once', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 120, weekly: 800 } });
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    store.checkAndConsume({ userId: 'u1', operationKey: 'op-retry', planCode: 'free', weight: 10, nowMs: NOW + i })));
  assert.ok(results.every((result) => result.allowed));
  assert.equal(results.filter((result) => result.duplicate).length, 9);
  assert.deepEqual(store.totals('u1', NOW + 100), { fiveHour: 10, weekly: 10 });
});

test('concurrent distinct requests cannot overshoot the window', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 25, weekly: 800 } });
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    store.checkAndConsume({ userId: 'u1', operationKey: `op-${i}`, planCode: 'free', weight: 10, nowMs: NOW + i })));
  assert.equal(results.filter((result) => result.allowed).length, 2);
  assert.equal(results.filter((result) => !result.allowed).length, 8);
  assert.deepEqual(store.totals('u1', NOW + 100), { fiveHour: 20, weekly: 20 });
});

test('rolling 5-hour expiry frees allowance', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 120, weekly: 800 } });
  await store.checkAndConsume({ userId: 'u1', operationKey: 'op-old', planCode: 'free', weight: 120, nowMs: NOW });
  const blocked = await store.checkAndConsume({ userId: 'u1', operationKey: 'op-new', planCode: 'free', weight: 10, nowMs: NOW + 1000 });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reason === 'limit_reached' && blocked.nextAvailableAt);
  const afterExpiry = await store.checkAndConsume({ userId: 'u1', operationKey: 'op-later', planCode: 'free', weight: 10, nowMs: NOW + CHAT_WINDOW_5H_MS + 1 });
  assert.equal(afterExpiry.allowed, true);
});

test('plan change re-evaluates against the new limits', async () => {
  const store = new MemoryChatStore({ pro: { fiveHour: 250, weekly: 3000 }, free: { fiveHour: 120, weekly: 800 } });
  await store.checkAndConsume({ userId: 'u1', operationKey: 'op-pro', planCode: 'pro', weight: 200, nowMs: NOW });
  const downgraded = await store.checkAndConsume({ userId: 'u1', operationKey: 'op-free', planCode: 'free', weight: 10, nowMs: NOW + 1000 });
  assert.equal(downgraded.allowed, false);
});

test('missing plan limits refuse without inventing', async () => {
  const store = new MemoryChatStore({});
  const result = await store.checkAndConsume({ userId: 'u1', operationKey: 'op-x', planCode: 'free', weight: 10, nowMs: NOW });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'limits_unconfigured');
  assert.deepEqual(store.totals('u1', NOW), { fiveHour: 0, weekly: 0 });
});

test('zero-weight models record without consuming allowance', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 120, weekly: 800 } });
  const result = await store.checkAndConsume({ userId: 'u1', operationKey: 'op-zero', planCode: 'free', weight: 0, nowMs: NOW });
  assert.equal(result.allowed, true);
  assert.deepEqual(store.totals('u1', NOW), { fiveHour: 0, weekly: 0 });
});
