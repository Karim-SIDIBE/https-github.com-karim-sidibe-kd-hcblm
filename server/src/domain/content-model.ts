/**
 * content-model.ts — THE CONTRACT (re-export).
 *
 * The canonical Zod content model now lives in the shared workspace package
 * `@kd/shared` so the server (runtime validation + engine) and the learner PWA
 * (types) consume one single source of truth — no drift. This file re-exports it
 * unchanged so every existing `domain/content-model.js` import keeps working.
 */
export * from "@kd/shared";
