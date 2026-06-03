# Handoff — Plateforme KD-HCBLM v2.0 (KOMPETENCES DECLICK)

## Overview

Build the production platform behind the Declick learner experience prototyped in this bundle. The platform serves a **competency-based, contextualised soft-skills certification model (KD-HCBLM v2.0)** for francophone-Africa professional learners, mobile-first.

The **finality** of this handoff is a platform where:

1. A **Learning Designer** (admin role) can author **any course at Level 1, 2 or 3** by filling **dedicated fields for each course component** — without touching code.
2. The authored content is rendered to learners (and to admins/evaluators) through the **fixed KD-HCBLM visual + interaction system** demonstrated here (the same one used for the Level 1 "Gestion du temps & productivité" course).

In other words: **the structure, visual design, and pedagogical mechanics are fixed and reusable; only the content varies per course/level.** The Learning Designer pours content into a fixed template; the platform engine enforces the model and renders the Declick UI.

> The reference course used throughout the prototype — **"Gestion du temps & productivité en environnements professionnels africains" (Niveau 1)** — is included verbatim in `course_extracted.md`. Treat it as the canonical example payload that the authoring tool must be able to produce, and that the learner UI must be able to render.

---

## About the design files

The files in this bundle are **design references created in HTML/React-via-Babel** — prototypes showing the intended look, content structure and behaviour. **They are not production code to copy directly.** The task is to **recreate these designs in a real codebase**: pick an appropriate stack (the UI maps naturally to **React + a component library + a design-token layer**; backend any modern stack with a relational DB + object storage + a video/streaming service + an LRS), and rebuild the screens using production patterns (real routing, data layer, auth, persistence, streaming, notifications).

Reuse the **design tokens** (`declick-tokens.css`) and the **component intent** (`hifi.css`, `hf-kit.jsx`) verbatim where possible — they are the KOMPETENCES AFRICA design system applied as-is.

## Fidelity

- **High-fidelity** — `hifi.html` (19 screens, mobile + desktop) and `prototype.html` (clickable mobile + desktop) are pixel-level intent: final colours, type, spacing, components, hover/active/focus states, transitions, active video player. Recreate the learner UI pixel-faithfully.
- **Low-fidelity** — `index.html` (annotated wireframes) documents information architecture and *why* each mechanism exists (each note cites the platform spec). Use it to understand structure and the non-negotiable rules.

---

## The two faces of the platform

### A. Learner experience (rendered from authored content)
Demonstrated in `prototype.html` / `hifi.html`. Fixed screens, content-driven:
Accueil/dashboard · Bloc 0 (Moment d'Ancrage → vidéo déclencheur + quiz → profil → pair) · micro-session list · video→exercise→feedback loop · journal · re-engagement messages · peer notification · Bloc 4 dépôt → evaluator rubric → certificate · admin cohort + learner analytics.

### B. Learning Designer authoring (TO BE DESIGNED & BUILT)
A back-office where the designer fills **the fields below**, grouped by block, with **live preview using the very same learner components**, plus validation that enforces the non-negotiable rules. This is the primary new surface to build. See "Authoring UI" below.

---

## Data model (content-agnostic — the contract between authoring and rendering)

The model is **fixed across Levels 1–3**; only values change. Levels differ only by: `level`, the Bloc 3 graded-quiz **pass threshold** (L1 = 70 %, L2 = 75 %, L3 = 80 %), the Bloc 4 rubric threshold, and content depth.

```
Course {
  id, title, level (1|2|3), language ("fr"),
  domain { code, label },                      // e.g. { "D4", "Productivité & organisation" }
  competencies [ { code, label } ],            // e.g. D4.C1 Organisation personnelle …
  summary, audience, durationEstimate,
  passThreshold,                               // Bloc 3 final quiz: 70 / 75 / 80
  certificate { title, openBadges2: true, verificationUrlPattern },
  blocks [ Block × 5 ]                          // always 5, types below, ordered 0→4
}

Block (one of 5 fixed types) {
  index (0..4), type, title, objective, durationEstimate,
  badge { type, label, conditions[] },          // conditions = explicit completion gates
  ...type-specific payload (below)
}

// ---- Bloc 0 — Onboarding & déclencheur ----
Onboarding {
  momentAncrage {                               // = "PAM", the personalisation anchor
    promptText, minChars (default 50), placeholderExample
  },
  triggerVideo  { title, url, durationSec, subtitlesUrl, keyMessage, africanExample, errorToAvoid, scriptText },
  triggerQuiz   { questions:[ { id, text, options:[{key A-D, label}] } ],  // non-scored, profile-building
                  profiles:[ { scoreRange, name, description } ] },
  progressPeer  { mandatory: true },            // learner nominates name + email/phone
  // Entry badge gate: momentAncrage submitted + trigger quiz done + peer nominated
}

// ---- Bloc 1 — Compréhension ----  (and the per-micro-session shape reused in Blocs 2,3)
Comprehension {
  diagnosticQuiz {                              // scored for profile, runs BEFORE videos
    questions:[ { id, scenarioText, options:[{key,label}], correctKey, feedbackText, subArea } ],
    profiles:[ { scoreRange, name, description } ]
  },
  microSessions:[ MicroSession ],
  caseStudy? { title, steps[] }
}

MicroSession {
  id ("1.1"), title, durationEstimate,
  summaryPoints:[ 3 strings ],                  // "3 points clés" shown at session entry
  video { title, url, durationSec, subtitlesUrl, keyMessage, africanExample, errorToAvoid, scriptText },
  exercise {
    type: "multi" | "written" | "guidedForm",
    prompt,                                      // supports {{moment_ancrage}} injection
    options?:[{key,label}], correctKey?, fields?:[{label,placeholder}],
    minChars? (written, default 300),
    feedbackText                                // explicit, shown in full before advancing
  }
}

// ---- Bloc 2 — Pratiquer & progresser ----
Practice {
  microSessions:[ MicroSession ],
  guidedScenarios:[ { title, contextAfricain, steps:[{question,options,correctKey,feedback}] } ],
  fieldApplication { brief /* {{moment_ancrage}} */, minChars (default 200), gatesNextBlock: true }
}

// ---- Bloc 3 — Installer des habitudes ----
Anchoring {
  microSessions:[ MicroSession ],
  selfAssessment { criteria:[string], scale:[1..4 labels] },
  actionPlan30d { habits:[ { title, fields[] } ] },
  finalQuiz { questions:[{scenarioText,options,correctKey,feedbackText}], passThreshold /* = Course.passThreshold */ }
}

// ---- Bloc 4 — Mini-projet certifiant ----
Certification {
  projectBrief,                                 // {{moment_ancrage}} injected
  sections:[ 5 × { title, helpText, prefillFrom? } ],   // S1 prefilled from momentAncrage
  journal { entries:[ { day: 1|3|5|7|10|14, prompt /* {{moment_ancrage}} */, minWords (50–100) } ] },  // 6 micro-entries
  rubric { criteria:[ { label, competencyCode, weightPoints } ], totalPoints: 100, threshold: 70|75|80 },
  evaluation { humanEvaluator: true, turnaroundDays: 5, adminAlertAtDay: 5 }
}
```

### The PAM (Moment d'Ancrage) thread — most important mechanic
`momentAncrage` text is captured once at Bloc 0 and stored as a **persistent, queryable, injectable variable** (`{{moment_ancrage}}`). The engine must substitute it into: **(1)** exercise prompts (Blocs 1–3), **(2)** journal entry prompts (Bloc 4), **(3)** the Day +7 re-engagement message, **(4)** the Bloc 4 project brief & Section 1 prefill. A platform that stores the PAM but does not re-inject it has not implemented the model. The authoring tool must let designers place `{{moment_ancrage}}` tokens and must validate its presence at those touchpoints.

---

## Non-negotiable platform engine (content-independent, enforce server-side)

These behaviours are fixed for every course/level. Full rationale in `index.html` notes and the spec.

- **Block gating**: a block's badge is issued only when ALL its completion conditions are met (videos viewed + exercises done + quiz passed + journal/field-app submitted, per block). Next block locks until then. Bloc 4 locks until Bloc 3 final quiz ≥ threshold.
- **Auto-resume**: store exact position (incl. video position to ±5 s) server-side; resume across interruptions AND device changes. Single-tap "Reprendre" → exact position.
- **Video**: adaptive bitrate (works at 200 kbps), subtitles (default on), speed (0.75–1.5×), offline download + automatic sync on reconnect.
- **Progressive badges**: Open Badges 2.0; issued < 60 s; one-tap LinkedIn import; public verification URL/API.
- **Re-engagement**: independent automated messages at Day +3 (positional + deep link), Day +7 (**injects PAM**), Day +14 (admin/HR escalation). Email + push / SMS / WhatsApp per stage.
- **Journal triggers**: auto-pushed at Day +1/+3/+5/+7/+10/+14, PAM-injected, fire whether or not learner is active.
- **Progress Peer**: mandatory nomination at Bloc 0; automatic notification (email AND SMS/WhatsApp) within 2 h of each block completion; no learner action required.
- **Data**: xAPI statements for every interaction → LRS; real-time admin analytics (cohort + learner); documented REST API (OAuth 2.0) + webhooks (badge, block completion, Bloc 4 submission, Day +14, certificate).
- **Mobile-first**: full functionality on low-spec Android (2 GB / Android 8) on 3G; touch targets ≥ 44 px; dashboard/session load < 3 s on 3G.

## Roles
`learner` · **`learning_designer`** (authoring) · `course_admin` (cohorts, analytics, overrides w/ audit) · `evaluator` (Bloc 4 rubric scoring) · `enterprise_client` (read-only cohort analytics) · `employer` (public verification only).

---

## Authoring UI — Learning Designer (primary surface to build)

A back-office, desktop-first, reusing the Declick design system. Goal: enter any L1/L2/L3 course into fields mapped 1:1 to the data model, with the SAME visual blocks the learner sees.

**Structure**
- **Course list** → **Course builder** (create: title, level, domain, competencies, thresholds, certificate title).
- **Block-by-block forms** in a left-rail stepper (Bloc 0 → 4), each section mirroring the data model fields. Suggested field controls:
  - *Bloc 0*: Moment d'Ancrage prompt + min-chars + example; trigger video (title/URL/upload, subtitles, key message, African example, error-to-avoid, script); trigger quiz builder (questions + A–D options, no correct answer; profile bands name+range+description); peer step is fixed-on.
  - *Bloc 1*: diagnostic quiz builder (scenario text, A–D options, **correct key**, **feedback text**, sub-area tag); repeatable **MicroSession** editor (id, title, duration, 3 summary points, video fields, exercise builder with type switch multi/written/guidedForm, `{{moment_ancrage}}` token-insert button, correct value, feedback); optional case study.
  - *Bloc 2*: micro-sessions; guided scenarios; field-application brief (+min chars; toggle "gates next block").
  - *Bloc 3*: micro-sessions; self-assessment grid (criteria + 1–4 scale); 30-day action-plan habit blocks; final quiz builder + threshold (auto from level).
  - *Bloc 4*: project brief (token-insert), 5 section definitions (mark which prefills from PAM), journal 6-entry editor (day + prompt + min words, token-insert), **rubric builder** (criteria rows: label + competency code + weight points, **live total must = 100**), evaluation settings.
- **Live preview pane**: render the in-progress block with the actual learner components (the `hf-*` screens) so the designer sees exactly what the learner gets.
- **Validation gate before publish** (block publish until satisfied): exactly 5 blocks present; PAM prompt set AND `{{moment_ancrage}}` used in ≥1 exercise + journal + Day +7 message + Bloc 4 brief; every quiz question has a correct key + feedback; rubric weights sum to 100; thresholds match level; every badge's conditions complete.
- **Versioning / publish / preview-as-learner**; courses are drafts until published.

---

## Screens / views (reference)

The learner & admin screens are fully specified visually in the bundle. For each, read the corresponding file; key specs:

- **Dashboard / accueil** (`hf-dashboard.jsx`) — resume-first card (orange stripe, glow CTA), progression (% + remaining time), block rail (0–4 with done/now/lock), Progress-Peer card (mint), badge medallions. Desktop = 3 columns (nav rail / content / score-ring + progress + pair + badges).
- **Bloc 0 Moment d'Ancrage** (`hf-onboarding.jsx`) — stepper 0–4, anchor prompt + textarea (min 50) + mandatory gate; desktop adds "what you'll unlock" rail.
- **Micro-session** (`hf-session.jsx`) — session list (autonomous, duration pill, 3-key-points summary); player→exercise loop (navy video w/ ST + speed + offline + adaptive chip, scrub; PAM-injected exercise; immediate green feedback; locked "Session suivante").
- **Journal & relances** (`hf-engagement.jsx`) — journal micro-entry (PAM prompt, 6-entry tracker); J+3/J+7/J+14 sequence; peer inbox.
- **Bloc 4** (`hf-block4.jsx`) — learner sujet+grille D4+dépôt; evaluator rubric scoring /100; certificate (mobile + desktop diploma).
- **Admin** (`hf-admin.jsx`) — cohort (KPIs, completion funnel by block, learner table, completion forecast, read-only enterprise view) + learner drill-down (PAM, block timeline, re-engagement history, xAPI).

## Interactions & behaviour
See `prototype-app.jsx` for the canonical clickable behaviour and `hifi.css` (section "MICRO-INTERACTIONS & STATES") for exact states/timings:
- Hover lift on cards (`translateY(-2px)` + shadow), button glow (orange), press scale `.97`, field focus ring (orange 3px).
- Active video: tap play → "is-playing" (pulsing live dot + scrub animates over 3.5 s) → "terminée" → exercise reveals (fade+slide) → select option (✓ pop) → validate → green feedback → advance (progress updates, toast).
- Screen transitions: fade + 10px slide-up (`pt-in`, 0.34 s, `cubic-bezier(0.22,1,0.36,1)`).
- Block 4 flow: Badges → certificate card → dépôt → "Soumettre" → green confirmation → "Voir résultat" → certificate.

## State (prototype-level; real app uses server state)
`screen` (router) · `device` (mobile/desktop) · video `playing`/`done` · exercise `choice`/`submitted` · `progress` · `journalText` · `b4submitted` · `toast`. In production these map to: enrolment progress, xAPI events, resume position, submissions, badge state — all server-persisted.

## Design tokens
All in `declick-tokens.css` (use verbatim). Highlights:
- **Orange** `#F36F21` (primary CTA / accent), **Navy** `#112E66` (headings/anchor), **Mint** `#2DAA4F` (Declick / progress / success), **Icy** `#EAF1F8` (secondary surface), peach `#FFF3E8`.
- Type: **Plus Jakarta Sans** (display 700/800) + **DM Sans** (body 400/500). Scale, spacing (4px base), radii (sm 6 → 2xl 28, pill 999), shadows (soft navy-tinted; orange-glow CTA `0 10px 24px rgba(243,111,33,.32)`), motion easings — all tokenised.

## Assets
- `assets/logo-declick.png` — KOMPETENCES DECLICK logo (use the brand's real asset in production).
- Icons in prototype are inline SVG (Lucide-style, 1.75–2 px stroke) — replace with the codebase's icon set.
- Videos are placeholders — wire to the real adaptive-streaming service.

## Files in this bundle
- `prototype.html` + `prototype-app.jsx` + `hf-kit.jsx` — clickable prototype (mobile + desktop), canonical interactions.
- `hifi.html` + `hf-*.jsx` + `hifi.css` + `design-canvas.jsx` — hi-fi screen set (mobile + desktop).
- `index.html` + `wf-*.jsx` + `wireframe.css` — annotated wireframes (IA + rationale, each note cites the spec).
- `declick-tokens.css` — design tokens (source of truth).
- `hf-authoring.jsx` (hi-fi) + `wf-authoring.jsx` (wireframe) — **Learning Designer authoring back-office** (block/exercise editor with live preview + validation; Bloc 4 rubric builder). The primary new surface to build.
- `course_extracted.md` — the full Niveau 1 reference course = canonical authoring payload / rendering test.
- `screenshots/` — rendered PNGs of the key mockups: 01 dashboard · 03 onboarding · 04 micro-session · 05 journal/relances · 06 Bloc 4 · 07 admin · 08–09 authoring (editor + rubric).
```

*(All `.jsx` here are Babel-in-browser prototype files — reimplement as real components.)*
