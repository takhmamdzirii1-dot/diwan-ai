import test from 'node:test';
import assert from 'node:assert/strict';
import { connectedAppConfiguration } from './configuration.server';

test('shared encryption failure is distinguished from credentials and unfinished adapters', () => {
  const summary = connectedAppConfiguration({ GOOGLE_DRIVE_CLIENT_ID: 'fixture-id', GOOGLE_DRIVE_CLIENT_SECRET: 'fixture-secret' });
  assert.equal(summary.disabledReasons.google_drive, 'encryption_missing');
  assert.equal(summary.prerequisites.GOOGLE_DRIVE_CLIENT_ID.present, true);
  assert.equal(summary.disabledReasons.shopify, 'privacy_uninstall_webhooks_not_implemented');
  assert.ok(!JSON.stringify(summary).includes('fixture-id'));
  assert.ok(!JSON.stringify(summary).includes('fixture-secret'));
});

test('diagnostics match existing exact flag and credential contracts without exposing values', () => {
  const env = { PROVIDER_TOKEN_ENCRYPTION_KEY: 'fixture-encryption', GOOGLE_DRIVE_CLIENT_ID: 'fixture-id',
    GOOGLE_DRIVE_CLIENT_SECRET: 'fixture-secret', CONNECTED_APPS_WRITES_ENABLED: 'TRUE' };
  const summary = connectedAppConfiguration(env);
  assert.equal(summary.disabledReasons.google_drive, null);
  assert.equal(summary.disabledReasons.gmail, 'client_id_missing');
  assert.equal(summary.flags.CONNECTED_APPS_WRITES_ENABLED.valid, false);
  assert.equal(summary.flags.CONNECTED_APPS_WRITES_ENABLED.enabled, false);
  assert.ok(!JSON.stringify(summary).includes('fixture-'));
  assert.equal(connectedAppConfiguration({ ...env, CONNECTED_APPS_WRITES_ENABLED: 'true',
    CONNECTED_APPS_WOOCOMMERCE_ENABLED: 'true' }).disabledReasons.woocommerce, null);
});
