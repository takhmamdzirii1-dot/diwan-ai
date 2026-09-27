import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const liveRequested = process.env.VANTRA_E2E_LIVE_AI === '1';
const storageState = process.env.VANTRA_E2E_STORAGE_STATE;
const liveBaseURL = process.env.VANTRA_E2E_BASE_URL;
export const authReady = Boolean(storageState && existsSync(storageState));
export const liveReady = liveRequested && Boolean(liveBaseURL) && authReady;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.tsx',
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    channel: process.env.VANTRA_E2E_BROWSER_CHANNEL || 'chrome',
    baseURL: liveBaseURL || 'http://127.0.0.1:3100',
    storageState: authReady ? storageState : undefined,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  webServer: liveBaseURL ? undefined : {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
