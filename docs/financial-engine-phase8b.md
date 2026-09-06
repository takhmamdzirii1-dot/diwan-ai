# VANTRA Phase 8B financial boundary

`public.credits.balance` is the sole canonical available-credit authority.

The Phase 8B reservation, ledger, usage, provider-cost, dispatch, attempt, and
webhook structures are intentionally inactive. No generation route calls the
new financial RPCs yet, and the production pricing registry is deliberately
empty. Only trusted VANTRA server code may eventually call
`reserve_credits`, `settle_credits`, and `release_credits`.

## Legacy Chat boundary

The existing Chat billing path is **LEGACY / NOT FINANCIALLY AUTHORITATIVE**.
It still references historical RPC/table names and synthetic fallback values.
Phase 8B does not modify the Chat API, streaming behavior, or UI and must not be
connected to Chat until a separate migration removes the fallback path and the
new engine has passed production-readiness review. Connecting both paths would
create a double-charge risk.

## Demo boundary

Studio Image and Video Demo mode remains local-only and nonbillable. Demo
operations must never create reservations, transactions, usage records, or
provider-cost records.

## Activation prerequisites

- Verified provider pricing and VANTRA credit economics.
- Server-only integration using service credentials.
- Provider dispatch/reconciliation workers.
- Operational handling for reservation expiry and ambiguous provider outcomes.
- A separate, explicitly tested Chat billing migration.
