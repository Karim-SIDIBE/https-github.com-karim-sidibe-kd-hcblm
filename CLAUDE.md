# KD-HCBLM v2.0 — repository guide

Kompetences Declick learning platform. Two parts:

- **`project/`** — design source: the handoff spec, the real Niveau 1 course
  (`project/course_extracted.md`) and the learner-UI prototype.
- **`server/`** — the production backend (most work happens here). See
  **`server/README.md`** for the full architecture, API and status.
- **`web/`** — the offline-first learner **PWA** (Vite · React · TypeScript)
  consuming the API. See **`web/README.md`**.

## The one non-negotiable: the content model is the contract

Everything orbits a single Zod definition of a course —
`server/src/domain/content-model.ts` (Course → 5 fixed blocks → micro-sessions,
quizzes, rubric, journal). It is the contract shared by the authoring form, the
publish-time validation gate, the runtime engine and the learner renderer.

`server/src/domain/validation.ts` is the **publish gate**: shape (Zod) + policy
(exactly 5 ordered blocks, the `{{moment_ancrage}}` token re-injected at the
mandated touchpoints, rubric weights = 100, thresholds matching the level,
badge conditions). Nothing publishes unless it passes. The J+7 re-engagement PAM
reuse is enforced at the engine layer (`engine/reengagement.day7AnchorsPam`),
not the content validator.

Keep these invariants intact when changing anything.

## Working in `server/`

```bash
cd server
bash scripts/dev-db.sh start    # local Postgres 16 (see env vars in the script)
npm install
npm run prisma:migrate          # apply migrations
npm run db:seed                 # publish + index the canonical course, seed users
npm run dev                     # http://localhost:4000  (prefix /api/v1)
npm test                        # node --test unit suite (pure domain + AI fallbacks)
npm run typecheck               # tsc --noEmit
npm run keygen                  # generate ES256 JWT signing keys
```

In this sandbox Postgres runs as a separate `pgrunner` user; start it with:
`PGDATA=/home/claude/pgdata PGSOCK=/home/claude/pgsock PGRUNAS=pgrunner bash server/scripts/dev-db.sh start`

## Conventions

- **Stack**: Node 22 · TypeScript (ESM, `.js` import specifiers) · Fastify ·
  Prisma · PostgreSQL · Zod. Tests: `node:test` + `node:assert/strict`.
- **Layout**: `domain/` = pure logic (no I/O); `lib/` = cross-cutting (auth, ai,
  notify, lrs, audit); `modules/<name>/` = `*.service.ts` (logic + DB) +
  `*.routes.ts` (HTTP). Register routes in `src/app.ts`.
- **AI is pluggable with graceful fallback** (`src/lib/ai/*`): a real provider
  (Claude / Voyage / OpenAI) when a key is set, else a deterministic offline
  fallback — so everything runs and tests without network/keys.
- **Auth**: `authenticate` resolves a principal from a Bearer JWT (first-party
  ES256 or external OIDC); `authorize(...perms)` + ownership guards enforce RBAC
  (`src/domain/auth/permissions.ts`). A dev-only `x-user-id` header works outside
  production. Don't add business logic to routes — keep it in services.
- **After a schema change**: `npm run prisma:migrate` (non-interactive: avoid
  adding `@unique` to a populated column in one step). Re-seed if the canonical
  content shape changed.
- **Verify changes by running them** (the project values this): boot the server
  and exercise the real HTTP surface, or add a `node:test`. Clean up test data.

## Status

Backend is feature-complete through: auth (JWT/OIDC) → RBAC + ownership →
authoring with review workflow → validated canonical content → runtime engine
(gating, PAM injection, badges) → learner experience (auto-resume, J+3/7/14
re-engagement, xAPI) → delivery (notifications, LRS) → AI assistant (formative
feedback, rubric suggestion, semantic search, course drafting) → hardening
(key rotation, rate-limit + lockout, audit log). 30 unit tests green.
