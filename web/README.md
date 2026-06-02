# KD-HCBLM — Web PWA (`web/`)

Offline-first Progressive Web App for learners, consuming the `server/` API.
Stack: **Vite · React · TypeScript · vite-plugin-pwa (Workbox)**.

## Why offline-first

Built for low-connectivity (mobile / African) contexts. The app caches a course
**bundle** (the server's `/offline-bundle`, ETag-aware) in IndexedDB and queues
learner actions locally; when connectivity allows it flushes the queue to
`/sync` (idempotent, time-ordered — applied/deduped ops are dropped, failures
retried). The service worker caches the app shell + API GETs.

## Architecture

| Path | Role |
|---|---|
| `src/lib/api.ts` | API client: Bearer access token + transparent refresh. |
| `src/lib/store.ts` | `OfflineStore` interface; `memStore` (tests) + `idbStore` (IndexedDB). |
| `src/lib/sync.ts` | Offline engine: cache bundle, queue actions, flush to `/sync`. |
| `src/lib/app.ts` | Wiring (token persistence, store/engine selection). |
| `src/ui/*` | Login + offline-capable course view. |
| `vite.config.ts` | PWA manifest + Workbox service worker. |

The offline engine is store/API-injected, so its logic is unit-tested in Node
(`npm test`) without a browser.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173  (expects the API at :4000)
npm test           # node:test — offline engine + token refresh
npm run typecheck
npm run build      # → dist/ (installable PWA: manifest + sw.js)
npm run preview
```

Configure the API base with `VITE_API_URL` (default `http://localhost:4000/api/v1`).

## Status

Complete learner experience — all 8 planned phases shipped (see `PWA_PLAN.md`):

0. Mobile-first shell (≥44px targets, safe-area), dependency-free hash router,
   enrolment picker, complete API client, automatic no-tap sync.
1. Course dashboard — block states, session cards with duration, progress bar +
   remaining time, 1-tap resume (saved video offset).
2. Block 0 onboarding — PAM-first gate, profile + trigger quiz, mandatory peer.
3. Micro-session player — connection-aware adaptive video, subtitles default-on +
   toggle, speed control, position heartbeat + resume-seek, gated exercise (xAPI).
4. Quizzes — diagnostic → two-priority competency profile, inter-block + final,
   per-question xAPI, previous-session summaries.
5. Deliverables — gated field application, journal, Block 4 project (rubric shown
   before submit + in-platform status), badges + LinkedIn 1-tap + public verify.
6. Offline video download (CacheFirst + range-seeking) → sessions complete offline.
7. Performance — route code-splitting (initial transfer ≈ 51 KB gzip, ~1 s on
   400 kbps 3G), preconnect, lazy player/quiz.

29 unit tests green; installable PWA (manifest + service worker, klms-api +
klms-media caches). Each phase verified against the live backend.

Possible next polish: richer case-study / guided-scenario / self-assessment /
action-plan UIs (currently one-tap), AI tutor chat, push notifications, and a
custom service-worker `sync` handler for background-while-closed sync.
