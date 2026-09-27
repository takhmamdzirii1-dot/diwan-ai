import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page, TestInfo } from '@playwright/test';
import * as XLSX from 'xlsx';

const csvPath = fileURLToPath(new URL('./fixtures/products.csv', import.meta.url));

/** The committed fixture is readable CSV; the browser receives an actual XLSX upload. */
export function productsXlsx() {
  const lines = readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
  const rows = lines.map((line, row) => line.split(',').map((value, column) =>
    row > 0 && column > 0 ? Number(value) : value));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Products');
  return { name: 'Products.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(XLSX.write(book, { bookType: 'xlsx', type: 'buffer' })) };
}

type SafeBrowserError = { kind: 'console_error' | 'page_error'; source?: 'first_party' | 'third_party' | 'unknown' };
const browserErrors = new WeakMap<Page, SafeBrowserError[]>();

/** Store only error categories and source class; never console text, URLs, prompts, or headers. */
export function trackSafeBrowserErrors(page: Page) {
  const errors: SafeBrowserError[] = [];
  browserErrors.set(page, errors);
  page.on('console', (entry) => {
    if (entry.type() !== 'error') return;
    let source: SafeBrowserError['source'] = 'unknown';
    try { source = new URL(entry.location().url).origin === new URL(page.url()).origin
      ? 'first_party' : 'third_party'; } catch { /* no source URL */ }
    errors.push({ kind: 'console_error', source });
  });
  page.on('pageerror', () => errors.push({ kind: 'page_error' }));
}

export async function attachSafeBrowserErrors(page: Page, testInfo: TestInfo) {
  if (testInfo.status === testInfo.expectedStatus) return;
  await testInfo.attach('console-errors.json', {
    body: Buffer.from(JSON.stringify(browserErrors.get(page) ?? [], null, 2)),
    contentType: 'application/json',
  });
}
