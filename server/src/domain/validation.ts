/**
 * validation.ts — the "non-negotiable rules" publish gate.
 *
 * Two layers:
 *   1. SHAPE   — `CourseContent` Zod parse (types, required fields, per-field rules).
 *   2. POLICY  — cross-cutting platform rules that a shape-valid document can
 *      still violate. These block publication (README "Validation gate before
 *      publish"). A DRAFT may be saved while failing policy; PUBLISHED may not.
 *
 * The most important policy is the Moment d'Ancrage (PAM) thread: the token
 * `{{moment_ancrage}}` MUST appear at the four reuse touchpoints, otherwise the
 * platform "stores the PAM but does not re-inject it" — which the spec calls a
 * non-implementation of the model.
 */
import { z } from "zod";
import {
  CourseContent,
  LEVEL_PASS_THRESHOLD,
  MOMENT_ANCRAGE_TOKEN,
  type Block,
  type CourseContent as CourseContentT,
} from "./content-model.js";

export type ValidationIssue = {
  level: "error" | "warning";
  rule: string;
  path: string;
  message: string;
};

export type ShapeResult =
  | { ok: true; content: CourseContentT }
  | { ok: false; issues: ValidationIssue[] };

export type PolicyResult = {
  publishable: boolean;
  issues: ValidationIssue[];
};

const hasToken = (s: string | undefined | null): boolean =>
  typeof s === "string" && s.includes(MOMENT_ANCRAGE_TOKEN);

/** Layer 1 — parse against the content model. */
export function validateShape(input: unknown): ShapeResult {
  const parsed = CourseContent.safeParse(input);
  if (parsed.success) return { ok: true, content: parsed.data };
  const issues: ValidationIssue[] = parsed.error.issues.map((i: z.ZodIssue) => ({
    level: "error",
    rule: "shape",
    path: i.path.join("."),
    message: i.message,
  }));
  return { ok: false, issues };
}

const FIXED_BLOCK_ORDER: Block["type"][] = [
  "ONBOARDING",
  "COMPREHENSION",
  "PRACTICE",
  "ANCHORING",
  "CERTIFICATION",
];

/** Layer 2 — policy rules over a shape-valid document. */
export function validatePolicy(content: CourseContentT): PolicyResult {
  const issues: ValidationIssue[] = [];
  const err = (rule: string, path: string, message: string) =>
    issues.push({ level: "error", rule, path, message });
  const warn = (rule: string, path: string, message: string) =>
    issues.push({ level: "warning", rule, path, message });

  // --- exactly 5 blocks, fixed types, ordered 0→4 ---
  if (content.blocks.length !== 5)
    err("blocks.count", "blocks", `exactement 5 blocs requis (reçu ${content.blocks.length})`);
  content.blocks.forEach((b, i) => {
    if (b.index !== i)
      err("blocks.order", `blocks[${i}].index`, `index attendu ${i}, reçu ${b.index}`);
    if (FIXED_BLOCK_ORDER[i] && b.type !== FIXED_BLOCK_ORDER[i])
      err("blocks.type", `blocks[${i}].type`, `type attendu ${FIXED_BLOCK_ORDER[i]}, reçu ${b.type}`);
  });

  const byType = <T extends Block["type"]>(t: T) =>
    content.blocks.find((b) => b.type === t) as Extract<Block, { type: T }> | undefined;

  const onboarding = byType("ONBOARDING");
  const comprehension = byType("COMPREHENSION");
  const anchoring = byType("ANCHORING");
  const certification = byType("CERTIFICATION");

  // --- PAM prompt present ---
  if (!onboarding?.payload.momentAncrage.promptText?.trim())
    err("pam.prompt", "blocks[0].payload.momentAncrage.promptText", "le prompt du Moment d'Ancrage est obligatoire");

  // --- PAM token re-injected at the four mandated touchpoints ---
  // (1) at least one exercise across Blocs 1–3
  const allMicroSessions = content.blocks.flatMap((b) =>
    "payload" in b && "microSessions" in b.payload ? (b.payload.microSessions ?? []) : [],
  );
  const pamInExercise = allMicroSessions.some((ms) => hasToken(ms.exercise.prompt));
  if (!pamInExercise)
    err(
      "pam.exercise",
      "blocks[].payload.microSessions[].exercise.prompt",
      `au moins un exercice doit injecter ${MOMENT_ANCRAGE_TOKEN}`,
    );

  // (2) at least one journal entry prompt (Bloc 4)
  const pamInJournal = certification?.payload.journal.entries.some((e) => hasToken(e.prompt));
  if (!pamInJournal)
    err(
      "pam.journal",
      "blocks[4].payload.journal.entries[].prompt",
      `au moins une micro-entrée de journal doit injecter ${MOMENT_ANCRAGE_TOKEN}`,
    );

  // (3) the Day +7 re-engagement message re-injects the PAM — this is a
  //     platform-level concern (same for every course), so it is enforced by the
  //     re-engagement engine (src/domain/engine/reengagement.ts, day7AnchorsPam)
  //     and its tests, not by this content-level validator.

  // (4) the Bloc 4 project brief
  if (!hasToken(certification?.payload.projectBrief))
    err(
      "pam.brief",
      "blocks[4].payload.projectBrief",
      `le sujet du Bloc 4 doit injecter ${MOMENT_ANCRAGE_TOKEN}`,
    );
  // …and Section 1 should prefill from the PAM
  const s1 = certification?.payload.sections[0];
  if (s1 && !s1.prefillFromMomentAncrage)
    warn("pam.section1", "blocks[4].payload.sections[0]", "la Section 1 devrait être pré-remplie depuis le Moment d'Ancrage");

  // --- every scored quiz question has correctKey + feedback (shape guarantees
  //     presence; here we guard against empty feedback that slipped through) ---
  comprehension?.payload.diagnosticQuiz.questions.forEach((q, i) => {
    if (!q.feedbackText.trim())
      err("quiz.feedback", `blocks[1].payload.diagnosticQuiz.questions[${i}].feedbackText`, "feedback requis");
  });
  anchoring?.payload.finalQuiz.questions.forEach((q, i) => {
    if (!q.feedbackText.trim())
      err("quiz.feedback", `blocks[3].payload.finalQuiz.questions[${i}].feedbackText`, "feedback requis");
  });

  // --- rubric weights sum to exactly 100 ---
  if (certification) {
    const sum = certification.payload.rubric.criteria.reduce((a, c) => a + c.weightPoints, 0);
    if (sum !== 100)
      err("rubric.total", "blocks[4].payload.rubric.criteria", `la somme des points de la grille doit faire 100 (actuel : ${sum})`);
  }

  // --- thresholds consistent with level ---
  const expected = LEVEL_PASS_THRESHOLD[content.level];
  if (content.passThreshold !== expected)
    err("threshold.level", "passThreshold", `seuil attendu ${expected}% pour le Niveau ${content.level} (reçu ${content.passThreshold}%)`);
  if (anchoring && anchoring.payload.finalQuiz.passThreshold !== content.passThreshold)
    err("threshold.finalQuiz", "blocks[3].payload.finalQuiz.passThreshold", `le seuil du quiz final doit valoir ${content.passThreshold}%`);
  if (certification && certification.payload.rubric.threshold !== expected)
    err("threshold.rubric", "blocks[4].payload.rubric.threshold", `le seuil de la grille doit valoir ${expected}% pour le Niveau ${content.level}`);

  // --- every badge has at least one completion condition (shape guarantees ≥1;
  //     this guards against whitespace-only conditions) ---
  content.blocks.forEach((b, i) => {
    if (!b.badge.conditions.some((c) => c.trim()))
      err("badge.conditions", `blocks[${i}].badge.conditions`, "chaque badge exige au moins une condition de complétion");
  });

  const publishable = !issues.some((i) => i.level === "error");
  return { publishable, issues };
}

/** Convenience: shape + policy in one call. */
export function validateCourse(input: unknown): {
  shape: ShapeResult;
  policy?: PolicyResult;
} {
  const shape = validateShape(input);
  if (!shape.ok) return { shape };
  return { shape, policy: validatePolicy(shape.content) };
}
