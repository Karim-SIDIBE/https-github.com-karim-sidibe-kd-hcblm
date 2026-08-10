/**
 * content-model.ts — THE CONTRACT.
 *
 * A single Zod definition of the K-HCBLM course content document. It is the
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
    /// Suggestion affichée dans le champ vide (« ex. … ») — première tentative.
    placeholder: z.string().optional(),
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
  /** Optional: a video-only micro-session (e.g. one that chains straight into a
   *  long activity, like « Productivité hybride » → Cas transversal Sylvie). */
  exercise: Exercise.optional(),
});
export type MicroSession = z.infer<typeof MicroSession>;

// ---------------------------------------------------------------------------
// Case study (structured) — Bloc 1 « Nadia » and the Bloc 3 transversal case.
// Steps carry real questions (MCQ with feedback + open reflections whose
// answers are saved for the Bloc 4 certification project), per the course
// énoncés — not just a free-text transfer analysis.
// ---------------------------------------------------------------------------

const CaseQuestion = z.object({
  id: nonEmpty("id de question"),
  kind: z.enum(["mcq", "open"]),
  prompt: injectable, // supports {{moment_ancrage}}
  // mcq:
  options: z.array(Option).min(2).optional(),
  correctKey: OptionKey.optional(),
  /** All answers are valid (profile-dependent choice) — no ✗/✓ marks. */
  allValid: z.boolean().default(false),
  feedback: z.string().default(""),
  // open:
  minChars: z.number().int().positive().optional(),
  /** Suggestion affichée dans la zone de réponse vide (« ex. … »). */
  placeholder: z.string().optional(),
  /** Open answer re-used in the Bloc 4 certification project. */
  savedForProject: z.boolean().default(false),
});
export type CaseQuestion = z.infer<typeof CaseQuestion>;

const CaseStep = z.object({
  title: nonEmpty("titre d'étape"),
  durationEstimate: z.string().default(""),
  intro: z.string().default(""),
  questions: z.array(CaseQuestion).default([]),
});
export type CaseStep = z.infer<typeof CaseStep>;

export const CaseStudy = z.object({
  /** Learner-facing activity label (e.g. « Activité longue — Étude de cas »). */
  title: nonEmpty("titre"),
  /** The case line itself (e.g. « Nadia : compétente, épuisée… »). */
  subtitle: z.string().default(""),
  context: z.string().default(""),
  durationEstimate: z.string().default(""),
  /** Legacy free-text steps (pre-v2.1 content) — superseded by structuredSteps. */
  steps: z.array(z.string()).default([]),
  structuredSteps: z.array(CaseStep).default([]),
  /** « Résumé des apprentissages clés » shown once the case is completed. */
  summary: z.array(nonEmpty("apprentissage clé")).default([]),
});
export type CaseStudy = z.infer<typeof CaseStudy>;

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
  /** Bandes du quiz diagnostique cohérentes avec cet archétype (Pilier 2 :
   *  quand le diagnostic tombe hors de ces bandes, l'interface énonce
   *  explicitement l'écart — le diagnostic fait autorité). Optionnel : sans
   *  correspondance déclarée, l'écart n'est pas affirmé. */
  consistentBands: z.array(nonEmpty("bande cohérente")).optional(),
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
    /// numeric | short : suggestion affichée dans le champ de saisie vide.
    placeholder: z.string().optional(),
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
export { profileDivergence, type ProfileDivergence, type SelfProfileChoice } from "./profile.js";

/** Optional random draw from the question bank, materialised per learner at
 *  bundle time (so each learner gets a different set; stays offline-capable). */
export const QuestionPool = z.object({
  subArea: z.string().optional(),
  draw: z.number().int().min(1).max(50),
});
export type QuestionPool = z.infer<typeof QuestionPool>;

const DiagnosticQuiz = z.object({
  /** Learner-facing title; empty ⇒ the app's default label ("Quiz diagnostique"). */
  title: z.string().default(""),
  /** Learner-facing effort estimate ("15 min"); empty ⇒ computed from questions. */
  durationEstimate: z.string().default(""),
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
  /** Learner-facing effort estimate of MS 0.2 (vidéo déclencheur + quiz) —
   *  wins over the raw video runtime in the course list ("10 min"). */
  triggerDuration: z.string().default(""),
  triggerQuiz: TriggerQuiz,
  progressPeer: z.object({ mandatory: z.literal(true) }).default({ mandatory: true }),
});

const ComprehensionPayload = z.object({
  diagnosticQuiz: DiagnosticQuiz, // runs BEFORE the videos
  microSessions: z.array(MicroSession).min(1),
  caseStudy: CaseStudy.optional(),
});

const PracticePayload = z.object({
  microSessions: z.array(MicroSession).min(1),
  /** Learner-facing title of the guided-scenarios activity; empty ⇒ default label. */
  guidedScenariosTitle: z.string().default(""),
  /** Learner-facing effort estimate of the guided-scenarios activity ("21 min"). */
  guidedScenariosDuration: z.string().default(""),
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
      durationEstimate: z.string().default(""),
      scored: z.literal(false).default(false),
      questions: z.array(ScoredQuestion).min(1),
      pool: QuestionPool.optional(),
    })
    .optional(),
  fieldApplication: z.object({
    /** Learner-facing title; empty ⇒ the app's default label ("Application terrain"). */
    title: z.string().default(""),
    durationEstimate: z.string().default(""),
    brief: injectable, // {{moment_ancrage}}
    /** Optional guided structure (étapes with labelled fields, per the énoncé).
     *  When present the learner fills the fields instead of one free textarea. */
    steps: z
      .array(
        z.object({
          title: nonEmpty("titre d'étape"),
          intro: z.string().default(""), // supports {{moment_ancrage}}
          fields: z.array(z.object({ label: nonEmpty("intitulé du champ"), placeholder: z.string().default("") })).min(1),
        }),
      )
      .optional(),
    minChars: z.number().int().positive().default(200),
    gatesNextBlock: z.boolean().default(true),
  }),
});

const AnchoringPayload = z.object({
  microSessions: z.array(MicroSession).min(1),
  /** « Cas transversal de synthèse » (e.g. Sylvie à Abidjan) — a required long
   *  activity of the block when present. Same structured shape as the Bloc 1
   *  case study. */
  transversalCase: CaseStudy.optional(),
  selfAssessment: z.object({
    /** Learner-facing title; empty ⇒ the app's default label ("Auto-évaluation"). */
    title: z.string().default(""),
    durationEstimate: z.string().default(""),
    criteria: z.array(nonEmpty("critère")).min(1),
    scale: z.array(nonEmpty("niveau d'échelle")).min(2),
  }),
  actionPlan30d: z.object({
    /** Learner-facing title; empty ⇒ the app's default label ("Plan d'action 30 jours"). */
    title: z.string().default(""),
    durationEstimate: z.string().default(""),
    /** Intro line above the habits (e.g. « pré-rempli — complétez et ajustez »). */
    intro: z.string().default(""),
    habits: z
      .array(
        z.object({
          title: nonEmpty("titre d'habitude"),
          /// Chaîne simple (historique) OU { label, placeholder } pour porter la
          /// suggestion affichée dans le champ vide — rétro-compatible.
          fields: z
            .array(z.union([nonEmpty("champ"), z.object({ label: nonEmpty("champ"), placeholder: z.string().default("") })]))
            .min(1),
        }),
      )
      .min(1),
  }),
  finalQuiz: z.object({
    /** Learner-facing title; empty ⇒ the app's default label ("Quiz final"). */
    title: z.string().default(""),
    durationEstimate: z.string().default(""),
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
        /** Learner-facing effort estimate shown in the course list ("15 min"). */
        durationEstimate: z.string().default(""),
        prefillFromMomentAncrage: z.boolean().default(false),
      }),
    )
    .length(5, "exactement 5 sections de projet"),
  journal: z.object({
    entries: z
      .array(
        z.object({
          /// Day offset of the push (designer-declared, e.g. J+2 → J+15). Was a
          /// fixed 1/3/5/7/10/14 literal set — relaxed so the cadence is content.
          day: z.number().int().min(1).max(60),
          prompt: injectable, // {{moment_ancrage}}
          minWords: z.number().int().min(1).default(50),
          /// Suggestion affichée dans la zone de réponse vide.
          placeholder: z.string().optional(),
        }),
      )
      .length(6, "exactement 6 micro-entrées de journal (2 semaines)")
      .superRefine((entries, ctx) => {
        for (let i = 1; i < entries.length; i++) {
          if (entries[i]!.day <= entries[i - 1]!.day)
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, "day"], message: "les jours du journal doivent être strictement croissants" });
        }
      }),
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
// Unit typology (K-HCBLM v2.1, Corrections 2-4) — auditable per-block counts.
// Designer-declared so the totals never mix unit types and stay auditable.
// ---------------------------------------------------------------------------

export const UnitType = z.enum(["micro-session", "long-activity", "micro-task"]);
export type UnitType = z.infer<typeof UnitType>;

/** Delivery mode of a long activity (K-HCBLM v2.2, amendement A2) :
 *  `continuous` = one 25–40 min sitting ; `distributed` = the same load split
 *  into platform-pushed micro-tasks (children) over a defined period. */
export const LongActivityMode = z.enum(["continuous", "distributed"]);
export type LongActivityMode = z.infer<typeof LongActivityMode>;

const SubUnit = z.object({
  label: nonEmpty("intitulé de l'unité"),
  type: UnitType,
  durationMin: z.number().int().positive().optional(),
});
export const BlockUnit = SubUnit.extend({
  /** A2 — long activities only. Optional for backward compatibility ; a unit
   *  with micro-task children reads as distributed by default. */
  mode: LongActivityMode.optional(),
  /** Sub-units nested under this unit — e.g. the 6 journal micro-entries that
   *  compose the distributed "Journal des 2 semaines" long activity
   *  (6 × 5 min = 30 min). One level deep; counted in the micro-task column
   *  (they never add course units of another type), displayed indented. */
  children: z.array(SubUnit).optional(),
});
export type BlockUnit = z.infer<typeof BlockUnit>;

const BlockBase = z.object({
  title: nonEmpty("titre du bloc"),
  objective: z.string().default(""),
  durationEstimate: z.string().default(""),
  /// Carte de rappel des apprentissages clés (K-HCBLM v2.2, Pilier 6.2) : 3
  /// points consultables en 2 minutes avant la reprise. N'est PAS une
  /// micro-session et n'entre jamais dans le comptage des unités.
  recallCard: z.array(nonEmpty("point de rappel")).length(3, "exactement 3 points de rappel").optional(),
  /// Explicit, designer-declared units for auditable counting (v2.1). Optional
  /// for backward compatibility; when absent the block shows no breakdown.
  units: z.array(BlockUnit).optional(),
  /// Author-declared DISPLAY ORDER of the block's learner-facing items (item
  /// keys, e.g. ["3.1","self","3.2","plan","final"]). Absent/empty ⇒ the
  /// canonical order. Keys not listed keep their relative order, appended after
  /// the listed ones; unknown keys are ignored — so the arrangement survives
  /// content edits. Purely presentational: block gating is order-independent.
  itemOrder: z.array(z.string()).optional(),
  /// Author-declared DISPLAY GROUPS: consecutive items whose keys are listed
  /// render indented under a shared header (e.g. « Activité Expérientielle
  /// Longue — Productivité hybride » = vidéo 3.2 + cas Sylvie + auto-éval).
  /// Purely presentational; unknown keys are ignored.
  itemGroups: z
    .array(
      z.object({
        title: nonEmpty("titre du groupe"),
        /** Free duration label shown on the header (e.g. "5 + 20 + 10 min");
         *  empty ⇒ the renderer sums the member durations. */
        durationLabel: z.string().default(""),
        keys: z.array(z.string()).min(1),
      }),
    )
    .optional(),
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
type CountableUnit = { type: string; children?: { type: string }[] };
export function blockUnitCounts(units?: CountableUnit[] | null): UnitCounts {
  const c: UnitCounts = { microSessions: 0, longActivities: 0, microTasks: 0 };
  const add = (t: string) => {
    if (t === "micro-session") c.microSessions++;
    else if (t === "long-activity") c.longActivities++;
    else if (t === "micro-task") c.microTasks++;
  };
  for (const u of units ?? []) {
    add(u.type);
    for (const child of u.children ?? []) add(child.type); // nested units stay auditable
  }
  return c;
}
export function courseUnitTotals(blocks: { units?: CountableUnit[] | null }[]): UnitCounts {
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
  /// ("à la fin, vous saurez…"). Shown in Bloc 0 BEFORE the structure (K-HCBLM
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
