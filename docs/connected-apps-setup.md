# Connected Apps setup

Google Drive is the first real adapter. The previous Example Files adapter remains a labeled, opt-in fixture, not a real connection. No schema migration is required: reuse `connected_app_connections` and the existing server-only encryption helper.

## One setup checklist

1. In [Google Cloud](https://console.cloud.google.com/apis/library/drive.googleapis.com), enable Google Drive API. In [Google Auth Platform](https://console.cloud.google.com/auth/clients), create a **Web application** OAuth client. Configure branding/audience and add the authorized QA account as a test user while the app is in testing.
2. Register exact redirect URIs:
   - Production: `https://joinvantra.com/api/connected-apps/oauth/callback`
   - Local QA on port 3103: `http://localhost:3103/api/connected-apps/oauth/callback`
   - Use a separate local client if appropriate. Preview deployments are deliberately not OAuth callback origins.
3. Request only `openid`, `email`, and `https://www.googleapis.com/auth/drive.readonly`. This read-only scope is needed for existing files referenced by URL. No create/update/delete/message actions are supported. It is a restricted Google scope: complete the [required verification](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) before public launch. A future Picker flow could narrow access to `drive.file`, but is not implemented or claimed here.
4. Enter values privately in the worktree's ignored `.env.local`, and in the project’s Vercel **Settings → Environment Variables** for the intended environment:
   - `GOOGLE_DRIVE_CLIENT_ID`
   - `GOOGLE_DRIVE_CLIENT_SECRET`
   - Local production-style QA only: `CONNECTED_APPS_ORIGIN=http://localhost:3103`. Production defaults to `https://joinvantra.com`; do not set a localhost origin in Vercel Production.
   - `PROVIDER_TOKEN_ENCRYPTION_KEY` — reuse the existing configured key; never rotate it casually. If absent, create a strong random secret in a password manager. Do not use `NEXT_PUBLIC_`, paste secrets in Chat, or commit local env/session files.
5. Restart local code. Open Studio → Settings → Connected apps → Google Drive → Connect. Complete consent yourself. Confirm the displayed Google email matches the account you selected. Then ask Chat to summarize one small QA Google Doc or text/CSV file using its exact `docs.google.com`/`drive.google.com` URL. Disconnect and confirm access is removed. If remote revocation fails, the UI explicitly says only VANTRA access was removed; remove the grant in [Google account permissions](https://myaccount.google.com/connections).

## Supported and bounded

- Google Docs/Sheets/Slides export to text/CSV; plain text, Markdown and CSV download directly. Binary PDFs, images and arbitrary external endpoints are not supported.
- One explicit file per turn. Credentials and connection metadata never enter the model context. At most 120 KB fetched, 30,000 text characters accepted, and 8,000 relevant characters passed to the model. Unclear large-file relevance fails closed.
- Native-tool routes execute `read_connected_file`, then synthesize or create an existing artifact with the same selected model. Routes without verified tool calling use the existing authorized server-read context path.
- Granted scopes and ownership are rechecked when the tool executes. Connecting alone never authorizes background reads or writes. Refresh is lazy; disconnect clears local access before attempting remote revocation. Concurrent refresh cannot resurrect a disconnected grant.
- The registry only enables Google Drive when its client ID, client secret and encryption key are configured. Missing setup must never appear as a successful connection.

Other apps in the original plan (Gmail, GitHub, Slack, Notion, OneDrive) were examples, not existing real adapters. They need explicit app selection and their own verified OAuth/API implementation; do not advertise them as available.
