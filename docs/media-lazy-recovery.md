# Media reload recovery

## Flow and authority

- Images still call MAI synchronously. Videos reserve once, submit Pruna once, persist the prediction ID, and return an execution ID (`202`). No server-side prediction polling loop.
- The owned status endpoint reads Pruna once when due. A server lease serializes observers. It saves the usable result through existing B2/Library persistence before the atomic settlement wrapper calls the existing credit and model-trial finalizers.
- Failed/canceled outcomes release reservations and trial/included-video usage. A save failure is recoverable through the prediction ID; at expiry it releases the customer hold and records `our_loss` rather than charging for an undelivered result.
- Browser status polling starts at 5 seconds, backs off, and pauses while hidden. Aborting an observer does not cancel provider work. Studio entry reconciles an oldest bounded batch; recovered results are available in Library.
- Active media counts for its full 30-minute lifetime. Running/unknown predictions expire after 30 minutes; missing prediction IDs after 15 minutes. Images have no recoverable asynchronous provider status API.
- Status 429 retries are later browser/scheduler reads, not in-function loops; Retry-After is honored up to the 30-minute recovery horizon. Submit 429 shows busy and never automatically resubmits.
- Before submit, the UI refreshes the server quote and allowance. A changed catalog price must be reviewed before another submit. POST reserve/validation remains authoritative.

## Additive SQL and permissions

Apply only `supabase/migrations/20261003020000_media_lazy_recovery.sql` to the linked project, not all pending migrations. Four nullable recovery columns on `ai_executions`, an active-media trigger, an accepted-prediction hold-expiry trigger, and three service-only RPCs; no table drops, balance resets, payment changes, or new ledger. Recorded video predictions extend only reserved credit/model-trial holds to the fixed 30-minute execution deadline, not on every heartbeat. Success requires a server-written durable-save marker and an owned completed Library record. Row locks and the existing finalizers provide exact-once financial effects.

Applied to the linked production database on 2026-10-03 with explicit authorization, using this exact file only (no `supabase db push`). Columns, triggers and service-only RPC grants were checked after application. No account balances were reset or financial-history rows migrated.

## Optional external scheduler

No cron is required. To enable external reconciliation, privately set `MEDIA_RECONCILE_SECRET` (at least 32 random characters) in Vercel Production and locally if needed. The external scheduler sends `POST /api/generate/media/reconcile` with `Authorization: Bearer <secret>`. Never put this secret in the browser, logs, Git, or a query string. Missing/incorrect secret returns 401. Each request handles at most four oldest active executions, without server polling loops.

## Limits

Lazy recovery requires a later Studio/status request or optional scheduler request; nothing guarantees work runs at an exact deadline without traffic. Vercel termination after provider acceptance but before the ID is recorded remains an unavoidable non-transactional window; missing-ID holds expire without charging. A killed synchronous Image function cannot recover unrecorded image bytes. Provider cost is recorded only when the existing configured cost source knows it, never inferred from customer credits. Automated fixtures do not prove live provider/B2 delivery or production financial concurrency.

## Task file manifest

Phase A (commit `8c448242`):
- `app/api/chat/history/route.ts`, `app/api/generate/chat/route.ts`
- `lib/chat/chat-cancellation.server.ts`, `durable-history.server.ts`, `durable-history.server.test.ts`, `durable-history.ts`, `durable-history.test.tsx`, `durable-stream.ts`, `durable-stream.test.ts`, `message-history.ts`
- `src/components/studio/MessageBubble.tsx`, `StudioDashboard.tsx` (Chat hunks), `useChatRecovery.ts`
- `docs/chat-reload-recovery.md`, `supabase/migrations/20261003010000_chat_reload_recovery.sql`

Phase B:
- `app/api/generate/image/route.ts`, `video/route.ts`, `media/status/route.ts`, `media/quote/route.ts`, `media/reconcile/route.ts`
- `lib/ai/media-api.server.ts`, `media-recovery.server.ts`, `media-recovery.ts`, `media-recovery.test.ts`, `providers/media.ts`, `providers/media.test.ts`
- `lib/admin/data.ts`, `reconciliation-flags.ts`, `reconciliation-flags.test.ts`
- `src/components/studio/MediaRecoveryNotice.tsx`, `media-recovery-client.ts`, `StudioDashboard.tsx` (recovery/quote hunks), `ImageCanvas.tsx`, `PrunaMotionStudio.tsx` (failure-copy hunks only)
- `docs/media-lazy-recovery.md`, `supabase/migrations/20261003020000_media_lazy_recovery.sql`

Unrelated media UI, package, Admin and Graphify changes are excluded.
