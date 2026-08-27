<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Graphify Protocol (MANDATORY — never skip)

Before reading ANY project files, query the Graphify graph first and prefer its scoped answers:

- Locate code: `graphify query "<what am I looking for>"` (run from project root)
- Impact check before edits: `graphify affected "<file/component>"`
- Explain a component: `graphify explain "<name>"`
- After finishing edits, refresh the graph: `graphify update .`

Read full files ONLY when the graph lacks the detail. This saves tokens and speeds up every session.

# Work Protocol (from SELF_RULES.md)

1. Never claim "done" without proof: screenshot + computed-style numbers from the live page.
2. Run `npm run lint` and `npm run build` before any deploy.
3. Follow installed skills (emil-design-eng values, improve-animations audit values) — never invent motion values.
