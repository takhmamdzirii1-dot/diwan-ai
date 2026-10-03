# Chat reload recovery — Phase A

Ordinary Studio Chat sends a conversation ID, the stable user-message ID and a fresh operation ID.
The authenticated server atomically saves the user message and a streaming assistant placeholder
before retrieval/model dispatch. Duplicate operations cannot attach another consumer or overwrite a reply.

The existing customer-safe stream has an independent consumer registered with Next.js `after()`.
It checkpoints text roughly every two seconds (serialized, no accumulating write backlog) and saves
validated artifacts, source metadata and final text. It does not persist raw reasoning/tool arguments.
Completion requires the existing successful execution and weighted-usage settlement; failure leaves
an interrupted message. No finance RPC, provider route, retry policy or model invocation is added.

Reload resumes this tab's owned conversation. Fresh entry still starts a fresh chat. History selection
fetches owned server records, retaining legacy browser-only Agent/deterministic artifact turns.
Recovered streaming replies are refreshed by the **client** every four seconds. Three minutes without
a checkpoint becomes interrupted on the next owned read, with Regenerate using the current model and
a fresh operation ID. Existing Agent API calls retain their cancellation/persistence behavior.

Stop is an explicit authenticated operation, persisted on the reply row. Same-process abort is immediate;
another instance observes it at the next checkpoint. Reload/navigation disconnect does not imply Stop.
Cancelled or terminal rows cannot be overwritten by late checkpoints. Deletion requests cancel active
replies before deleting the owned conversation.

## Deployment prerequisite / limits

- Apply `supabase/migrations/20261003010000_chat_reload_recovery.sql` before deploying this code.
  It only adds owner-readable, server-written Chat tables and one service-role RPC; no financial changes.
  Applied to the linked production database with explicit authorization on 2026-10-03;
  only this SQL file was executed (no `supabase db push`).
- The existing 60-second function duration remains unchanged. `after()` is not a durable worker and
  cannot survive platform termination. A hard kill may leave a partial/interrupted reply; this phase
  does not claim to repair abandoned financial reservations.
- No cron, server-side polling, queue, extra AI call or automatic generation retry.
- Older browser history is not uploaded automatically. Browser-only Agent outputs and attachment
  resources continue using their existing storage; this phase does not migrate those resources.
- DB/RLS execution and authenticated reload need verification after the migration is applied in an
  authorized test environment; fixture tests do not establish a live database pass.
