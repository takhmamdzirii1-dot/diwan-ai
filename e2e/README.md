# Studio E2E smoke suite

The default `npm run test:e2e` runs `@smoke` checks only. These include browser layout and fixture checks. Authenticated Studio checks run only when a legitimate QA browser session is provided. They use deterministic local chart generation and make no paid AI request.

Set `VANTRA_E2E_STORAGE_STATE` to an existing Playwright storage state file for a QA account. Keep it outside Git, preferably under the ignored `.playwright/` directory. Never commit credentials, cookies, tokens, or production customer files. Set `VANTRA_E2E_BASE_URL` to the approved QA deployment if testing outside local development.

Live model checks require **all three**: `VANTRA_E2E_LIVE_AI=1`, `VANTRA_E2E_STORAGE_STATE`, and `VANTRA_E2E_BASE_URL`. Run `npm run test:e2e:live` only when intentional provider spend is acceptable. No test creates a user or bypasses authentication.

The committed `fixtures/products.csv` is synthetic. Tests convert it to a small XLSX upload in memory using the app's existing `xlsx` dependency. Failed tests retain a screenshot and Playwright trace. `console-errors.json` records error categories only; it excludes console text, URLs, request data, and auth material. Video is disabled.

The runner uses the installed Chrome channel by default. Set `VANTRA_E2E_BROWSER_CHANNEL` to another installed Playwright supported channel if needed.
