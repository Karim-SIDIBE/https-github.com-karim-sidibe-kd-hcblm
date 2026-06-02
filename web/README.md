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

Foundation: auth (login + refresh), offline bundle caching, an idempotent action
queue + sync, and an installable PWA shell. 6 unit tests green; production build
emits the manifest + service worker. Next: richer learner UI (resume, quizzes,
journal), AI tutor chat, enrolment list, push notifications.
