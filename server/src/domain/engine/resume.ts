/**
 * resume.ts — auto-resume target (Pilier 6.2).
 *
 * Computes where the learner should land: their explicitly saved position if any,
 * otherwise the first incomplete required item of the current (furthest unlocked)
 * block. Returns null when the whole course is complete.
 */
import type { CourseContent } from "../content-model.js";
import { computeProgress, type CompletionRecord } from "./progress.js";

export type ResumeTarget = {
  blockIndex: number;
  blockTitle: string;
  itemKey: string;
  itemLabel: string;
  /** Whether this came from a saved position vs. computed next-incomplete. */
  source: "saved" | "computed";
};

export function computeResume(
  content: CourseContent,
  completions: CompletionRecord[],
  hasMomentAncrage: boolean,
  saved?: { blockIndex: number | null; itemKey: string | null },
): ResumeTarget | null {
  const progress = computeProgress(content, completions, hasMomentAncrage);
  if (progress.courseCompleted) return null;

  // Prefer an explicit saved position, as long as its block isn't already done.
  if (saved?.blockIndex != null && saved.itemKey) {
    const bp = progress.blocks[saved.blockIndex];
    if (bp && bp.state !== "completed") {
      return {
        blockIndex: saved.blockIndex,
        blockTitle: content.blocks[saved.blockIndex]?.title ?? "",
        itemKey: saved.itemKey,
        itemLabel: bp.required.find((r) => r.key === saved.itemKey)?.label ?? saved.itemKey,
        source: "saved",
      };
    }
  }

  // Otherwise: first incomplete required item of the current block.
  const current = progress.blocks.find((b) => b.state === "available");
  if (!current) return null;

  const block = content.blocks[current.index]!;
  // Bloc 0 needs the Moment d'Ancrage before anything else.
  if (block.type === "ONBOARDING" && !hasMomentAncrage) {
    return { blockIndex: current.index, blockTitle: block.title, itemKey: "moment-ancrage", itemLabel: "Moment d'Ancrage", source: "computed" };
  }
  const next = current.missing[0];
  if (!next) return null;
  return { blockIndex: current.index, blockTitle: block.title, itemKey: next.key, itemLabel: next.label, source: "computed" };
}
