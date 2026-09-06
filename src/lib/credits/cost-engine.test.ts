import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CostEngine,
  MarginProtectionError,
  UnknownPricingError,
  UnsupportedUsageError,
  type ModelPricing,
} from './cost-engine';

// Test-only fixtures. These values are not production prices or product claims.
const fixture: ModelPricing = {
  modelId: 'fixture/chat-model',
  provider: 'fixture-provider',
  providerModel: 'fixture-provider-model',
  modality: 'chat',
  version: 'test-v1',
  currency: 'USD',
  creditValueMinor: 10n,
  minimumMarginBps: 2_000n,
  rates: {
    inputTokensPerMillionMinor: 1_000n,
    outputTokensPerMillionMinor: 2_000n,
    cachedTokensPerMillionMinor: 500n,
  },
};

test('unknown pricing fails closed', () => {
  const engine = new CostEngine([]);
  assert.throws(() => engine.quote('unknown/model', { inputTokens: 1n }), UnknownPricingError);
});

test('calculates token cost and rounds credits up to protect margin', () => {
  const engine = new CostEngine([fixture]);
  const quote = engine.quote(fixture.modelId, {
    inputTokens: 1_000_000n,
    outputTokens: 500_000n,
    cachedTokens: 200_000n,
  });

  assert.equal(quote.providerCostMinor, 2_100n);
  assert.equal(quote.creditsRequired, 263n);
  assert.equal(quote.creditRevenueMinor, 2_630n);
  assert.ok(quote.marginBps >= fixture.minimumMarginBps);
});

test('nonzero unsupported usage fails closed', () => {
  const engine = new CostEngine([fixture]);
  assert.throws(
    () => engine.quote(fixture.modelId, { images: 1n }),
    UnsupportedUsageError,
  );
});

test('actual provider cost cannot violate the configured margin floor', () => {
  const engine = new CostEngine([fixture]);
  assert.throws(
    () => engine.verifyActualCost(fixture.modelId, { inputTokens: 1_000_000n }, 100n),
    MarginProtectionError,
  );
});

test('supports image, megapixel, video, and video-second pricing units', () => {
  const mediaFixture: ModelPricing = {
    ...fixture,
    modelId: 'fixture/media-model',
    modality: 'video',
    minimumMarginBps: 0n,
    rates: {
      perImageMinor: 10n,
      perMegapixelMinor: 20n,
      perVideoMinor: 30n,
      perVideoSecondMinor: 40n,
    },
  };
  const engine = new CostEngine([mediaFixture]);
  const quote = engine.quote(mediaFixture.modelId, {
    images: 2n,
    megapixelsMicros: 1_500_000n,
    videos: 1n,
    videoSeconds: 3n,
  });

  assert.equal(quote.providerCostMinor, 200n);
});
