/**
 * content-model.ts — THE CONTRACT.
 *
 * A single Zod definition of the KD-HCBLM course content document. It is the
 * one source of truth shared (now on the server; later via packages/shared) by:
 *   1. the Learning Designer authoring form (field shapes + per-field validation),
 *   2. the publish-time "non-negotiable rules" engine (validation.ts),
 *   3. the learner renderer (the hf-* components) and learner API.
 *
 * The model is FIXED across Levels 1–3 — only values change. Levels differ only
 * by `level`, the Bloc 3 `passThreshold` (70/75/80) and the Bloc 4 rubric
 * threshold, plus content depth.
 *
 * Authored free-text fields may contain the token `{{moment_ancrage}}`, which
 * the engine substitutes with the learner's captured PAM text at render time.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const MOMENT_ANCRAGE_TOKEN = "{{moment_ancrage}}";

/** Non-empty trimmed string. */
const nonEmpty = (label = "champ") =>
  z.string().trim().min(1, `${label} requis`);

/** A free-text field that may embed {{moment_ancrage}}. */
const injectable = z.string();

export const BlockType = z.enum([
  "ONBOARDING", // Bloc 0
  "COMPREHENSION", // Bloc 1
  "PRACTICE", // Bloc 2
  "ANCHORING", // Bloc 3
  "CERTIFICATION", // Bloc 4
]);
export type BlockType = z.infer<typeof BlockType>;

export const BadgeType = z.enum([
  "ENTRY",
  "COMPREHENSION",
  "PRACTICE",
  "ANCHORING",
  "CERTIFICATE",
]);

export const ExerciseType = z.enum(["multi", "written", "guidedForm"]);
export type ExerciseType = z.infer<typeof ExerciseType>;

/** Option key A–D used throughout the quiz builders. */
export const OptionKey = z.enum(["A", "B", "C", "D"]);

const Option = z.object({
  key: OptionKey,
  label: nonEmpty("intitulé d'option"),
});

const ProfileBand = z.object({
  scoreRange: z.tuple([z.number().int(), z.number().int()]),
  name: nonEmpty("nom de profil"),
  description: z.string().default(""),
});

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

export const Video = z.object({
  title: nonEmpty("titre de la vidéo"),
  url: z.string().url().or(z.literal("")).default(""), // placeholder allowed pre-upload
  /// Optional binding to a MediaAsset (adaptive renditions + offline download).
  mediaId: z.string().optional(),
  durationSec: z.number().int().positive(),
  subtitlesUrl: z.string().url().optional(),
  keyMessage: z.string().default(""),
  africanExample: z.string().default(""),
  errorToAvoid: z.string().default(""),
  scriptText: z.string().default(""),
});
export type Video = z.infer<typeof Video>;

// ---------------------------------------------------------------------------
// Exercise (used inside MicroSession; type-switched)
// ---------------------------------------------------------------------------

export const Exercise = z
  .object({
    type: ExerciseType,
    prompt: injectable, // supports {{moment_ancrage}}
    feedbackText: nonEmpty("feedback"), // explicit, always shown in full
    // multi:
    options: z.array(Option).min(2).optional(),
    correctKey: OptionKey.optional(),
    // written:
    minChars: z.number().int().positive().optional(),
    // guidedForm:
    fields: z
      .array(
        z.object({
          label: nonEmpty("intitulé du champ"),
          placeholder: z.string().default(""),
          prefillFromMomentAncrage: z.boolean().default(false),
        }),
      )
      .optional(),
  })
  .superRefine((ex, ctx) => {
    if (ex.type === "multi") {
      if (!ex.options || ex.options.length < 2)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "un exercice « multi » exige au moins 2 options",
        });
      if (!ex.correctKey)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["correctKey"],
          message: "un exercice « multi » exige une bonne réponse (correctKey)",
        });
      if (ex.options && ex.correctKey && !ex.options.some((o) => o.key === ex.correctKey))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["correctKey"],
          message: "correctKey doit correspondre à l'une des options",
        });
    }
    if (ex.type === "guidedForm" && (!ex.fields || ex.fields.length === 0))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fields"],
        message: "un exercice « guidedForm » exige au moins un champ",
      });
  });
export type Exercise = z.infer<typeof Exercise>;

// ---------------------------------------------------------------------------
// MicroSession (reused across Blocs 1–3)
// ---------------------------------------------------------------------------

export const MicroSession = z.object({
  id: nonEmpty("identifiant de session"), // "1.1"
  title: nonEmpty("titre de session"),
  durationEstimate: nonEmpty("durée estimée"),
  summaryPoints: z.array(nonEmpty("point clé")).length(3, "exactement 3 points clés"),
  video: Video,
  exercise: Exercise,
});
export type MicroSession = z.infer<typeof MicroSession>;

// ---------------------------------------------------------------------------
// Quiz builders
// ---------------------------------------------------------------------------

/** Non-scored trigger quiz (Bloc 0) — 5 questions that enrich the profile. */
const TriggerQuiz = z.object({
  questions: z
    .array(
      z.object({
        id: nonEmpty("id de question"),
        text: nonEmpty("texte de la question"),
        options: z.array(Option).min(2),
      }),
    )
    .min(1),
});

/**
 * Bloc 0 "Profil de gestion du temps" — the self-identification step. The learner
 * picks one of these descriptions (A–D). Distinct from the trigger quiz and from
 * the Bloc 1 diagnostic score bands.
 */
const ProfileChoice = z.object({
  key: OptionKey,
  name: nonEmpty("nom de profil"),
  description: nonEmpty("description du profil"),
});

/** Scored question kinds. `single` (default) is the historical single-answer
 *  MCQ — content without a `type` parses as `single`, so all existing courses
 *  stay valid with zero migration. */
export const QuestionType = z.enum(["single", "multiple", "truefalse", "numeric", "short"]);
export type QuestionType = z.infer<typeof QuestionType>;

/**
 * Scored quiz question. Single-answer MCQ by default (backward-compatible);
 * `type` unlocks multiple-select, true/false and numeric questions. Per-type
 * required fields are enforced by the refinement below.
 */
export const ScoredQuestion = z
  .object({
    id: nonEmpty("id de question"),
    scenarioText: nonEmpty("scénario"),
    feedbackText: nonEmpty("feedback"),
    subArea: z.string().optional(),
    /// Profiling question (e.g. self-positioning): all answers are valid and
    /// reveal a profile. Not graded right/wrong; excluded from priorities.
    profiling: z.boolean().optional(),
    type: QuestionType.optional(), // absent ⇒ "single" (legacy MCQ — zero migration)
    options: z.array(Option).min(2).optional(), // single | multiple
    correctKey: OptionKey.optional(), // single
    correctKeys: z.array(OptionKey).min(1).optional(), // multiple
    correctBool: z.boolean().optional(), // truefalse
    answerNumber: z.number().optional(), // numeric
    tolerance: z.number().nonnegative().optional(), // numeric (± accepted, default 0)
    accepted: z.array(z.string().trim().min(1)).min(1).optional(), // short (accepted answers)
  })
  .superRefine((q, ctx) => {
    const ty = q.type ?? "single"; // absent ⇒ single
    const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (ty === "single" || ty === "multiple") {
      if (!q.options || q.options.length < 2) issue("options", "au moins 2 options requises");
    }
    if (q.profiling) return; // profiling: no correct answer to enforce
    if (ty === "single") {
      if (!q.correctKey) issue("correctKey", "une bonne réponse (correctKey) est requise");
      else if (q.options && !q.options.some((o) => o.key === q.correctKey)) issue("correctKey", "correctKey doit correspondre à une option");
    } else if (ty === "multiple") {
      if (!q.correctKeys || q.correctKeys.length < 1) issue("correctKeys", "au moins une bonne réponse (correctKeys)");
      else if (q.options && !q.correctKeys.every((k) => q.options!.some((o) => o.key === k))) issue("correctKeys", "chaque réponse doit correspondre à une option");
    } else if (ty === "truefalse") {
      if (typeof q.correctBool !== "boolean") issue("correctBool", "une réponse vrai/faux (correctBool) est requise");
    } else if (ty === "numeric") {
      if (q.answerNumber == null || !Number.isFinite(q.answerNumber)) issue("answerNumber", "une réponse numérique (answerNumber) est requise");
    } else if (ty === "short") {
      if (!q.accepted || q.accepted.length < 1) issue("accepted", "au moins une réponse acceptée (accepted)");
    }
  });
export type ScoredQuestion = z.infer<typeof ScoredQuestion>;

// Scoring helpers live in a zod-free module (so the learner PWA imports them
// without bundling zod). Re-exported here for the server's `export *` surface.
export { isAnswerCorrect, type ScorableQuestion } from "./scoring.js";

/** Optional random draw from the question bank, materialised per learner at
 *  bundle time (so each learner gets a different set; stays offline-capable). */
export const QuestionPool = z.object({
  subArea: z.string().optional(),
  draw: z.number().int().min(1).max(50),
});
export type QuestionPool = z.infer<typeof QuestionPool>;

const DiagnosticQuiz = z.object({
  questions: z.array(ScoredQuestion).min(1),
  profiles: z.array(ProfileBand).min(1),
  pool: QuestionPool.optional(),
});

// ---------------------------------------------------------------------------
// Block badge
// ---------------------------------------------------------------------------

const BlockBadge = z.object({
  type: BadgeType,
  label: nonEmpty("intitulé du badge"),
  conditions: z.array(nonEmpty("condition")).min(1, "au moins une condition de complétion"),
});

// ---------------------------------------------------------------------------
// Block payloads (one per fixed type)
// ---------------------------------------------------------------------------

const OnboardingPayload = z.object({
  momentAncrage: z.object({
    promptText: nonEmpty("prompt du Moment d'Ancrage"),
    minChars: z.number().int().positive().default(50),
    placeholderExample: z.string().default(""),
  }),
  /** Self-identification profiles (A–D in the Niveau 1 course). */
  profileChoices: z.array(ProfileChoice).min(2, "au moins 2 profils à identifier"),
  triggerVideo: Video,
  triggerQuiz: TriggerQuiz,
  progressPeer: z.object({ mandatory: z.literal(true) }).default({ mandatory: true }),
});

const ComprehensionPayload = z.object({
  diagnosticQuiz: DiagnosticQuiz, // runs BEFORE the videos
  microSessions: z.array(MicroSession).min(1),
  caseStudy: z
    .object({ title: nonEmpty("titre"), steps: z.array(z.string()).min(1) })
    .optional(),
});

const PracticePayload = z.object({
  microSessions: z.array(MicroSession).min(1),
  guidedScenarios: z
    .array(
      z.object({
        title: nonEmpty("titre du scénario"),
        contextAfricain: z.string().default(""),
        steps: z.array(
          z.object({
            question: nonEmpty("question"),
            options: z.array(Option).min(2),
            correctKey: OptionKey,
            feedback: nonEmpty("feedback"),
          }),
        ),
      }),
    )
    .default([]),
  /**
   * Optional non-scored inter-block quiz (consolidates Blocs 1–2 before the
   * field application). Questions carry correct keys + immediate feedback, but
   * the quiz is not graded for gating.
   */
  interBlockQuiz: z
    .object({
      title: z.string().default(""),
      scored: z.literal(false).default(false),
      questions: z.array(ScoredQuestion).min(1),
      pool: QuestionPool.optional(),
    })
    .optional(),
  fieldApplication: z.object({
    brief: injectable, // {{moment_ancrage}}
    minChars: z.number().int().positive().default(200),
    gatesNextBlock: z.boolean().default(true),
  }),
});

const AnchoringPayload = z.object({
  microSessions: z.array(MicroSession).min(1),
  selfAssessment: z.object({
    criteria: z.array(nonEmpty("critère")).min(1),
    scale: z.array(nonEmpty("niveau d'échelle")).min(2),
  }),
  actionPlan30d: z.object({
    habits: z
      .array(
        z.object({
          title: nonEmpty("titre d'habitude"),
          fields: z.array(nonEmpty("champ")).min(1),
        }),
      )
      .min(1),
  }),
  finalQuiz: z.object({
    questions: z.array(ScoredQuestion).min(1),
    passThreshold: z.number().int().min(0).max(100),
    pool: QuestionPool.optional(),
  }),
});

const CertificationPayload = z.object({
  projectBrief: injectable, // {{moment_ancrage}}
  sections: z
    .array(
      z.object({
        title: nonEmpty("titre de section"),
        helpText: z.string().default(""),
        prefillFromMomentAncrage: z.boolean().default(false),
      }),
    )
    .length(5, "exactement 5 sections de projet"),
  journal: z.object({
    entries: z
      .array(
        z.object({
          day: z.union([
            z.literal(1),
            z.literal(3),
            z.literal(5),
            z.literal(7),
            z.literal(10),
            z.literal(14),
          ]),
          prompt: injectable, // {{moment_ancrage}}
          minWords: z.number().int().min(1).default(50),
        }),
      )
      .length(6, "exactement 6 micro-entrées de journal (J+1 → J+14)"),
  }),
  rubric: z.object({
    criteria: z
      .array(
        z.object({
          label: nonEmpty("intitulé du critère"),
          competencyCode: z.string().default(""),
          weightPoints: z.number().int().positive(),
        }),
      )
      .min(1),
    totalPoints: z.literal(100),
    threshold: z.number().int().min(0).max(100),
  }),
  evaluation: z.object({
    humanEvaluator: z.literal(true).default(true),
    turnaroundDays: z.number().int().positive().default(5),
    adminAlertAtDay: z.number().int().positive().default(5),
  }),
});

// ---------------------------------------------------------------------------
// Block — discriminated by type/index, payload keyed under `payload`
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Unit typology (KD-HCBLM v2.1, Corrections 2-4) — auditable per-block counts.
// Designer-declared so the totals never mix unit types and stay auditable.
// ---------------------------------------------------------------------------

export const UnitType = z.enum(["micro-session", "long-activity", "micro-task"]);
export type UnitType = z.infer<typeof UnitType>;

export const BlockUnit = z.object({
  label: nonEmpty("intitulé de l'unité"),
  type: UnitType,
  durationMin: z.number().int().positive().optional(),
});
export type BlockUnit = z.infer<typeof BlockUnit>;

const BlockBase = z.object({
  title: nonEmpty("titre du bloc"),
  objective: z.string().default(""),
  durationEstimate: z.string().default(""),
  /// Explicit, designer-declared units for auditable counting (v2.1). Optional
  /// for backward compatibility; when absent the block shows no breakdown.
  units: z.array(BlockUnit).optional(),
  badge: BlockBadge,
});

export const Block = z.discriminatedUnion("type", [
  BlockBase.extend({ index: z.literal(0), type: z.literal("ONBOARDING"), payload: OnboardingPayload }),
  BlockBase.extend({ index: z.literal(1), type: z.literal("COMPREHENSION"), payload: ComprehensionPayload }),
  BlockBase.extend({ index: z.literal(2), type: z.literal("PRACTICE"), payload: PracticePayload }),
  BlockBase.extend({ index: z.literal(3), type: z.literal("ANCHORING"), payload: AnchoringPayload }),
  BlockBase.extend({ index: z.literal(4), type: z.literal("CERTIFICATION"), payload: CertificationPayload }),
]);
export type Block = z.infer<typeof Block>;

/** Per-block / whole-course unit counts, kept strictly separated by type. */
export type UnitCounts = { microSessions: number; longActivities: number; microTasks: number };
export function blockUnitCounts(units?: { type: string }[] | null): UnitCounts {
  const c: UnitCounts = { microSessions: 0, longActivities: 0, microTasks: 0 };
  for (const u of units ?? []) {
    if (u.type === "micro-session") c.microSessions++;
    else if (u.type === "long-activity") c.longActivities++;
    else if (u.type === "micro-task") c.microTasks++;
  }
  return c;
}
export function courseUnitTotals(blocks: { units?: { type: string }[] | null }[]): UnitCounts {
  return blocks.reduce<UnitCounts>((acc, b) => {
    const c = blockUnitCounts(b.units);
    return { microSessions: acc.microSessions + c.microSessions, longActivities: acc.longActivities + c.longActivities, microTasks: acc.microTasks + c.microTasks };
  }, { microSessions: 0, longActivities: 0, microTasks: 0 });
}

// ---------------------------------------------------------------------------
// Course (the full content document)
// ---------------------------------------------------------------------------

export const CourseContent = z.object({
  title: nonEmpty("titre du parcours"),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  language: z.literal("fr").default("fr"),
  domain: z.object({
    code: nonEmpty("code de domaine"), // "D4"
    label: nonEmpty("libellé de domaine"),
  }),
  competencies: z
    .array(z.object({ code: nonEmpty("code"), label: nonEmpty("libellé") }))
    .min(1),
  summary: z.string().default(""),
  /// Course objective, framed as a benefit and tied to the Moment d'Ancrage
  /// ("à la fin, vous saurez…"). Shown in Bloc 0 BEFORE the structure (KD-HCBLM
  /// v2.1, Correction 1). Optional for backward compatibility.
  objective: z.string().default(""),
  audience: z.string().default(""),
  durationEstimate: z.string().default(""),
  passThreshold: z.number().int().min(0).max(100), // Bloc 3 final quiz
  certificate: z.object({
    title: nonEmpty("titre du certificat"),
    openBadges2: z.literal(true).default(true),
    verificationUrlPattern: z.string().default(""),
  }),
  blocks: z.array(Block),
});
export type CourseContent = z.infer<typeof CourseContent>;

/** Threshold expected for a given level (engine + validation use this). */
export const LEVEL_PASS_THRESHOLD: Record<1 | 2 | 3, number> = {
  1: 70,
  2: 75,
  3: 80,
};
