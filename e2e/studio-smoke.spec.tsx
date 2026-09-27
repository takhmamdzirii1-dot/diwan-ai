import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';
import { authReady } from '../playwright.config';
import { attachSafeBrowserErrors, productsXlsx, trackSafeBrowserErrors } from './support';

const fixtureMarkup = JSON.parse(execFileSync(process.execPath,
  ['--import', 'tsx', 'e2e/render-fixtures.tsx'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) as {
    bubble: string; pending: string; sent: string; file: string;
  };

test.beforeEach(async ({ page }) => trackSafeBrowserErrors(page));
test.afterEach(async ({ page }, info) => attachSafeBrowserErrors(page, info));

test('@smoke browser lays out English and Arabic bubbles with compact timestamps', async ({ page }) => {
  await page.goto('/en', { waitUntil: 'networkidle' });
  await page.evaluate((html) => { document.body.insertAdjacentHTML('beforeend', `<div id="e2e-fixture">${html}</div>`); }, fixtureMarkup.bubble);
  const english = page.getByTestId('chat-message-user').nth(0);
  const arabic = page.getByTestId('chat-message-user').nth(1);
  const enBubble = english.locator('div.ms-auto').first();
  const arBubble = arabic.locator('div.ms-auto').first();
  const enBox = await enBubble.boundingBox();
  const arBox = await arBubble.boundingBox();
  expect(enBox).not.toBeNull();
  expect(arBox).not.toBeNull();
  expect(Math.abs((enBox!.x + enBox!.width) - (arBox!.x + arBox!.width))).toBeLessThan(2);
  expect(enBox!.height).toBeLessThan(72);
  expect(arBox!.height).toBeLessThan(72);
  await expect(english.locator('p')).toHaveAttribute('dir', 'ltr');
  await expect(arabic.locator('p')).toHaveAttribute('dir', 'rtl');
  await expect(arabic.locator('p')).toContainText('1992 USD');
  for (const message of [english, arabic]) {
    const gap = await message.locator('time').evaluate((time) => time.getBoundingClientRect().top
      - time.previousElementSibling!.getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(3);
    expect(gap).toBeLessThanOrEqual(7);
  }
});

test('@smoke browser shows pending file once, then keeps a sent file outside the clean composer', async ({ page }) => {
  await page.goto('/en', { waitUntil: 'networkidle' });
  await page.evaluate((html) => { document.body.insertAdjacentHTML('beforeend', `<div id="e2e-fixture">${html}</div>`); }, fixtureMarkup.pending);
  await expect(page.locator('[data-attachment-display="pending"]')).toBeVisible();
  await expect(page.locator('[data-attachment-display="context"]')).toHaveCount(0);

  await page.evaluate((html) => { document.querySelector('#e2e-fixture')!.innerHTML = html; }, fixtureMarkup.sent);
  await expect(page.locator('[data-attachment-display="pending"]')).toHaveCount(0);
  await expect(page.locator('[data-sent-attachments]')).toContainText('Products.xlsx');
  await expect(page.locator('[data-attachment-display="context"] summary')).toHaveText('Files (1)');
  await expect(page.locator('[data-composer-surface]')).not.toContainText('Products.xlsx');
});

test('@smoke browser accepts the tiny deterministic XLSX fixture', async ({ page }) => {
  const workbook = productsXlsx();
  expect(workbook.buffer.byteLength).toBeLessThan(20_000);
  await page.setContent('<input aria-label="Workbook fixture" type="file">');
  await page.getByLabel('Workbook fixture').setInputFiles(workbook);
  const selected = await page.getByLabel('Workbook fixture').evaluate((input) => {
    const file = (input as HTMLInputElement).files?.[0];
    return { name: file?.name, size: file?.size, type: file?.type };
  });
  expect(selected).toEqual({ name: 'Products.xlsx', size: workbook.buffer.byteLength, type: workbook.mimeType });
});

test('@smoke generated text file renders a download action without raw tool JSON or generic retry', async ({ page }) => {
  await page.goto('/en', { waitUntil: 'networkidle' });
  await page.evaluate((html) => { document.body.insertAdjacentHTML('beforeend', `<div id="e2e-fixture">${html}</div>`); }, fixtureMarkup.file);
  const result = page.locator('#e2e-fixture');
  await expect(result.getByRole('button', { name: 'Answer.txt' })).toBeVisible();
  await expect(result.locator('time')).toBeVisible();
  await expect(result).not.toContainText('schemaVersion');
  await expect(result.getByRole('button', { name: 'Retry response' })).toHaveCount(0);
});

test('@smoke authenticated local file, chart, refresh, and conversation isolation', async ({ page, context }) => {
  test.skip(!authReady, 'A legitimate QA Playwright storageState is required for authenticated Studio checks.');
  await context.addCookies([{ name: 'vantra_locale', value: 'en', url: new URL(test.info().project.use.baseURL!).origin }]);
  await page.goto('/studio/chat');
  await expect(page.locator('[data-chat-file-input]')).toBeAttached();
  await page.locator('[data-chat-file-input]').setInputFiles(productsXlsx());
  const preview = page.getByRole('dialog', { name: 'Products.xlsx' });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Product');
  await preview.getByRole('button', { name: 'Attach to chat' }).click();
  await expect(page.locator('[data-attachment-display="pending"]')).toContainText('Products.xlsx');
  await page.locator('textarea').fill('Create another chart from the spreadsheet');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByTestId('artifact-chart').first()).toBeVisible();
  await expect(page.getByTestId('artifact-chart').first().getByRole('button', { name: 'Download PNG' })).toBeVisible();
  await expect(page.getByTestId('chat-message-user').last().locator('[data-sent-attachments]')).toContainText('Products.xlsx');
  await expect(page.locator('[data-attachment-display="pending"]')).toHaveCount(0);
  await expect(page.getByText('I need the file first.')).toHaveCount(0);
  await expect(page.getByText(/Python|schemaVersion|\{"tool"/i)).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-attachment-display="pending"]')).toHaveCount(0);
  await expect(page.getByTestId('chat-message-user').last().locator('[data-sent-attachments]')).toContainText('Products.xlsx');
  await expect(page.locator('[data-attachment-display="context"] summary')).toHaveText('Files (1)');
  await page.locator('textarea').fill('Create another chart from the spreadsheet');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByTestId('artifact-chart')).toHaveCount(2);
  await page.getByRole('button', { name: 'New Chat' }).click();
  await expect(page.locator('[data-attachment-display="context"]')).toHaveCount(0);
});
