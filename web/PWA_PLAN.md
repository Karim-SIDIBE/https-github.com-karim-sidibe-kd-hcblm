# KD-HCBLM Learner PWA — §9 audit & implementation plan

Status date: 2026-06-02. Branch: `feat/kd-hcblm-backend`.

The backend is feature-complete and spec-covered. This document audits the
existing `web/` PWA against the specification's mobile/connectivity requirements
(§4.3, §4.4, §9), the 18 acceptance criteria and the 8 failure modes, then lays
out a phased plan to reach an acceptance-ready learner experience.

---

## 1. Current state

**Solid foundation (keep):**
- Vite + React 18 + TS, `vite-plugin-pwa` (Workbox) — installable, standalone manifest, FR locale.
- API client with transparent ES256 token refresh (`lib/api.ts`).
- Offline-first core: IndexedDB bundle cache (ETag/304 aware), idempotent action
  queue + replay against `/sync` (`lib/store.ts`, `lib/sync.ts`). 6 unit tests green.

**Everything learner-facing is a stub** (`ui/Course.tsx` is a placeholder list):
no video player, no PAM input, no quizzes/exercises, no peer designation, no
journal/badges/progress, no resume, no position heartbeat, no offline video.

**Backend facts that shape the plan (verified):**
- Offline bundle (`GET /enrollments/:id/offline-bundle`) already returns:
  `content` (PAM-injected, render-ready) · `media` (video + caption URLs) ·
  `mediaAssets` (per-asset rendition ladder: label, bitrateKbps, downloadable, url).
- `GET /media/:id/playback` → adaptive manifest: renditions lowest-bitrate-first
  + recommended **lite** variant + caption tracks. `GET /media/:id/download?label=`
  fetches one rendition (offline). ⇒ **ABR = client-side rendition selection**
  (connection-aware), not HLS segmenting. Offline video = cache chosen rendition.
- xAPI granularity is server-side ready: quiz endpoints accept `meta[qid]={timeMs,
  feedbackViewed}`; `/items` accepts `meta={timeMs,feedbackViewed,response,correct}`;
  `/position` accepts `{positionSec,durationSec}`. The PWA must *send* these.

---

## 2. Requirement audit (front-facing)

Legend: ✅ done · 🟡 partial/foundation · ❌ missing. Level: ⛔ non-negotiable · ⚠️ critical · ✔ required.

| # | Requirement (spec) | Level | AC | Status | Gap to close |
|---|---|---|---|---|---|
| V1 | Adaptive bitrate, plays at 200 kbps, buffer ≤ 8 s | ⛔ | 9 | ❌ | Player with connection-aware rendition pick from `/media/:id/playback`; start on lite/lowest on 2g/3g/Save-Data |
| V2 | Subtitles every video, toggleable, **default-on first view** | ⛔ | — | ❌ | `<track>` from caption URL; toggle; persist preference; default-on first time |
| V3 | Offline video download, completable offline | ⚠️ | 12 | ❌ | "Download session" → cache rendition + captions in Cache Storage; mark offline-ready |
| V4 | Playback speed 0.75/1/1.25/1.5× without leaving full-screen | ✔ | — | ❌ | In-player speed control (in custom controls overlay) |
| M1 | Mobile-first: all interactions on a phone browser | ⛔ | 10 | 🟡 | Build every learner flow mobile-first (shell exists) |
| M2 | Works on low-spec Android (2 GB / 8.0) on 3G | ⛔ | 10 | 🟡 | Perf budget, light deps, lazy player, test under throttle |
| M3 | Touch targets ≥ 44×44 px; fields not hidden by keyboard | ✔ | — | ❌ | Design-system min target sizes; scroll-into-view on focus |
| M4 | Mobile browsers (Chrome/FF Android, Safari iOS), no native app | ⛔ | — | ✅ | PWA already satisfies |
| M5 | Offline micro-session (video+exercise) + **auto** sync | ⛔ | 12 | 🟡 | Background Sync + online/visibility flush; offline video (V3) |
| M6 | Dashboard + session launch load < 3 s on 3G | ✔ | 16 | 🟡 | Route code-split, skeletons, preconnect, measure |
| P1 | PAM is the **first** interaction; gate Block 0 on it; ≥ char min + counter | ⛔ | 1 | ❌ | PAM screen first; `POST /moment-ancrage`; char counter; block advance |
| P2 | PAM injected at exercise/journal/Day+7/Block 4 brief | ⛔ | 2 | 🟡 | Backend injects; PWA must render the injected `content`/blocks |
| R1 | Auto-resume exact video position ±5 s across close + device | ⛔ | 3 | ❌ | Heartbeat → `/position`; on open, `GET /resume` → deep-link to item + seek |
| G1 | Block badge only when all conditions met (no time-based) | ⛔ | 4 | 🟡 | Backend gates; PWA must enforce exercise-after-video, not fake completion |
| X1 | xAPI at question level w/ all fields | ⛔ | 11 | ❌ | Send `meta` (timeMs, feedbackViewed, response, correct) on quizzes/exercises |
| PEER | Peer designation **mandatory** for Entry Badge | ⛔ | 5 | ❌ | Mandatory peer form (name+email+phone), no skip; part of Block 0 gate |
| EX1 | Every video paired w/ exercise, **immediately** after, 1-tap, gated | ⛔ | — | ❌ | Player → auto-advance to exercise; cannot proceed until completed |
| DIAG | Two-priority competency profile shown after positioning quiz | ✔ | 17 | ❌ | Render `priorities`/`subAreaScores` from diagnostic response before advancing |
| SUM | Session summary shown at entry of every session after the 1st | ✔ | 18 | ❌ | Show previous session's key message/summary on session open |
| DUR | Session duration shown on cards **before** launch (FM 8) | ⚠️ | — | ❌ | Session cards show `durationSec` + remaining-time |
| BADGE | Open Badges 2.0 + **LinkedIn 1-tap import** | ⛔ | 8 | ❌ | Badges screen; LinkedIn "Add to profile" deep link from credential URL |
| CERT | Public certificate verification URL | ⚠️ | 15 | ❌ | Show verify URL/QR on the certificate screen |

**Failure modes the PWA must not exhibit:** FM2 (resume→R1), FM5 (mandatory peer→PEER),
FM7 (test on low-spec→M2), FM8 (duration on cards→DUR), FM4 (re-eng deep links→R1).

---

## 3. Architecture decisions

- **Routing:** lightweight hash router (no react-router dep — keep bundle small for M2);
  screens: Login → Enrolments → Course dashboard → Onboarding(Block 0) → Session
  player → Quiz → Journal/Project → Badges/Certificate.
- **Video/ABR:** custom `<video>` + a connection-aware source picker reading the
  rendition ladder (bundle `mediaAssets` offline, `/media/:id/playback` online).
  Use `navigator.connection.effectiveType`/`saveData` to start low and step up.
  No hls.js dependency unless renditions are HLS (keeps bundle small; revisit if
  the media pipeline emits `.m3u8`).
- **Position/resume:** debounced heartbeat (~10 s and on pause/unload) → queued
  `position` action (works offline, syncs later); on session open, seek to the
  saved `positionSec`; app open uses `GET /resume` for the 1-tap deep link.
- **Offline video:** Cache Storage (separate cache `klms-media`) populated on an
  explicit "Télécharger" per session (lite rendition + captions); player resolves
  source from cache when offline. Bundle already lists the assets.
- **Auto-sync:** Background Sync API (`sync` event) + `online` and
  `visibilitychange` listeners → `engine.flush` for all enrolments. No manual button.
- **Design system:** small CSS layer — min 44×44 px targets, ≥16 px inputs (avoid
  iOS zoom), safe-area insets, `scrollIntoView` on focus, skeletons, FR copy.
- **State:** keep the current injection style; add a tiny per-enrolment store
  (bundle + progress + resume) hydrated from IndexedDB, optimistic on actions.

---

## 4. Phased plan

Each phase is independently shippable, typechecks, adds unit tests for pure logic,
and is verified against the live backend (`npm run dev` proxying to :4000).

**Phase 0 — Mobile shell & API completion**
- Design-system CSS (44px targets, inputs, safe-area, skeletons); hash router;
  enrolment list (replace manual ID) via `GET /auth/me` + enrolments.
- Complete the API client: resume, position, moment-ancrage, quizzes(+meta),
  items(+meta), peer, blocks, project, notifications, media playback.
- Auto-sync (Background Sync + online/visibility) + sync-status banner.
- *Verifies:* M3, M6 (shell), M5 (auto-sync), foundation for all.

**Phase 1 — Course dashboard**
- Block list with states (locked/available/completed); session cards with
  **duration** + remaining-time; progress bar; **1-tap resume** (`/resume`).
- *Verifies:* DUR/FM8, R1 (entry), M1.

**Phase 2 — Onboarding (Block 0)**
- PAM-first screen (char counter, min enforced) → gate; trigger/profile quiz;
  **mandatory peer** (name+email+phone). Block 0 cannot complete without all three.
- *Verifies:* P1/AC1, PEER/AC5/FM5.

**Phase 3 — Micro-session player (the core)**
- Connection-aware ABR video; subtitles default-on + toggle; speed control;
  position heartbeat + resume-seek; **exercise immediately after video**, 1-tap,
  gated; send xAPI `meta`.
- *Verifies:* V1/AC9, V2, V4, R1/AC3/FM2, EX1, X1/AC11, G1/AC4.

**Phase 4 — Quizzes & competency profile**
- Diagnostic → **two-priority profile** before advancing; inter-block + final
  quizzes; per-question timing + feedback-viewed; **session summary** on re-entry.
- *Verifies:* DIAG/AC17, SUM/AC18, X1/AC11.

**Phase 5 — Journal, field application, Block 4, badges/certificate**
- Journal entry UI (PAM-injected prompt); gated field-application submission;
  Block 4 project submission + status; badges screen with **LinkedIn 1-tap**;
  certificate with **public verify URL/QR**.
- *Verifies:* P2/AC2, BADGE/AC8, CERT/AC15.

**Phase 6 — Offline video download + sync hardening**
- "Télécharger la session" → cache lite rendition + captions; play offline;
  auto-sync queued actions (incl. positions) on reconnect with zero taps.
- *Verifies:* V3, M5/AC12.

**Phase 7 — Performance & low-spec/3G**
- Route/player code-split, lazy media, preconnect, image/icon budget; measure
  dashboard + session launch < 3 s at throttled 3G (Lighthouse mobile).
- *Verifies:* M2/AC10, M6/AC16, FM7 (documented throttled runs).

---

## 5. AI-era enhancements (grounded, optional within phases)

- Connection-aware + Save-Data ABR start (real signals via `navigator.connection`).
- Grounded **AI tutor** chat (backend `tutor` module/RAG already exists) in the player.
- AI **formative feedback** on written exercises (backend `feedback` module) shown inline.
- Prefetch next session's lite rendition when on Wi-Fi/unmetered.
- Optional Whisper-style on-device captions are **out of scope** (not verifiable here).

---

## 6. Verification strategy

- **Unit (node:test):** pure logic — rendition selection by effectiveType, resume
  deep-link resolution, heartbeat rounding/debounce, offline-cache key scheme,
  xAPI meta builder, char-count gate.
- **Integration:** run `web` against the live backend; drive each phase's flow and
  confirm the corresponding server state (positions, xAPI `answered`/`progressed`,
  peer WhatsApp enqueue, project lifecycle) — same approach used to verify the backend.
- **Perf:** `npm run build` + serve `dist/`, Lighthouse mobile + 3G throttle for AC16;
  record numbers for AC10/FM7.
- Keep typecheck + tests green at every phase.

---

## 7. Open decisions

1. **Media format:** renditions are currently progressive URLs (ABR by selection).
   If the pipeline later emits HLS `.m3u8`, add hls.js behind the same player API.
2. **Auth for learners:** demo login is password-only; enterprise SSO (OIDC/SAML)
   exists on the backend — wire later if needed for pilots.
3. **Scope of Phase 5 staff flows** (evaluator grading UI) — likely a separate
   admin surface, not the learner PWA.
