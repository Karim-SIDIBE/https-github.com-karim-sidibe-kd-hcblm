/**
 * progress.ts — block gating + completion engine (pure).
 *
 * Requirements are DERIVED from the content document (works for any course at
 * any level), then compared against the enrolment's completion records to decide
 * each block's state: locked → available → completed. Gating is strictly
 * sequential (a block unlocks only when the previous one is complete), which
 * encodes the spec's hard gates — notably "Bloc 4 stays locked until the final
 * quiz reaches the pass threshold" and "field application gates Bloc 3".
 */
import type { CourseContent, Block } from "../content-model.js";

export type ItemTypeName =
  | "PROFILE" | "TRIGGER_QUIZ" | "PEER" | "MICRO_SESSION" | "DIAGNOSTIC_QUIZ"
  | "CASE_STUDY" | "GUIDED_SCENARIOS" | "INTER_BLOCK_QUIZ" | "FIELD_APPLICATION"
  | "SELF_ASSESSMENT" | "ACTION_PLAN" | "FINAL_QUIZ" | "PROJECT" | "JOURNAL_ENTRY"
  | "RUBRIC_EVALUATION";

export type RequiredItem = {
  itemType: ItemTypeName;
  key: string;
  /** Minimum score (%) required for this item to count as satisfied. */
  minScore?: number;
  label: string;
};

export type CompletionRecord = {
  blockIndex: number;
  itemKey: string;
  scorePct: number | null;
};

export type BlockState = "locked" | "available" | "completed";

export type BlockProgress = {
  index: number;
  type: Block["type"];
  title: string;
  state: BlockState;
  required: RequiredItem[];
  completedKeys: string[];
  missing: RequiredItem[];
  /** Set when a required scored item exists but is below threshold. */
  failedThreshold?: { key: string; need: number; got: number | null };
};

/** Derive the required completion items for one block. */
export function blockRequirements(block: Block): RequiredItem[] {
  switch (block.type) {
    case "ONBOARDING":
      return [
        { itemType: "PROFILE", key: "profile", label: "Profil de gestion du temps identifié" },
        { itemType: "TRIGGER_QUIZ", key: "trigger", label: "Quiz déclencheur complété" },
        { itemType: "PEER", key: "peer", label: "Pair de progression nommé" },
      ];
    case "COMPREHENSION": {
      const req: RequiredItem[] = [
        { itemType: "DIAGNOSTIC_QUIZ", key: "diagnostic", label: "Quiz diagnostique" },
        ...block.payload.microSessions.map((m) => ({
          itemType: "MICRO_SESSION" as const, key: m.id, label: `Micro-session ${m.id}`,
        })),
      ];
      if (block.payload.caseStudy) req.push({ itemType: "CASE_STUDY", key: "case", label: "Étude de cas" });
      return req;
    }
    case "PRACTICE": {
      const req: RequiredItem[] = block.payload.microSessions.map((m) => ({
        itemType: "MICRO_SESSION" as const, key: m.id, label: `Micro-session ${m.id}`,
      }));
      if (block.payload.guidedScenarios.length > 0)
        req.push({ itemType: "GUIDED_SCENARIOS", key: "scenarios", label: "Mises en situation guidées" });
      if (block.payload.interBlockQuiz)
        req.push({ itemType: "INTER_BLOCK_QUIZ", key: "interblock", label: "Quiz interbloc" });
      req.push({ itemType: "FIELD_APPLICATION", key: "field", label: "Application terrain" });
      return req;
    }
    case "ANCHORING":
      return [
        ...block.payload.microSessions.map((m) => ({
          itemType: "MICRO_SESSION" as const, key: m.id, label: `Micro-session ${m.id}`,
        })),
        { itemType: "SELF_ASSESSMENT", key: "self", label: "Auto-évaluation" },
        { itemType: "ACTION_PLAN", key: "plan", label: "Plan d'action 30 jours" },
        {
          itemType: "FINAL_QUIZ", key: "final", minScore: block.payload.finalQuiz.passThreshold,
          label: `Quiz final ≥ ${block.payload.finalQuiz.passThreshold}%`,
        },
      ];
    case "CERTIFICATION":
      return [
        { itemType: "PROJECT", key: "project", label: "Projet certifiant soumis" },
        ...block.payload.journal.entries.map((e) => ({
          itemType: "JOURNAL_ENTRY" as const, key: `J+${e.day}`, label: `Journal J+${e.day}`,
        })),
        {
          itemType: "RUBRIC_EVALUATION", key: "rubric", minScore: block.payload.rubric.threshold,
          label: `Évaluation grille ≥ ${block.payload.rubric.threshold}/100`,
        },
      ];
  }
}

/** Is a single required item satisfied by the completion set? */
function isSatisfied(req: RequiredItem, byKey: Map<string, CompletionRecord>): boolean {
  const c = byKey.get(req.key);
  if (!c) return false;
  if (req.minScore != null) return (c.scorePct ?? -1) >= req.minScore;
  return true;
}

export type ProgressResult = {
  blocks: BlockProgress[];
  /** Block types whose conditions are fully met (badge-eligible). */
  completedBlockIndexes: number[];
  /** Index of the furthest unlocked block. */
  currentBlockIndex: number;
  courseCompleted: boolean;
};

/**
 * Compute the full progress map.
 * @param hasMomentAncrage whether the enrolment has captured its PAM (extra
 *   non-negotiable requirement for Bloc 0 completion).
 */
export function computeProgress(
  content: CourseContent,
  completions: CompletionRecord[],
  hasMomentAncrage: boolean,
): ProgressResult {
  const blocks: BlockProgress[] = [];
  const completedBlockIndexes: number[] = [];
  let previousCompleted = true; // Bloc 0 is always reachable.

  for (const block of content.blocks) {
    const required = blockRequirements(block);
    const recs = completions.filter((c) => c.blockIndex === block.index);
    const byKey = new Map(recs.map((c) => [c.itemKey, c]));
    const completedKeys = recs.map((c) => c.itemKey);

    const missing = required.filter((r) => !isSatisfied(r, byKey));

    // Bloc 0 additionally requires the Moment d'Ancrage to be captured.
    let pamMissing = false;
    if (block.type === "ONBOARDING" && !hasMomentAncrage) pamMissing = true;

    // Detect a scored item present but below threshold (distinct from "missing").
    let failedThreshold: BlockProgress["failedThreshold"];
    for (const r of required) {
      if (r.minScore != null) {
        const c = byKey.get(r.key);
        if (c && (c.scorePct ?? -1) < r.minScore) {
          failedThreshold = { key: r.key, need: r.minScore, got: c.scorePct };
        }
      }
    }

    const complete = missing.length === 0 && !pamMissing;
    const state: BlockState = complete ? "completed" : previousCompleted ? "available" : "locked";

    blocks.push({
      index: block.index, type: block.type, title: block.title, state,
      required, completedKeys, missing, failedThreshold,
    });

    if (complete) completedBlockIndexes.push(block.index);
    previousCompleted = complete;
  }

  const currentBlockIndex = blocks.find((b) => b.state === "available")?.index
    ?? blocks[blocks.length - 1]!.index;
  const courseCompleted = completedBlockIndexes.length === content.blocks.length;

  return { blocks, completedBlockIndexes, currentBlockIndex, courseCompleted };
}

/** Score a quiz: answers map questionId → chosen option key. */
export function scoreQuiz(
  questions: { id: string; correctKey: string }[],
  answers: Record<string, string>,
): { scorePct: number; correct: number; total: number } {
  const total = questions.length;
  const correct = questions.filter((q) => answers[q.id] === q.correctKey).length;
  const scorePct = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { scorePct, correct, total };
}
