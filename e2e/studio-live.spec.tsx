import { expect, test, type Page } from '@playwright/test';
import { liveReady } from '../playwright.config';
import { attachSafeBrowserErrors, productsXlsx, trackSafeBrowserErrors } from './support';

test.beforeEach(async ({ page }) => {
  test.skip(!liveReady, 'Requires VANTRA_E2E_LIVE_AI=1, a QA storageState, and an explicit base URL.');
  trackSafeBrowserErrors(page);
  await page.goto('/studio/chat');
  await expect(page.locator('textarea')).toBeVisible();
});
test.afterEach(async ({ page }, info) => attachSafeBrowserErrors(page, info));

async function send(page: Page, message: string) {
  await test.step(`Send ${message.length} character customer request`, async () => {
    await page.locator('textarea').fill(message);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByTestId('chat-message-user').last()).toContainText(message);
  });
}

async function attachProducts(page: Page) {
  await test.step('Attach synthetic spreadsheet', async () => {
    await page.locator('[data-chat-file-input]').setInputFiles(productsXlsx());
    const preview = page.getByRole('dialog', { name: 'Products.xlsx' });
    await expect(preview).toBeVisible();
    await preview.getByRole('button', { name: 'Attach to chat' }).click();
    await expect(page.locator('[data-attachment-display="pending"]')).toContainText('Products.xlsx');
  });
}

async function expectNoFailure(page: Page) {
  await expect(page.getByText('I need the file first.')).toHaveCount(0);
  await expect(page.getByText("I couldn't complete this right now.")).toHaveCount(0);
  await expect(page.getByText(/schemaVersion|as an AI text model|```python/i)).toHaveCount(0);
}

test('@live-ai normal chat and two-turn continuity', async ({ page }) => {
  test.setTimeout(180_000);
  await send(page, 'What is compound interest?');
  await expect(page.getByTestId('chat-message-assistant').last()).not.toBeEmpty();
  await expectNoFailure(page);
  await send(page, 'What was my first message?');
  await expect(page.getByTestId('chat-message-assistant').last()).toContainText('compound interest', { ignoreCase: true });
  await expect(page.getByTestId('chat-message-user').first()).toContainText('What is compound interest?');
  await page.getByRole('button', { name: 'New Chat' }).click();
  await page.getByText('What is compound interest?', { exact: true }).first().click();
  await expect(page.getByTestId('chat-message-user').first()).toContainText('What is compound interest?');
  await expectNoFailure(page);
});

test('@live-ai attached spreadsheet creates a six-slide presentation', async ({ page }) => {
  test.setTimeout(180_000);
  await attachProducts(page);
  await send(page, 'Create a 6-slide presentation from this spreadsheet.');
  const presentation = page.getByTestId('artifact-presentation').last();
  await expect(presentation).toBeVisible();
  await expect(presentation).toContainText('6 slides');
  await expect(presentation.getByRole('button', { name: 'Download PPTX' })).toBeVisible();
  await expect(presentation.getByRole('button', { name: 'Retry response' })).toHaveCount(0);
  await expectNoFailure(page);
});

test('@live-ai agent produces two charts and a six-slide presentation', async ({ page }) => {
  test.setTimeout(240_000);
  await attachProducts(page);
  await send(page, 'Create two charts and build a 6-slide presentation from this spreadsheet.');
  await expect(page.getByText('Working on your task')).toBeVisible();
  await expect(page.getByTestId('artifact-chart')).toHaveCount(2);
  await expect(page.getByTestId('artifact-presentation')).toHaveCount(1);
  await expect(page.getByTestId('artifact-presentation')).toContainText('6 slides');
  await expectNoFailure(page);
});

test('@live-ai report exposes document preview and export actions', async ({ page }) => {
  test.setTimeout(180_000);
  await send(page, 'Write a professional report about AI adoption in small businesses.');
  const document = page.getByTestId('artifact-document').last();
  await expect(document).toBeVisible();
  await expect(document.getByRole('button', { name: /Copy/i })).toBeVisible();
  await expect(document.getByRole('button', { name: /Open|Preview|Export/i }).first()).toBeVisible();
  await document.getByRole('button', { name: /Open|Preview|Export/i }).first().click();
  await expect(page.getByRole('button', { name: /Print|PDF/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Word|DOCX/i }).first()).toBeVisible();
  await expectNoFailure(page);
});

test('@live-ai French and Arabic chart intent; chart question remains text', async ({ page }) => {
  test.setTimeout(240_000);
  await attachProducts(page);
  await send(page, 'crée-moi un graphique depuis ce fichier');
  await expect(page.getByTestId('artifact-chart')).toHaveCount(1);
  await send(page, 'اعمل لي مخطط من هذا الملف');
  await expect(page.getByTestId('artifact-chart')).toHaveCount(2);
  await send(page, 'What is a chart?');
  await expect(page.getByTestId('chat-message-assistant').last()).not.toBeEmpty();
  await expect(page.getByTestId('artifact-chart')).toHaveCount(2);
  await expectNoFailure(page);
});
