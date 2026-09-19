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
import { bandContiguityIssues, nonCompensationCheck } from "./engine/certification.js";
import { referentielDomain, REFERENTIEL_VERSION } from "./referentiel.js";

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
  const pamInExercise = allMicroSessions.some((ms) => hasToken(ms.exercise?.prompt));
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

    // --- Gabarit d'annexe §4 (contrôles avant chargement) — grille à bandes ---
    const criteria = certification.payload.rubric.criteria;
    criteria.forEach((c, i) => {
      if (c.minPoints != null && c.minPoints > c.weightPoints)
        err("rubric.minPoints", `blocks[4].payload.rubric.criteria[${i}]`, `minimum (${c.minPoints}) supérieur à la pondération (${c.weightPoints})`);
      if (c.bands?.length) {
        for (const issue of bandContiguityIssues(c))
          err("rubric.bands", `blocks[4].payload.rubric.criteria[${i}].bands`, `« ${c.label} » : ${issue}`);
      }
    });
    // Non-compensation (socle §2.3) : le maximum atteignable au strict minimum
    // doit rester SOUS le seuil, sinon la certification attesterait d'une
    // compétence non démontrée.
    if (criteria.some((c) => c.minPoints != null)) {
      const nc = nonCompensationCheck(criteria, certification.payload.rubric.threshold);
      if (!nc.ok)
        err("rubric.nonCompensation", "blocks[4].payload.rubric.criteria", `non-compensation : ${nc.minimumsSum} (minimums) + ${nc.freeSum} (bloc libre) = ${nc.maxAtStrictMinimums} ≥ seuil ${certification.payload.rubric.threshold} — répartition à revoir`);
    }

    // --- Socle v1.2 (avenant n°1, objets A et C — applicable au 01/11/2026) ---
    // Structure de grille : bloc domaine de 60 points également répartis aux
    // TROIS niveaux ; au Niveau 3, S4 est financé par S1, S2 et S3.
    const isSocle = (c: (typeof criteria)[number]) => c.origin === "socle" || /^S[1-5]\b/.test(c.label.trim());
    const domainCrit = criteria.filter((c) => !isSocle(c));
    const socleCrit = criteria.filter(isSocle);
    const path = "blocks[4].payload.rubric.criteria";
    if (domainCrit.length && socleCrit.length) {
      const domSum = domainCrit.reduce((a, c) => a + c.weightPoints, 0);
      if (domSum !== 60)
        err("rubric.domainBlock", path, `objet A : le bloc domaine vaut 60 points aux trois niveaux (actuel : ${domSum})`);
      if (new Set(domainCrit.map((c) => c.weightPoints)).size > 1)
        err("rubric.domainEqualSplit", path, "objet A.3 : les 60 points du bloc domaine se répartissent ÉGALEMENT entre les compétences du domaine");
      for (const c of domainCrit) {
        const expectedMin = Math.ceil(c.weightPoints / 2);
        if (c.minPoints !== expectedMin)
          err("rubric.domainMin", path, `« ${c.label} » : minimum non compensable attendu à 50 % de la pondération, arrondi à l'unité supérieure (${expectedMin} — reçu ${c.minPoints ?? "aucun"})`);
      }

      // Pondérations du socle par niveau (objet A.2) — S5 est propre à FACE2FACE.
      const S = (n: number) => socleCrit.find((c) => new RegExp(`^S${n}\\b`).test(c.label.trim()));
      const expected: [number, number, number | null][] = content.level === 3
        ? [[4, 15, 8], [1, 10, 5], [2, 10, null], [3, 5, null]]
        : [[1, 15, 8], [2, 15, null], [3, 10, null]];
      for (const [n, weight, min] of expected) {
        const c = S(n);
        if (!c) { err("rubric.socleMissing", path, `critère S${n} du socle absent (requis au Niveau ${content.level})`); continue; }
        if (c.weightPoints !== weight)
          err("rubric.socleWeight", path, `« ${c.label} » : ${weight} points attendus au Niveau ${content.level} (objet A.2 — reçu ${c.weightPoints})`);
        if ((c.minPoints ?? null) !== min)
          err("rubric.socleMin", path, `« ${c.label} » : minimum attendu ${min ?? "aucun"} au Niveau ${content.level} (objet A.2 — reçu ${c.minPoints ?? "aucun"})`);
      }
      if (content.level !== 3 && S(4))
        err("rubric.s4Level", path, "S4 — Transmission de la pratique est réservé au Niveau 3");

      // Objet C — ordre de notation : les critères de domaine d'abord, puis S4
      // le cas échéant, puis S1, S2 et S3 (la fiche de notation suit la grille).
      const rank = (c: (typeof criteria)[number]) => {
        if (!isSocle(c)) return 0;
        const m = /^S(\d)/.exec(c.label.trim());
        return ({ 4: 1, 1: 2, 2: 3, 3: 4 } as Record<number, number>)[Number(m?.[1])] ?? 5;
      };
      const ranks = criteria.map(rank);
      if (ranks.some((r, i) => i > 0 && r < ranks[i - 1]!))
        err("rubric.order", path, "objet C : ordre de notation attendu — critères du domaine, puis S4 le cas échéant, puis S1, S2, S3");

      // Référentiel v3.0 — cartographie des compétences du domaine. Signalé en
      // AVERTISSEMENT tant que l'annexe en vigueur (antérieure au référentiel
      // v3.0, applicable au 01/11/2026) n'est pas révisée : la grille publiée
      // reste valable, la prochaine version du parcours devra se conformer.
      const dom = referentielDomain(content.domain.code);
      if (dom) {
        const domainCodes = new Set(dom.competencies.map((c) => c.code));
        for (const c of domainCrit) {
          if (c.competencyCode && !domainCodes.has(c.competencyCode))
            warn("rubric.refCode", path, `« ${c.label} » : code ${c.competencyCode} inconnu du domaine ${dom.code} au référentiel v${REFERENTIEL_VERSION}`);
        }
        const covered = new Set(domainCrit.map((c) => c.competencyCode).filter(Boolean));
        for (const comp of dom.competencies) {
          if (!covered.has(comp.code))
            warn("rubric.refCoverage", path, `référentiel v${REFERENTIEL_VERSION} : la compétence ${comp.code} — ${comp.label} n'a pas de critère de domaine dédié (répartition égale des 60 points attendue à la prochaine révision de l'annexe)`);
        }
        // Objet C (non-chevauchement) : un critère du socle ne PORTE pas une
        // compétence du domaine — deux critères ne se fondent pas sur la même
        // preuve. La correction se fait à la conception du descripteur.
        for (const c of socleCrit) {
          if (c.competencyCode && domainCodes.has(c.competencyCode))
            warn("rubric.overlap", path, `objet C : « ${c.label} » porte le code de la compétence de domaine ${c.competencyCode} — zone de recouvrement à traiter à la conception (paragraphe de distinction requis dans l'annexe)`);
        }
      } else {
        warn("rubric.refDomain", "domain.code", `domaine ${content.domain.code} inconnu du référentiel v${REFERENTIEL_VERSION}`);
      }
    }
  }

  // --- thresholds consistent with level ---
  const expected = LEVEL_PASS_THRESHOLD[content.level];
  if (content.passThreshold !== expected)
    err("threshold.level", "passThreshold", `seuil attendu ${expected}% pour le Niveau ${content.level} (reçu ${content.passThreshold}%)`);
  if (anchoring && anchoring.payload.finalQuiz.passThreshold !== content.passThreshold)
    err("threshold.finalQuiz", "blocks[3].payload.finalQuiz.passThreshold", `le seuil du quiz final doit valoir ${content.passThreshold}%`);
  // Socle commun d'évaluation v1.1 (§1) : le seuil de certification est de
  // 70 points À TOUS LES NIVEAUX — l'exigence monte par les descripteurs et
  // les minimums, pas par le seuil. (Le 70/75/80 par niveau ne s'applique
  // qu'au quiz final du Bloc 3, ci-dessus.)
  if (certification && certification.payload.rubric.threshold !== 70)
    err("threshold.rubric", "blocks[4].payload.rubric.threshold", `le seuil de la grille certifiante est de 70 points à tous les niveaux (socle §1 — reçu ${certification.payload.rubric.threshold})`);

  // --- every badge has at least one completion condition (shape guarantees ≥1;
  //     this guards against whitespace-only conditions) ---
  content.blocks.forEach((b, i) => {
    if (!b.badge.conditions.some((c) => c.trim()))
      err("badge.conditions", `blocks[${i}].badge.conditions`, "chaque badge exige au moins une condition de complétion");
  });

  // --- K-HCBLM v2.2, amendement A2 — contrôle d'auditabilité : la somme des
  //     durées des micro-tâches d'une activité distribuée doit être égale à la
  //     durée annoncée de l'activité. « Tout écart signale une erreur de
  //     structure. » Contrôlé dès que l'unité ET tous ses enfants portent une
  //     durée déclarée.
  content.blocks.forEach((b, i) => {
    (b.units ?? []).forEach((u, j) => {
      if (!u.children?.length || u.durationMin == null) return;
      if (u.children.some((c) => c.durationMin == null)) return; // durées partielles : rien à contrôler
      const sum = u.children.reduce((a, c) => a + (c.durationMin ?? 0), 0);
      if (sum !== u.durationMin)
        err(
          "units.durationAudit",
          `blocks[${i}].units[${j}]`,
          `A2 : la somme des durées des micro-tâches (${sum} min) doit être égale à la durée annoncée de l'activité (${u.durationMin} min)`,
        );
    });
  });

  // --- K-HCBLM v2.2, amendement A1 — le Bloc 0 tient dans UNE micro-session
  //     standard unique de 20 minutes (warning : ne bloque pas le contenu
  //     antérieur, mais signale l'écart au modèle) ---
  if (onboarding?.units?.length) {
    const ms = onboarding.units.filter((u) => u.type === "micro-session");
    if (ms.length !== 1)
      warn("bloc0.singleSession", "blocks[0].units", `A1 : le Bloc 0 tient dans une micro-session standard unique (déclaré : ${ms.length})`);
    else if (ms[0]!.durationMin != null && ms[0]!.durationMin !== 20)
      warn("bloc0.duration", "blocks[0].units", `A1 : la micro-session du Bloc 0 dure 20 minutes (déclaré : ${ms[0]!.durationMin} min)`);
  }

  // --- v2.2, Pilier 6.2 — chaque bloc met à disposition une carte de rappel
  //     des apprentissages clés en 3 points (jamais comptée comme unité) ---
  content.blocks.forEach((b, i) => {
    if (b.type !== "CERTIFICATION" && !b.recallCard?.length)
      warn("bloc.recallCard", `blocks[${i}].recallCard`, "chaque bloc met à disposition une carte de rappel en 3 points (Pilier 6.2)");
  });

  // --- v2.2, Pilier 2 — le quiz déclencheur pose 5 questions déclaratives ---
  const trigCount = onboarding?.payload.triggerQuiz.questions.length ?? 0;
  if (onboarding && trigCount !== 5)
    warn("bloc0.triggerQuiz", "blocks[0].payload.triggerQuiz.questions", `le quiz déclencheur pose 5 questions déclaratives (déclaré : ${trigCount})`);

  // --- v2.2, Pilier 1 — le profil auto-déclaré propose 4 archétypes ---
  const profCount = onboarding?.payload.profileChoices.length ?? 0;
  if (onboarding && profCount !== 4)
    warn("bloc0.profiles", "blocks[0].payload.profileChoices", `le choix de profil propose 4 archétypes propres au parcours (déclaré : ${profCount})`);

  // --- v2.2, Pilier 3 — règles de durée vidéo : Bloc 0 ≤ 10 min ; Blocs 1–3
  //     entre 4 et 8 min ; aucune vidéo > 10 min ---
  const vids: { path: string; sec: number; bloc0: boolean }[] = [];
  if (onboarding?.payload.triggerVideo?.durationSec)
    vids.push({ path: "blocks[0].payload.triggerVideo", sec: onboarding.payload.triggerVideo.durationSec, bloc0: true });
  content.blocks.forEach((b, i) => {
    if (!("payload" in b) || !("microSessions" in b.payload)) return;
    (b.payload.microSessions ?? []).forEach((ms, j) => {
      if (ms.video?.durationSec) vids.push({ path: `blocks[${i}].payload.microSessions[${j}].video`, sec: ms.video.durationSec, bloc0: false });
    });
  });
  for (const v of vids) {
    if (v.sec > 600) warn("video.max10min", v.path, `aucune vidéo ne dépasse 10 minutes (déclaré : ${Math.round(v.sec / 60)} min)`);
    else if (!v.bloc0 && (v.sec < 240 || v.sec > 480))
      warn("video.range", v.path, `les vidéos des Blocs 1 à 3 durent 4 à 8 minutes (déclaré : ${Math.round(v.sec / 60)} min)`);
  }

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
