import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeModelPlanCode } from '../models/plan-entitlements';
import {
  CHAT_WINDOW_5H_MS,
  CHAT_WINDOW_7D_MS,
  chatLevelForPlan,
  chatUsageState,
  computeWindowRelease,
  evaluateChatWindows,
  formatCapacityWait,
  isValidChatWeight,
  windowUtilization,
  type ChatPlanLimits,
  type ChatWindowRecord,
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

// ── Weighted release walk ───────────────────────────────────────────────────

const NOW = Date.parse('2026-09-22T10:00:00Z');

const rec = (ageMs: number, weight: number, now: number = NOW): ChatWindowRecord => ({
  createdAtMs: now - ageMs,
  weight,
});

test('expiring one record is enough when it covers the need', () => {
  const next = computeWindowRelease([rec(3_600_000, 90)], CHAT_WINDOW_5H_MS, 95, 100, 20);
  assert.equal(next, new Date(NOW - 3_600_000 + CHAT_WINDOW_5H_MS).toISOString());
});

test('cutoff advances past insufficient records until weight is covered', () => {
  // Used 95/100, requesting 20 → need 15. The oldest record frees only 5.
  const records = [rec(4_000_000, 5), rec(3_600_000, 90)];
  const next = computeWindowRelease(records, CHAT_WINDOW_5H_MS, 95, 100, 20);
  assert.equal(next, new Date(NOW - 3_600_000 + CHAT_WINDOW_5H_MS).toISOString());
  // Walk is oldest-first regardless of input order.
  const reversed = computeWindowRelease([...records].reverse(), CHAT_WINDOW_5H_MS, 95, 100, 20);
  assert.equal(reversed, new Date(NOW - 3_600_000 + CHAT_WINDOW_5H_MS).toISOString());
});

test('release walk returns null when capacity can never free enough', () => {
  assert.equal(computeWindowRelease([], CHAT_WINDOW_5H_MS, 0, 100, 500), null);
  assert.equal(computeWindowRelease([rec(1000, 10)], CHAT_WINDOW_5H_MS, 10, 100, 500), null);
  assert.equal(computeWindowRelease([rec(1000, 10)], CHAT_WINDOW_5H_MS, 10, null, 500), null);
});

// ── Window decision core ────────────────────────────────────────────────────

const LIMITS: ChatPlanLimits = { fiveHour: 120, weekly: 800 };

const snap = (
  fiveHourUsed: number,
  weeklyUsed: number,
  records5h: ChatWindowRecord[] = [],
  records7d: ChatWindowRecord[] = []
) => ({ fiveHourUsed, weeklyUsed, records5h, records7d });

test('requests under both windows are allowed', () => {
  const decision = evaluateChatWindows(snap(100, 700), LIMITS, 10);
  assert.equal(decision.allowed, true);
  assert.equal(decision.nextAvailableAt, null);
});

test('exact boundary fill is allowed, one unit more binds the 5-hour window', () => {
  const records = [rec(3_600_000, 110)];
  assert.equal(evaluateChatWindows(snap(110, 700, records, records), LIMITS, 10).allowed, true);
  const refused = evaluateChatWindows(snap(110, 700, records, records), LIMITS, 11);
  assert.equal(refused.allowed, false);
  assert.equal(refused.bindingWindow, 'five_hour');
  assert.equal(refused.nextAvailableAt, new Date(NOW - 3_600_000 + CHAT_WINDOW_5H_MS).toISOString());
});

test('weekly binding reports the weekly roll-off', () => {
  const records = [rec(86_400_000, 799)];
  const refused = evaluateChatWindows(snap(0, 799, [], records), LIMITS, 10);
  assert.equal(refused.allowed, false);
  assert.equal(refused.bindingWindow, 'weekly');
  assert.equal(refused.nextAvailableAt, new Date(NOW - 86_400_000 + CHAT_WINDOW_7D_MS).toISOString());
});

test('later availability binds when both windows need room (5h binds)', () => {
  // 5h: 110/120 +20 → next5 ≈ +4h50m. Weekly need resolves at +4h → 5h is later.
  const recent: ChatWindowRecord[] = [{ createdAtMs: NOW - 600_000, weight: 110 }];
  const old: ChatWindowRecord = { createdAtMs: NOW - (CHAT_WINDOW_7D_MS - 4 * 3_600_000), weight: 790 };
  const refused = evaluateChatWindows(
    snap(110, 900, recent, [old, ...recent]), { fiveHour: 120, weekly: 800 }, 20
  );
  assert.equal(refused.allowed, false);
  assert.equal(refused.bindingWindow, 'five_hour');
  assert.equal(refused.nextAvailableAt, new Date(NOW - 600_000 + CHAT_WINDOW_5H_MS).toISOString());
});

test('later availability binds when both windows need room (7d binds)', () => {
  const recent: ChatWindowRecord[] = [{ createdAtMs: NOW - 600_000, weight: 110 }];
  const mid: ChatWindowRecord = { createdAtMs: NOW - 3 * 86_400_000, weight: 700 };
  const refused = evaluateChatWindows(
    snap(110, 810, recent, [mid, ...recent]), { fiveHour: 120, weekly: 800 }, 20
  );
  assert.equal(refused.allowed, false);
  assert.equal(refused.bindingWindow, 'weekly');
  assert.equal(refused.nextAvailableAt, new Date(mid.createdAtMs + CHAT_WINDOW_7D_MS).toISOString());
});

test('a window that can never free enough binds with no countdown', () => {
  const refused = evaluateChatWindows(snap(0, 0), LIMITS, 500);
  assert.equal(refused.allowed, false);
  assert.equal(refused.nextAvailableAt, null);
});

test('unlimited windows never refuse', () => {
  const decision = evaluateChatWindows(snap(50_000, 9_000_000), { fiveHour: null, weekly: null }, 10);
  assert.equal(decision.allowed, true);
});

// ── Reservation lifecycle: races, release paths, stale, expiry ─────────────
// Mirrors the reserve_chat_usage / finalize_chat_usage RPC contract with an
// in-memory store so the algorithm itself is verified (Postgres locking
// reviewed separately).

interface ReservationRow {
  operationKey: string;
  userId: string;
  weight: number;
  createdAtMs: number;
  status: 'reserved' | 'completed';
  expiresAtMs: number | null;
}

const RESERVE_TTL_MS = 15 * 60_000;

class MemoryChatStore {
  limits: Record<string, ChatPlanLimits>;
  rows: ReservationRow[] = [];
  private tail = Promise.resolve();

  constructor(limits: Record<string, ChatPlanLimits>) {
    this.limits = limits;
  }

  private exclusive<T>(work: () => T | Promise<T>): Promise<T> {
    const run = this.tail.then(work);
    this.tail = run.then(() => undefined, () => undefined);
    return run;
  }

  private purge(userId: string, nowMs: number) {
    this.rows = this.rows.filter((row) =>
      !(row.userId === userId && row.status === 'reserved' && row.expiresAtMs != null && row.expiresAtMs <= nowMs));
  }

  async reserve(args: {
    userId: string; operationKey: string; planCode: string; weight: number; nowMs: number;
  }) {
    return this.exclusive(() => {
      this.purge(args.userId, args.nowMs);
      const existing = this.rows.find((row) =>
        row.operationKey === args.operationKey && row.userId === args.userId);
      const limits = this.limits[args.planCode] ?? null;
      if (!limits) return { allowed: false as const, duplicate: false, reason: 'limits_unconfigured' as const };
      const held = this.rows.filter((row) => row.userId === args.userId);
      const completed = held
        .filter((row) => row.status === 'completed')
        .sort((a, b) => a.createdAtMs - b.createdAtMs);
      const view = {
        fiveHourUsed: held.filter((r) => r.createdAtMs > args.nowMs - CHAT_WINDOW_5H_MS).reduce((n, r) => n + r.weight, 0),
        weeklyUsed: held.reduce((n, r) => n + r.weight, 0),
        records5h: completed.filter((r) => r.createdAtMs > args.nowMs - CHAT_WINDOW_5H_MS).map((r) => ({ createdAtMs: r.createdAtMs, weight: r.weight })),
        records7d: completed.map((r) => ({ createdAtMs: r.createdAtMs, weight: r.weight })),
      };
      if (existing) {
        return {
          allowed: true as const, duplicate: true,
          reason: existing.status === 'completed' ? 'already_recorded' as const : 'already_reserved' as const,
        };
      }
      const decision = evaluateChatWindows(view, limits, args.weight);
      if (!decision.allowed) {
        return { allowed: false as const, duplicate: false, reason: 'limit_reached' as const, nextAvailableAt: decision.nextAvailableAt, bindingWindow: decision.bindingWindow };
      }
      this.rows.push({
        operationKey: args.operationKey, userId: args.userId, weight: args.weight,
        createdAtMs: args.nowMs, status: 'reserved', expiresAtMs: args.nowMs + RESERVE_TTL_MS,
      });
      return { allowed: true as const, duplicate: false, reason: 'reserved' as const };
    });
  }

  async finalize(operationKey: string, outcome: 'completed' | 'released') {
    return this.exclusive(() => {
      const row = this.rows.find((r) => r.operationKey === operationKey);
      if (!row) return { ok: true, reason: 'unknown_key_noop' };
      if (outcome === 'completed') {
        if (row.status === 'completed') return { ok: true, reason: 'already_completed' };
        row.status = 'completed';
        row.expiresAtMs = null;
        return { ok: true, reason: 'completed' };
      }
      this.rows = this.rows.filter((r) => r !== row);
      return { ok: true, reason: 'released' };
    });
  }

  consumed(userId: string, nowMs: number) {
    return {
      fiveHour: this.rows.filter((r) => r.userId === userId && r.status === 'completed' && r.createdAtMs > nowMs - CHAT_WINDOW_5H_MS).reduce((n, r) => n + r.weight, 0),
      weekly: this.rows.filter((r) => r.userId === userId && r.status === 'completed' && r.createdAtMs > nowMs - CHAT_WINDOW_7D_MS).reduce((n, r) => n + r.weight, 0),
    };
  }

  held(userId: string, nowMs: number) {
    return {
      fiveHour: this.rows.filter((r) => r.userId === userId && r.createdAtMs > nowMs - CHAT_WINDOW_5H_MS).reduce((n, r) => n + r.weight, 0),
    };
  }
}

test('duplicate operation keys never reserve twice', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 120, weekly: 800 } });
  const first = await store.reserve({ userId: 'u1', operationKey: 'op-1', planCode: 'free', weight: 10, nowMs: NOW });
  assert.equal(first.allowed, true);
  const replay = await store.reserve({ userId: 'u1', operationKey: 'op-1', planCode: 'free', weight: 10, nowMs: NOW + 1000 });
  assert.equal(replay.allowed, true);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.reason, 'already_reserved');
  await store.finalize('op-1', 'completed');
  assert.deepEqual(store.consumed('u1', NOW + 1000), { fiveHour: 10, weekly: 10 });
});

test('ten concurrent retries with one key hold capacity exactly once', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 120, weekly: 800 } });
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    store.reserve({ userId: 'u1', operationKey: 'op-retry', planCode: 'free', weight: 10, nowMs: NOW + i })));
  assert.ok(results.every((result) => result.allowed));
  assert.equal(results.filter((result) => result.duplicate).length, 9);
  assert.deepEqual(store.held('u1', NOW + 100), { fiveHour: 10 });
});

test('ten concurrent distinct requests near the limit: only reserved capacity executes', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 25, weekly: 800 } });
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    store.reserve({ userId: 'u1', operationKey: `op-${i}`, planCode: 'free', weight: 10, nowMs: NOW + i })));
  const winners = results.filter((result) => result.allowed);
  // 25 units of room hold two 10-weight reservations; the rest refuse.
  assert.equal(winners.length, 2);
  assert.equal(winners.every((result) => !result.duplicate), true);
  assert.equal(store.held('u1', NOW + 100).fiveHour, 20);
  // Winners complete; losers never execute and never consume.
  await Promise.all(winners.map((_, i) => store.finalize(`op-${i}`, 'completed')));
  assert.deepEqual(store.consumed('u1', NOW + 100), { fiveHour: 20, weekly: 20 });
});

test('provider failure releases the reservation without consuming', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 15, weekly: 800 } });
  const first = await store.reserve({ userId: 'u1', operationKey: 'op-fail', planCode: 'free', weight: 10, nowMs: NOW });
  assert.equal(first.allowed, true);
  await store.finalize('op-fail', 'released');
  assert.deepEqual(store.consumed('u1', NOW), { fiveHour: 0, weekly: 0 });
  const retry = await store.reserve({ userId: 'u1', operationKey: 'op-next', planCode: 'free', weight: 10, nowMs: NOW + 1000 });
  assert.equal(retry.allowed, true);
});

test('cancelled requests release held capacity', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 10, weekly: 800 } });
  await store.reserve({ userId: 'u1', operationKey: 'op-cancel', planCode: 'free', weight: 10, nowMs: NOW });
  const blocked = await store.reserve({ userId: 'u1', operationKey: 'op-other', planCode: 'free', weight: 10, nowMs: NOW + 500 });
  assert.equal(blocked.allowed, false);
  await store.finalize('op-cancel', 'released');
  const freed = await store.reserve({ userId: 'u1', operationKey: 'op-other', planCode: 'free', weight: 10, nowMs: NOW + 1000 });
  assert.equal(freed.allowed, true);
});

test('completed requests count exactly once across repeated finalizes', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 120, weekly: 800 } });
  await store.reserve({ userId: 'u1', operationKey: 'op-once', planCode: 'free', weight: 10, nowMs: NOW });
  await store.finalize('op-once', 'completed');
  await store.finalize('op-once', 'completed');
  assert.deepEqual(store.consumed('u1', NOW), { fiveHour: 10, weekly: 10 });
});

test('stale reservations stop holding capacity after expiry', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 10, weekly: 800 } });
  await store.reserve({ userId: 'u1', operationKey: 'op-stale', planCode: 'free', weight: 10, nowMs: NOW });
  const blocked = await store.reserve({ userId: 'u1', operationKey: 'op-x', planCode: 'free', weight: 10, nowMs: NOW + 1000 });
  assert.equal(blocked.allowed, false);
  // Process died; the next reserve past the TTL purges the stale hold.
  const recovered = await store.reserve({ userId: 'u1', operationKey: 'op-y', planCode: 'free', weight: 10, nowMs: NOW + RESERVE_TTL_MS + 1 });
  assert.equal(recovered.allowed, true);
  assert.deepEqual(store.consumed('u1', NOW + RESERVE_TTL_MS + 1), { fiveHour: 0, weekly: 0 });
});

test('rolling 5-hour expiry frees allowance after completion', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 120, weekly: 800 } });
  await store.reserve({ userId: 'u1', operationKey: 'op-old', planCode: 'free', weight: 120, nowMs: NOW });
  await store.finalize('op-old', 'completed');
  const blocked = await store.reserve({ userId: 'u1', operationKey: 'op-new', planCode: 'free', weight: 10, nowMs: NOW + 1000 });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reason === 'limit_reached' && blocked.nextAvailableAt);
  const afterExpiry = await store.reserve({ userId: 'u1', operationKey: 'op-later', planCode: 'free', weight: 10, nowMs: NOW + CHAT_WINDOW_5H_MS + 1 });
  assert.equal(afterExpiry.allowed, true);
});

test('refused requests carry a weighted next availability', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 100, weekly: 10_000 } });
  // Used 95 = small oldest record (5) + heavy recent (90); requesting 20
  // needs 15, so the oldest expiry alone is insufficient.
  await store.reserve({ userId: 'u1', operationKey: 'op-a', planCode: 'free', weight: 5, nowMs: NOW - 4_000_000 });
  await store.finalize('op-a', 'completed');
  await store.reserve({ userId: 'u1', operationKey: 'op-b', planCode: 'free', weight: 90, nowMs: NOW - 3_600_000 });
  await store.finalize('op-b', 'completed');
  const refused = await store.reserve({ userId: 'u1', operationKey: 'op-c', planCode: 'free', weight: 20, nowMs: NOW });
  assert.equal(refused.allowed, false);
  assert.equal(refused.bindingWindow, 'five_hour');
  assert.equal(refused.nextAvailableAt, new Date(NOW - 3_600_000 + CHAT_WINDOW_5H_MS).toISOString());
});

test('plan change re-evaluates against the new limits', async () => {
  const store = new MemoryChatStore({ pro: { fiveHour: 250, weekly: 3000 }, free: { fiveHour: 120, weekly: 800 } });
  await store.reserve({ userId: 'u1', operationKey: 'op-pro', planCode: 'pro', weight: 200, nowMs: NOW });
  await store.finalize('op-pro', 'completed');
  const downgraded = await store.reserve({ userId: 'u1', operationKey: 'op-free', planCode: 'free', weight: 10, nowMs: NOW + 1000 });
  assert.equal(downgraded.allowed, false);
});

test('missing plan limits refuse without inventing', async () => {
  const store = new MemoryChatStore({});
  const result = await store.reserve({ userId: 'u1', operationKey: 'op-x', planCode: 'free', weight: 10, nowMs: NOW });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'limits_unconfigured');
  assert.deepEqual(store.consumed('u1', NOW), { fiveHour: 0, weekly: 0 });
});

test('zero-weight models reserve without consuming allowance', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 120, weekly: 800 } });
  const result = await store.reserve({ userId: 'u1', operationKey: 'op-zero', planCode: 'free', weight: 0, nowMs: NOW });
  assert.equal(result.allowed, true);
  await store.finalize('op-zero', 'completed');
  assert.deepEqual(store.consumed('u1', NOW), { fiveHour: 0, weekly: 0 });
});

test('finalizing an unknown key is a safe no-op', async () => {
  const store = new MemoryChatStore({ free: { fiveHour: 120, weekly: 800 } });
  assert.deepEqual(await store.finalize('op-ghost', 'released'), { ok: true, reason: 'unknown_key_noop' });
});
