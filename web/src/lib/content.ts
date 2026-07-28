/**
 * content.ts — the learner-facing block-item derivation now lives in the shared
 * contract (@kd/shared/block-items), single source for the PWA renderer AND the
 * admin arrangement editor. This module re-exports it so existing imports keep
 * working unchanged.
 */
export * from "@kd/shared/block-items";
