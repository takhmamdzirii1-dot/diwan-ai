# AGENTS.md — VANTRA

Rules for every agent/contributor working on VANTRA.

## Project

- Next.js 16 App Router, TypeScript, Tailwind CSS 4
- Supabase = current Auth + Database authority
- Vercel = hosting/deployment
- Cloudflare = DNS
- Canonical domain: https://joinvantra.com
- EN / FR / AR, Arabic RTL
- Dark monochrome VANTRA design, no light mode

Two contributors work from separate computers.
GitHub `origin/main` is the shared source of truth.
Never assume the local checkout contains the other contributor's latest work.

## 1. Start every task safely

First read this `AGENTS.md`.

Then run:

```bash
git status
git fetch origin
```

If the working tree is clean:

```bash
git pull --ff-only origin main
```

If there are uncommitted local changes:
- do not stash automatically;
- do not discard/reset them;
- inspect and report them first.

Never use `git push --force` or `git reset --hard` unless the user explicitly authorizes it.

## 2. Graphify first

After Git sync, use Graphify before broadly reading project files:

```bash
graphify query "<what am I looking for>"
graphify affected "<file/component>"
graphify explain "<name>"
```

Use Graphify to locate relevant code and dependencies.
Read full files only when Graphify lacks enough detail.

If pulled commits may have made the graph stale, run:

```bash
graphify update .
```

After completing code changes, refresh Graphify once:

```bash
graphify update .
```

Do not repeat the same update unnecessarily if a confirmed hook already refreshed the final code state.

Goal: keep project context current and reduce unnecessary file reads/token usage.

## 3. Scope and architecture safety

Only modify files required by the current task.

Do not:
- perform unrelated refactors;
- rename/reformat unrelated files;
- delete unfamiliar work from the other contributor;
- change architecture unless required by the task.

Preserve these foundations unless explicitly asked:
- stable Supabase user IDs are the identity anchor;
- credits/financial state are server-authoritative;
- Demo Image/Video must never consume real credits;
- unknown pricing fails closed;
- real billing follows reserve → settle/release;
- secrets and provider credentials stay server-side;
- normal users may choose models but should not see provider infrastructure;
- existing Chat streaming must not be broken casually.

Never expose service-role keys, provider keys, webhook secrets, DB passwords, encryption keys, or admin credentials.

## 4. UI rules

Preserve VANTRA's current design:
- dark monochrome;
- premium Linear/Vercel-style;
- no light mode, particles, neon clutter, or unnecessary redesigns;
- reuse existing components/tokens;
- normal motion should generally stay under 300ms;
- avoid `transition: all`;
- preserve EN/FR/AR and RTL;
- keep keyboard/focus/accessibility behavior.

Do not redesign the homepage or shared navigation unless explicitly requested.

## 5. Verify before commit

Use verification appropriate to the task.

For significant code changes, normally run:

```bash
npm run lint
npm run build
```

For UI work, verify affected desktop/mobile/RTL behavior.
For backend/database/API work, use relevant tests, logs, SQL/API checks instead of forcing screenshot-based proof.

Do not claim success if verification failed.

## 6. Commit only task work

Before staging:

```bash
git status
git diff
```

Never blindly use `git add .`.

Stage only files belonging to the current task, then inspect:

```bash
git add <task-files>
git diff --cached
```

Commit with a clear message:

```bash
git commit -m "clear task description"
```

Never include unrelated edits, temporary files, accidental secrets, or another contributor's unfinished work.

## 7. Check GitHub again before every push

The other contributor may have pushed while you were working.

Run:

```bash
git fetch origin
```

If `origin/main` changed:
- inspect incoming commits;
- reconcile safely;
- rerun relevant verification;
- never overwrite them.

For unpublished local commits, `git rebase origin/main` may be used only after understanding incoming changes.

If conflicts occur:
- never choose by timestamp;
- never blindly choose ours/theirs;
- preserve both when compatible;
- if intent genuinely conflicts or is unclear, STOP and report it.

Never force-push over another contributor.

## 8. Push and deploy

After successful verification and synchronization:

```bash
git push origin main
```

Vercel Git Integration is the normal production deployment path:

```text
push origin/main
→ Vercel auto-deploy
→ verify affected production functionality
```

Do not normally run `vercel deploy --prod`, because it can duplicate the Git-triggered deployment.

Current pre-launch policy: production deploy after a successful `main` push is automatic and does not require separate approval.

Verify affected functionality at:
https://joinvantra.com

## 9. Completion report

Report briefly:
- what changed;
- files changed;
- verification result;
- commit hash;
- push status;
- production deploy status;
- Graphify refresh status;
- unresolved warnings/risks.

Never claim push/deploy succeeded if it did not.

## 10. Public/legal safety

Do not publish internal project IDs, private endpoints, API keys, DB internals, service-role details, provider secrets, or security configuration.

Do not claim VANTRA is a registered company unless that becomes factually true.

## 11. LLM Council

Never run Council silently.
Recommend it only for genuinely high-impact decisions such as pricing, credits/margins, provider strategy, major architecture/security/database changes, or major product pivots.
Explicit user approval is required before running it.

## Golden workflow

```text
read AGENTS.md
→ git status
→ git fetch
→ git pull --ff-only
→ Graphify query/affected/explain
→ scoped edits
→ verify
→ graphify update .
→ git diff
→ stage task files only
→ commit
→ git fetch again
→ reconcile upstream if needed
→ push main
→ Vercel auto-deploy
→ verify production
→ report
```

Protect existing work. Never trade safety for speed.
