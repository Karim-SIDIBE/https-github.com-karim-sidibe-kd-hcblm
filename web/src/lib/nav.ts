/**
 * nav.ts — item-aware navigation shared by every learner screen.
 *
 * `openItem` routes a block item to its screen by KIND (quiz kinds to the quiz
 * screen, deliverables to the deliverable screen, …) — single source used by
 * the course list, the resume card and the « Continuer / Session suivante »
 * chaining, so no screen can dead-end on a blank page.
 *
 * `nextTarget` computes what comes right after an item: the next incomplete
 * item of the same block (author-declared display order), else the first
 * incomplete item of the next unlocked block, else null (→ back to the list).
 */
import type { CourseContent } from "@kd/shared";
import { blockItems, type BlockItem, type ItemKind } from "./content";
import { navigate, routes } from "./router";
import type { TFn } from "./i18n";

type ProgressLike = {
  blocks: { index: number; state: string; completedKeys?: string[] }[];
} | null | undefined;

export function itemHref(eid: string, blockIndex: number, it: { kind: ItemKind; key: string }): string {
  if (it.kind === "onboarding") return routes.onboarding(eid);
  if (it.kind === "diagnostic" || it.kind === "interblock" || it.kind === "final") return routes.quiz(eid, it.kind);
  if (it.kind === "field" || it.kind === "journal") return routes.deliverable(eid, blockIndex, it.key);
  if (it.kind === "case" || it.kind === "scenarios" || it.kind === "self" || it.kind === "plan") return routes.activity(eid, blockIndex, it.key);
  if (it.kind === "project") return routes.project(eid);
  return routes.session(eid, blockIndex, it.key);
}

export function openItem(eid: string, blockIndex: number, it: { kind: ItemKind; key: string }): void {
  navigate(itemHref(eid, blockIndex, it));
}

export type NextTarget = { blockIndex: number; item: BlockItem };

export function nextTarget(
  content: CourseContent | undefined | null,
  progress: ProgressLike,
  blockIndex: number,
  currentKey: string,
  t?: TFn,
): NextTarget | null {
  if (!content) return null;
  const stateOf = (i: number) => progress?.blocks?.find((b) => b.index === i)?.state ?? (i === 0 ? "available" : "locked");
  const doneOf = (i: number) => new Set(progress?.blocks?.find((b) => b.index === i)?.completedKeys ?? []);

  // 1) next incomplete item of the current block, after the current one.
  const block = content.blocks.find((b) => b.index === blockIndex);
  if (block) {
    const items = blockItems(block as never, t);
    const done = doneOf(blockIndex);
    const at = items.findIndex((it) => it.key === currentKey);
    // Forward only: chaining never sends the learner BACK to an earlier item
    // (that was the « Session suivante » relance la session précédente bug).
    const next = items.find((it, i) => i > at && it.key !== currentKey && !done.has(it.key));
    if (next) return { blockIndex, item: next };
  }

  // 2) first incomplete item of the next block, if unlocked.
  const after = content.blocks
    .filter((b) => b.index > blockIndex)
    .sort((a, b) => a.index - b.index)
    .find((b) => stateOf(b.index) !== "locked");
  if (after) {
    const done = doneOf(after.index);
    const item = blockItems(after as never, t).find((it) => !done.has(it.key));
    if (item) return { blockIndex: after.index, item };
  }
  return null;
}

/** Navigate to the chaining target, falling back to the course list. */
export function goNext(eid: string, target: NextTarget | null): void {
  if (target) openItem(eid, target.blockIndex, target.item);
  else navigate(routes.cours(eid));
}
