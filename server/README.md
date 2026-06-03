# KD-HCBLM v2.0 — Backend (`server/`)

Production engine behind the Declick learner experience. Stack: **Node 22 ·
TypeScript · Fastify · Prisma · PostgreSQL 16 · Zod**.

## Architecture (two faces)

- **Authoring** — a `Course` has versioned `CourseVersion`s. Each version stores
  the full authored content as a **JSONB document** whose shape is the Zod
  *content model* (`src/domain/content-model.ts`). That model is the single
  contract shared by the authoring form, the publish-time validation engine and
  (later) the learner renderer.
- **Runtime** — learners enrol in a published version; progress / badges /
  submissions are relational (stubbed in this step, built out next).

## Key modules

| Path | Role |
|---|---|
| `src/domain/content-model.ts` | The course content contract (Zod) — Course → 5 Blocks → MicroSessions, quizzes, rubric, journal. |
| `src/domain/validation.ts` | The **non-negotiable publish gate**: shape (Zod) + policy (5 blocks, PAM token at the 4 touchpoints, rubric = 100, thresholds match level, badge conditions). |
| `src/domain/engine/injection.ts` | Moment d'Ancrage re-injection (`{{moment_ancrage}}` substitution) at render time. |
| `src/domain/engine/progress.ts` | Block gating + completion engine — requirements derived from content, sequential unlock, quiz scoring. |
| `src/domain/engine/badges.ts` | Badge type per block + PAM-anchored messages + peer notification text. |
| `src/domain/engine/resume.ts` | Auto-resume target (saved position or next incomplete item). |
| `src/domain/engine/reengagement.ts` | J+3/J+7/J+14 inactivity messages (J+7 anchored in the PAM). |
| `src/domain/engine/xapi.ts` | xAPI statement builders (ADL + OpenBadges vocabularies). |
| `src/modules/jobs/*` | Scheduled jobs (re-engagement scan). |
| `src/domain/auth/permissions.ts` | RBAC matrix — roles → permissions (pure). |
| `src/lib/auth.ts` | `authenticate` (Bearer JWT → principal) + `authorize` + ownership. |
| `src/lib/auth/password.ts` | Argon2id password hashing (OWASP params). |
| `src/lib/auth/keys.ts` · `jwt.ts` · `oidc.ts` | ES256 keys/JWKS, first-party token sign/verify, external OIDC verify. |
| `src/modules/auth/*` | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, JWKS. |
| `src/lib/audit.ts` · `src/modules/audit/*` | Append-only security audit trail + query. |
| `scripts/keygen.ts` | Generate an ES256 signing keypair (`npm run keygen`). |
| `src/lib/ai/client.ts` | Shared Claude client (availability, Messages call, JSON extraction). |
| `src/lib/ai/nudge.ts` | AI adaptive nudges (Claude + prompt caching) with template fallback. |
| `src/lib/ai/feedback.ts` | AI grading assistant — formative feedback + advisory rubric suggestion. |
| `src/lib/ai/embeddings.ts` | Embeddings (Voyage/OpenAI) + deterministic local fallback + cosine. |
| `src/lib/ai/authoring.ts` | AI course drafting — policy-valid scaffold + optional Claude enrichment. |
| `src/modules/feedback/*` | Feedback orchestration (reads submissions, persists `AiAssessment`). |
| `src/modules/search/*` | Semantic search — chunk, embed, index on publish, cosine rank. |
| `src/lib/notify/dispatcher.ts` | Notification delivery (console / webhook / email). |
| `src/lib/lrs/forwarder.ts` | xAPI forwarding to an external LRS. |
| `src/modules/notifications/*` | Enqueue + dispatch outbound notifications. |

## Roles & RBAC

Roles (incl. modern-LMS additions **SUPER_ADMIN**, **REVIEWER**, **INSTRUCTOR**):

| Role | Key capabilities |
|---|---|
| SUPER_ADMIN | everything |
| COURSE_ADMIN | full authoring + publish/archive, user mgmt, jobs, analytics |
| LEARNING_DESIGNER | create / edit drafts, submit for review |
| REVIEWER | review (approve / request changes), publish-on-approve |
| INSTRUCTOR | read courses, enrol learners, read any enrolment, analytics |
| EVALUATOR | grade Bloc 4 rubric, read enrolments/analytics |
| ENTERPRISE_CLIENT / EMPLOYER | read courses + analytics (cohort / certificates) |
| LEARNER | enrol self; act only on own enrolment (ownership-guarded) |

**Authentication (standards-aligned):** the principal comes from a verified
`Authorization: Bearer` JWT — either a **first-party ES256 access token** (issued
by `/auth/login`, short-lived, verifiable via the published **JWKS**) or an
**external IdP token** (OAuth 2.1 / OIDC) verified against the IdP's remote JWKS.
Validation follows the JWT BCP (RFC 8725): fixed `ES256` algorithm allowlist
(no `none`/confusion), strict `iss`/`aud`/`exp` checks, clock-skew leeway.
**Refresh tokens** are opaque, stored only as SHA-256 hashes, **rotated on every
use with reuse detection** (replaying a rotated token revokes the whole family —
RFC 9700). Passwords are hashed with **Argon2id** (OWASP params). A dev-only
`x-user-id` header remains available outside production (`AUTH_DEV_HEADER`).
The authorization layer (permissions + ownership) is unchanged underneath.

**Authoring workflow:** `DRAFT → (submit-review) → IN_REVIEW → (approve) →
PUBLISHED` (or `→ request_changes → DRAFT`). Approving/publishing runs the
non-negotiable gate and supersedes (archives) the previously published version.
Admins may publish directly.
| `src/modules/courses/*` | Authoring API: list / get / create / validate / update-draft / publish. |
| `src/modules/enrollments/*` | **Learner runtime**: enrol, capture PAM, record progress, score quizzes, issue badges, render blocks. |
| `src/modules/users/*` | Minimal user creation / lookup. |
| `src/modules/health/*` | Liveness + DB reachability. |
| `prisma/schema.prisma` | Identity + authoring + runtime data model. |

## API (v1, prefix `/api/v1`)

**Authoring**

| Method | Path | Purpose |
|---|---|---|
| GET | `/courses`, `/courses/:id` | List / get courses |
| POST | `/courses`, `/courses/validate` | Create / validate a content document |
| PUT | `/versions/:versionId` | Save a DRAFT |
| POST | `/versions/:versionId/publish` | Publish — only if policy passes |

**Runtime (learner)**

| Method | Path | Purpose |
|---|---|---|
| POST | `/users` · GET `/users/:id` | Create / get a user |
| POST | `/enrollments` | Enrol a user in the latest published version |
| GET | `/enrollments/:id` | Progress map (block states) + badges |
| POST | `/enrollments/:id/moment-ancrage` | Capture the PAM (min-length enforced) |
| POST | `/enrollments/:id/peer` | Designate the progress peer |
| POST | `/enrollments/:id/items` | Record a generic item completion |
| POST | `/enrollments/:id/quiz/{trigger,diagnostic,final}` | Submit a quiz (scored where applicable) |
| POST | `/enrollments/:id/quiz/interblock` | Submit the non-scored inter-block quiz |
| POST | `/enrollments/:id/evaluation` | Human rubric score (Bloc 4) |
| GET | `/enrollments/:id/blocks/:index` | **PAM-injected** rendered block (403 if locked) |
| GET | `/enrollments/:id/resume` · POST `/position` | Auto-resume target / save exact position |
| GET | `/enrollments/:id/offline-bundle` | **Offline-first**: PAM-injected content + media manifest (ETag/304) |
| POST | `/enrollments/:id/sync` | Replay actions queued offline (idempotent, ordered) |
| GET | `/enrollments/:id/xapi` | xAPI statements for this enrolment |
| POST | `/jobs/re-engagement/run` | Scan inactive learners, emit J+3/J+7/J+14 (accepts `now` for testing) |
| POST | `/jobs/notifications/dispatch` | Deliver PENDING notifications |
| POST | `/jobs/lrs/forward` | Forward stored xAPI statements to the LRS |
| GET | `/enrollments/:id/notifications` | Notifications for this enrolment (owner/staff) |
| POST | `/enrollments/:id/feedback` | AI formative feedback on an open submission (owner) |
| POST | `/enrollments/:id/rubric-suggestion` | AI per-criterion score **suggestion** (evaluator; advisory) |
| GET | `/enrollments/:id/ai-feedback` | Stored AI assessments (owner/staff) |
| POST | `/courses/draft` | AI-assisted draft of a new course from a brief → validated DRAFT |
| POST | `/search` | Semantic search over published content |
| POST | `/versions/:id/index` | (Re)build the search index for a version |
| POST | `/enrollments/:id/tutor/ask` | **Grounded AI tutor** (RAG) — answer from course content + citations |
| GET | `/enrollments/:id/tutor/sessions[/:sid]` | Tutor conversation history |

**Media pipeline** (`media:manage` to upload; low-bandwidth + offline)

| Method | Path | Purpose |
|---|---|---|
| POST | `/media` | Upload (multipart) → adaptive rendition ladder |
| POST | `/media/external` | Register a provider-hosted asset (Mux/Cloudflare/CDN) |
| GET | `/media/:id` · `/media/:id/playback` | Asset / adaptive manifest (lowest-bitrate first + recommended lite + captions) |
| GET | `/media/:id/download?label=` | Range-aware stream/download of a rendition (offline) |

**Blended live sessions** (`session:manage` to host)

| Method | Path | Purpose |
|---|---|---|
| POST | `/sessions` | Create a session (Zoom/Teams meeting or manual link) |
| GET | `/sessions` · `/sessions/:id` | List / detail (`?upcoming=true`, `?courseId=`) |
| POST | `/sessions/:id/register` | Learner registers (self or staff-on-behalf) |
| GET | `/sessions/:id/registrations` | Roster (host) |
| POST | `/sessions/:id/attendance` | Mark attendance → xAPI `attended` for enrolled learners |
| POST | `/sessions/:id/cancel` | Cancel |

**Cohort forums** (members read/post; `forum:moderate` to manage/moderate)

| Method | Path | Purpose |
|---|---|---|
| POST | `/cohorts` · `/cohorts/:id/members` | Create cohort / add member |
| GET | `/cohorts` · `/cohorts/:id/threads` | List cohorts (scoped) / threads |
| POST | `/cohorts/:id/threads` · `/threads/:id/posts` | New thread / reply |
| PATCH/DELETE | `/posts/:id` | Edit / soft-delete (author or moderator) |
| POST | `/threads/:id/flags` | Lock / pin (moderator) |

**Interoperability — content import** (SCORM 1.2/2004, cmi5)

| Method | Path | Purpose |
|---|---|---|
| POST | `/imports` | Upload a SCORM/cmi5 ZIP → parsed + extracted package (`media:manage`) |
| GET | `/imports/:id` | Package metadata |
| POST | `/imports/:id/launch` | Per-learner launch descriptor (SCORM runtime / cmi5 URL) |
| POST | `/imports/:id/tracking` | SCORM RTE commit (cmi data model) |
| GET | `/content/imports/:id/*` | Serve extracted package files (range-aware) |
| GET | `/imports/:id/cmi5-fetch` · POST `/xapi/statements` | cmi5 auth + inbound xAPI LRS |

**Interoperability — content export / migration**

| Method | Path | Purpose |
|---|---|---|
| GET | `/courses/:id/export?format=scorm12\|cmi5\|cc` | Download a portable package (`course:read`) |

**Interoperability — LTI 1.3 Tool** (an LMS launches a K-LMS resource)

| Method | Path | Purpose |
|---|---|---|
| POST/GET | `/lti/platforms` | Register / list platforms (`lti:manage`) |
| GET/POST | `/lti/login` | OIDC third-party login initiation → redirect to platform |
| POST | `/lti/launch` | Validate the platform `id_token` → first-party session |
| GET | `/lti/jwks` · `/lti/config` | Tool keys + configuration |

**Verifiable credentials** (Open Badges 2.0 + 3.0; public verification)

| Method | Path | Purpose |
|---|---|---|
| GET | `/credentials/issuer` · `/credentials/badge-class/...` | Issuer / BadgeClass JSON-LD |
| GET | `/credentials/:id` | OB 2.0 hosted assertion (public; reflects revocation) |
| GET | `/credentials/:id/vc` | OB 3.0 Verifiable Credential, signed VC-JWT (public) |
| GET/POST | `/credentials/:id/verify` · `/credentials/verify` | Verify signature + issuer + revocation (public) |
| GET | `/credentials/:id/certificate.pdf` | Certificate PDF with verification QR |
| GET | `/enrollments/:id/credentials` | Learner's credentials (owner) |
| POST | `/credentials/:id/revoke` | Revoke (`credential:revoke`) |

**Analytics & reporting** (`analytics:read`; transcript is owner-scoped)

| Method | Path | Purpose |
|---|---|---|
| GET | `/enrollments/:id/transcript` | Learner record (progress, scores, badges, credentials, attendance) |
| GET | `/analytics/overview` | Platform KPIs |
| GET | `/analytics/courses/:id` | Course aggregates + block-completion funnel |
| GET | `/analytics/courses/:id/learners` | Per-learner rows (`?format=csv`) |
| GET | `/analytics/cohorts/:id` | Cohort progress (`?format=csv`) |

**SAML 2.0 SSO** (active only when `SAML_*` is configured)

| Method | Path | Purpose |
|---|---|---|
| GET | `/auth/saml/metadata` | SP metadata XML for the IdP |
| GET | `/auth/saml/login` | SP-initiated login → redirect to IdP |
| POST | `/auth/saml/acs` | Assertion Consumer Service → issues first-party tokens |
| GET | `/audit` | Security audit trail — filters `action`/`actorId`/`limit` (admin) |

**Authoring workflow**

| Method | Path | Permission |
|---|---|---|
| POST | `/courses/:id/versions` | `course:create` (new draft revision) |
| POST | `/versions/:id/submit-review` | `course:submit_review` |
| POST | `/versions/:id/review` | `course:review` (`approve` / `request_changes`) |
| POST | `/versions/:id/archive` | `course:archive` |

**Multi-tenancy** (organizations / workspaces; `x-org-id` selects the tenant)

| Method | Path | Purpose |
|---|---|---|
| POST/GET | `/organizations` | Create (`org:manage`) / list (membership-scoped) |
| GET | `/organizations/:id/members` · POST · DELETE | Membership (org OWNER/ADMIN or `org:manage`) |

Courses carry an optional `organizationId` (null = shared catalogue). `GET /courses`
returns the shared catalogue + the caller's org courses; a private course is
hidden (404) from non-members. SUPER_ADMIN is cross-tenant.

**SCIM 2.0** (automatic user provisioning, per organization)

| Method | Path | Purpose |
|---|---|---|
| POST | `/organizations/:id/scim/token` | Provision the org's SCIM bearer token |
| `*` | `/scim/v2/Users[/:id]` | RFC 7644 user provisioning (token-auth) |
| GET | `/scim/v2/ServiceProviderConfig` | Discovery |

**Authentication**

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | email + password → access + refresh tokens |
| POST | `/auth/refresh` | rotate refresh token (reuse-detecting) |
| POST | `/auth/logout` | revoke the refresh-token family |
| GET | `/auth/me` | current principal (any valid Bearer) |
| GET | `/.well-known/jwks.json` | public keys for verifying our access tokens |

All endpoints except `/health*` and `/auth/*` (+ JWKS) require a Bearer token
(or the dev `x-user-id` header outside production).

## Local development

```bash
# 1. Start the local Postgres dev cluster (see scripts/dev-db.sh)
bash scripts/dev-db.sh start

# 2. Install + migrate
npm install
npm run prisma:migrate

# 3. Run
npm run dev          # http://localhost:4000
```

Configuration is read from `.env` (see `.env.example`). `DATABASE_URL` points at
the local cluster on port **5433**.

## Status

### Spec coverage — KD-HCBLM v2.0 technical specification (complete)

Audited against `KDHCBLM_v2_Platform_Technical_Specification.docx`. All
NON-NEGOTIABLE / CRITICAL and REQUIRED backend items are closed and verified
end-to-end against the live server:

- **Auto-resume ±5s** within video (`MediaPosition`, cross-device) — §4.2.
- **Positioning diagnostic** with sub-area breakdown + two weakest priorities — §2.
- **Automated journal triggers** J+1/+3/+5/+7/+10/+14, PAM-injected, activity-independent — §5.1.
- **Per-criterion rubric scoring** (each clamped to weight, weighted total auto-computed) — §6.3.
- **Block 4 lifecycle**: `ProjectSubmission` (submission → evaluator assignment →
  rubric result → feedback → pass/fail → revision status) with the **5-business-day
  SLA admin alert** (`POST /jobs/project-sla/run`) — §6.3 / AC#14.
- **Granular xAPI**: per-question (`answered` — selected/correct/time-on-question/
  feedback-viewed), video-progress (`progressed`), exercise time-on-task — §5.2/§8.1/AC#11.
- **Mobile messaging + push** channels (SMS/WhatsApp/PUSH), peer & learner phone,
  multichannel re-engagement — §7.1/§7.2.
- **Outbound event webhooks** (HMAC-signed: badge / block / project / Day+14 /
  certificate / exercise) with a durable queue (`POST /jobs/webhooks/flush`) — §8.2.
- **LRS query API** (`GET /lrs/statements` by learner/course/date/verb) — §8.1.
- **Completion forecasting** + date-range analytics filters; **raw PAM export** — §7.3/§6.1.
- **SCORM 2004 export** (alongside 1.2 / cmi5 / Common Cartridge) — §8.1.
- **OpenAPI 3.1** doc + Redoc viewer (`/openapi.json`, `/docs`) — §8.3.

- **Step 1 (done)** — Foundations: data model, the content contract, the publish
  gate, and the authoring course API — verified end-to-end against Postgres
  (create → validate → publish, with negative probes on the PAM thread, rubric
  total and shape).
- **Step 2 (done)** — Ingested the **real Niveau 1 course** verbatim from
  `../project/course_extracted.md` into the content model
  (`src/domain/fixtures/n1-full.ts`): 5 blocks, 10 video micro-sessions, 10-Q
  diagnostic + 8-Q final quiz (correct keys match the source corrigés), Nadia
  case, 3 guided scenarios, 6 journal entries, D4 rubric (= 100). Validated
  (shape + policy → publishable) and persisted as the canonical **published**
  course via `npm run db:seed`. Fidelity round-trip confirmed through the API.

### Seed the canonical course

```bash
npm run db:seed   # validates + publishes gestion-du-temps-n1 (idempotent)
```

- **Step 3 (done)** — Runtime engine: enrolment → Moment d'Ancrage capture →
  **PAM injection** at render → sequential **block gating** (Bloc 4 stays locked
  until the final quiz ≥ threshold; field application gates Bloc 3) → quiz
  scoring (diagnostic profile, final-quiz threshold, human rubric) → **badge
  issuance** (PAM-anchored messages, peer notifications, idempotent) →
  enrolment CERTIFIED on course completion. Verified end-to-end with a full
  learner journey (gating, 403-on-locked, PAM substitution, fail-then-pass on the
  final quiz, rubric threshold, badge idempotency).

- **Model-gap resolution (done)** — the two gaps surfaced in Step 2 are closed:
  - `PracticePayload.interBlockQuiz` — optional non-scored consolidation quiz
    (6 real questions in the canonical course); now a gating requirement when
    present (Bloc 2 won't complete without it).
  - `OnboardingPayload.profileChoices` — the Bloc 0 A–D self-identification step,
    moved out of the (misused) `triggerQuiz.profiles`; the engine validates the
    chosen profile key against it.

- **Step 4 (done)** — Learner experience: **auto-resume** (saved position with
  next-incomplete fallback), **re-engagement** jobs (J+3/J+7/J+14 — J+7 anchored
  in the PAM, idempotent per inactivity streak, J+14 → ADMIN channel for
  enterprise enrolments) and **xAPI** statement emission (initialized / completed
  / passed / failed / earned) stored per enrolment. The J+7 PAM reuse now lives
  in the engine, so the content validator publishes the canonical course with
  **0 warnings**. Verified end-to-end (resume transitions, xAPI verb stream,
  J+7 PAM-anchored message, no-duplicate re-runs, J+14 admin signal).

- **Step 5 (done)** — **RBAC** (capability matrix, `authenticate`/`authorize`/
  ownership preHandlers) applied across authoring, runtime, evaluation, user
  management and jobs; added modern-LMS roles (SUPER_ADMIN, REVIEWER,
  INSTRUCTOR); and the **authoring review workflow** (draft → in-review →
  published, with request-changes + auto-archive of the prior published version).
  Verified: 401/403 enforcement per role, full review→publish cycle, evaluator-
  only grading, and enrolment ownership.

- **Step 6 (done)** — **Outbound delivery** layer (`Notification` enqueue →
  dispatch job → console/webhook/email), **xAPI LRS forwarding** (standard
  `POST /statements`, idempotent via `forwarded`), and an **AI adaptive-nudge**
  boost: re-engagement copy is personalized by Claude (PAM + exact progress,
  prompt-cached system prompt) with a deterministic template fallback when no
  key is set. Verified end-to-end against a local webhook+LRS receiver (peer +
  J+7 notifications delivered, 4 xAPI statements forwarded, job idempotency, AI
  request builder + graceful fallback).

- **AI grading assistant (done)** — formative feedback on open submissions
  (field application, journal, project) and an **advisory per-criterion rubric
  suggestion** for the Bloc 4 project, aligned to the D4 grid. **Human-in-the-
  loop by design**: suggestions are stored as `AiAssessment` and never applied —
  certification still requires the evaluator's `/evaluation` call. Pluggable
  (Claude + prompt caching) with a deterministic fallback. Verified: request
  builders, evaluator-only access (learner 403), per-criterion clamping
  (`suggested ≤ max`), and that an AI suggestion does not certify.

- **Gating hardening (done)** — completions and quiz submissions are now
  rejected (`403 block_locked`) when the target block is `locked`, closing the
  out-of-order write gap. Bloc 0 is always reachable; re-takes on a `completed`
  block remain allowed. Verified: out-of-order writes blocked, in-order
  progression and re-takes still work.

- **Step 7 (done)** — **Standards-aligned authentication**: first-party ES256
  JWT access tokens + JWKS endpoint; **Argon2id** passwords; **refresh-token
  rotation with reuse detection** (family revocation); **OAuth 2.1 / OIDC**
  external-IdP verification via remote JWKS; JWT validation per RFC 8725. The
  existing RBAC/ownership layer is unchanged. Verified end-to-end: login, Bearer
  access, JWKS (public-only), rotation, reuse detection + family revoke, RBAC via
  JWT, logout, and an external OIDC token (valid + wrong-audience) against a live
  local IdP.

- **AI boosts (done)** — **Semantic search** over published content (chunk →
  embed → index on publish → cosine ranking; Voyage/OpenAI when keyed, else a
  deterministic local embedder) and **AI-assisted course drafting** from a brief
  that always conforms to the Zod model (policy-valid scaffold backbone, optional
  Claude enrichment, then governed by the same publish gate + review workflow).
  Verified: relevant ranking on the canonical course, RBAC, a generated L2 draft
  (threshold 75, publishable) flowing through review → publish → auto-index →
  searchable.

- **Hardening (done)** — **persistent signing keys with rotation**: ES256 keys
  from PEM env (stable `kid` across restarts; `npm run keygen`), a JWKS that
  publishes current + previous keys so tokens survive a rotation, then full
  retirement of the old key. **Brute-force defences**: `@fastify/rate-limit`
  (global + stricter on `/auth/*`) plus OWASP **account lockout** (N failures →
  temporary lock, `429`). **Audit trail**: append-only `AuditLog` for auth events
  (success/failure/lockout/reuse/logout) and sensitive mutations (publish,
  review, user create, evaluation), queryable at `/audit` (admin-only). Verified
  end-to-end across three key configurations + lockout + rate limit + audit RBAC.

- **Consolidation (done)** — 37 `node:test` unit tests (validation, engine,
  RBAC, embeddings, JWT, scaffold, meetings, SAML mapping), `CLAUDE.md`, and a
  first commit on `feat/kd-hcblm-backend`.
- **Blended, forums & SAML (done)** — **live sessions** (Zoom/Teams provider with
  a manual fallback; registration + attendance → xAPI `attended`); **cohort
  forums** (membership-scoped threads/posts, author edit, moderator lock/pin +
  soft-delete); **SAML 2.0** SP connector (metadata, AuthnRequest redirect, ACS
  → first-party tokens, JIT optional) alongside OIDC. RBAC adds `session:manage`
  and `forum:moderate`.

- **Offline-first (done)** — backend support for low-connectivity contexts:
  a downloadable, **PAM-injected course bundle** + media manifest with **ETag/304**
  caching, and an **idempotent, time-ordered sync API** that replays actions
  queued offline (gating still enforced; replays never double-apply badges or
  notifications). A PWA/mobile client + media pipeline are the front-end half.

- **Media pipeline (done)** — pluggable storage (local FS; S3/R2-ready) + a
  pluggable transcoder (real ffmpeg renditions when present; otherwise the source
  stays playable and the adaptive ladder is recorded as *planned*, fillable by an
  ffmpeg worker or Mux/Cloudflare Stream). Adaptive **playback manifest**
  (lowest-bitrate-first, recommended **lite** variant, captions), **range-aware**
  streaming/download for seeking + offline, external-provider registration, and
  `video.mediaId` binding so the **offline bundle** ships downloadable renditions.

- **Interoperability — import (done)** — **SCORM 1.2/2004 + cmi5** package import
  (unzip → parse manifest → extract to storage → register), per-learner launch
  descriptors, **SCORM RTE tracking** (cmi data model persisted on Commit), and
  **cmi5** launch (endpoint/fetch/registration/actor params) reporting to an
  **inbound xAPI LRS** endpoint.
- **Multi-tenancy (done)** — organizations (tenants) with memberships (OWNER/
  ADMIN/MEMBER). Courses are optionally org-scoped; the catalogue is isolated per
  tenant (shared global content + the caller's org content; private courses
  hidden from non-members), with cross-tenant SUPER_ADMIN. Tenant selected via
  the `x-org-id` header, validated against membership.
- **SCIM 2.0 (done)** — automatic, per-organization user provisioning (RFC
  7643/7644): an IdP authenticates with the org's bearer token and pushes Users
  to `/scim/v2/Users` (create/filter/get/replace/patch/delete); we map them to
  platform users + org memberships, deprovision on `active:false`/DELETE, and
  isolate strictly per tenant. ServiceProviderConfig discovery included.
- **Interoperability — export / migration (done)** — export any published course
  to a standard, portable package: **SCORM 1.2** (universal), **cmi5** (xAPI) or
  **Common Cartridge 1.3** (Canvas/Moodle/Blackboard/D2L). Content is rendered to
  format-agnostic HTML driven by a uniform `window.KLMS` runtime; each packager
  adds the right manifest + runtime. Verified by a **round-trip** (an exported
  SCORM/cmi5 package re-imports into K-LMS) so the output is provably valid.
- **Interoperability — LTI 1.3 Tool (done)** — K-LMS as an LTI 1.3 Tool: platform
  registration, OIDC third-party **login initiation**, and **launch** (the
  platform `id_token` is verified against its JWKS, LTI claims validated, the
  user JIT-mapped and issued a first-party session). Single-use nonce; reuses the
  existing JWKS/JWT stack. (We are the Tool; AGS/NRPS/Deep-Linking are future.)
- **Analytics & reporting (done)** — reporting over the existing runtime data (no
  new tables): learner **transcript**, course **aggregates + block-completion
  funnel**, platform **overview** KPIs, **cohort** progress, with **CSV export**.
  Gated by `analytics:read`; transcripts are owner-scoped.
- **AI tutor / RAG (done)** — a grounded conversational tutor: retrieves the most
  relevant course passages (semantic search), answers with Claude (citations +
  Moment-d'Ancrage personalization) or an extractive fallback offline, persists
  multi-turn sessions, and applies a **lexical grounding guardrail** (off-topic
  questions are declined, not hallucinated). The local embedder also gained
  stopword filtering (better retrieval + reliable guardrail).
- **Verifiable credentials (done)** — on badge issuance the platform mints an
  **Open Badges 2.0** hosted assertion (privacy-preserving salted-hash recipient)
  and an **Open Badges 3.0** Verifiable Credential signed as a **VC-JWT (ES256,
  verifiable via the platform JWKS)**. Public verification (signature + issuer +
  revocation), **certificate PDF** with a verification QR, and admin revocation.

## Possible next steps

- Front-end **PWA** (service worker + local cache) consuming the bundle/sync API
  — the client half of offline-first; AI **captions** (ASR);
  SCORM/cmi5 + LTI; multi-tenancy; SCIM.
