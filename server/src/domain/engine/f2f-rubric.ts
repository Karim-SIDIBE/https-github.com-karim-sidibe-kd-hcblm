/**
 * f2f-rubric.ts — grilles certifiantes FACE2FACE (socle F2F v1.0 consolidé par
 * les avenants n°1 à 3 = version 1.3). Pur, sans I/O.
 *
 * Trois configurations (avenant n°1, objet A.3) — le bloc domaine reste à
 * 60 points, également répartis, dans toutes :
 *   - N1-N2 standard : S1 20 · min 10 — S2 20 · sans minimum
 *   - N1-N2 avec S5  : S5 15 · min 8 — S1 15 · min 8 — S2 10 · sans minimum
 *   - N3             : S4 15 · min 8 — S1 10 · min 5 — S2 15 · sans minimum
 * FACE2FACE n'a pas de critère S3 (l'ancrage culturel s'observe en situation).
 *
 * Tables de bandes UNIQUES (avenant n°3, objet K.2) : le minimum non
 * compensable coïncide avec le HAUT de la bande 2 sur les quatre pondérations
 * — la décision se joue sur la bande retenue, pas sur le placement.
 *
 * Décision (socle F2F §9) : la NATURE du critère en défaut l'emporte sur le
 * total — un Journal de Bord ne se rattrape pas, une transmission non plus.
 * La reprise n'existe que pour un minimum manqué sur un critère observé en
 * MISE EN SITUATION.
 */
import type { Rubric, RubricCriterion } from "../content-model.js";
import { nonCompensationCheck, type CriterionScore } from "./certification.js";
import { f2fShape } from "./f2f.js";

export type EvidenceSource = "situation" | "journal" | "livrable";

/** Table de conversion unique (objet K.2) : [bande 4, 3, 2, 1] et minimum. */
export const F2F_BAND_TABLE: Record<number, { ranges: [number, number][]; min: number }> = {
  20: { ranges: [[16, 20], [11, 15], [6, 10], [0, 5]], min: 10 },
  15: { ranges: [[13, 15], [9, 12], [6, 8], [0, 5]], min: 8 },
  12: { ranges: [[10, 12], [7, 9], [4, 6], [0, 3]], min: 6 },
  10: { ranges: [[9, 10], [6, 8], [4, 5], [0, 3]], min: 5 },
};

function bands(weight: number, descriptors: [string, string, string, string]) {
  const table = F2F_BAND_TABLE[weight];
  if (!table) throw new Error(`pondération sans table de bandes : ${weight} (attendu 20, 15, 12 ou 10)`);
  return table.ranges.map(([lo, hi], i) => ({ band: 4 - i, scoreRange: [lo, hi] as [number, number], descriptor: descriptors[i]! }));
}

/** S1 — Régularité de la pratique et journal (socle F2F §4.2 ; le volume
 *  d'entrées suit le niveau : 6 / 9 / 12). */
function s1Criterion(level: number, weightPoints: number, minPoints: number): RubricCriterion {
  const entries = f2fShape(level).journalMin;
  return {
    label: "S1 — Régularité de la pratique et journal",
    competencyCode: "", origin: "socle", weightPoints, minPoints, evidenceSource: "journal",
    whereToLook: `Journal de Bord (${entries} entrées attendues, datées par la plateforme) et reprise des Missions Terrain`,
    bands: bands(weightPoints, [
      `Toutes les entrées requises du niveau (${entries}) sont présentes, chacune déposée dans sa fenêtre, sans dépôt groupé de plus de deux entrées le même jour. Chaque mission terrain engagée est reprise par au moins une entrée. Le candidat décrit un signal de surcharge, de décrochage ou d'abandon repéré chez lui, et l'ajustement concret fait en réponse.`,
      "Toutes les entrées requises sont présentes et les missions terrain sont reprises dans le journal. Le candidat mentionne sa charge de travail ou mentale et un ajustement, sans décrire le signal déclencheur.",
      "Il manque au plus une entrée par période terrain, ou des entrées ont été déposées groupées. Une mission terrain au moins n'est reprise par aucune entrée. La charge est évoquée sans ajustement décrit.",
      "Il manque plus d'une entrée par période terrain, ou aucune mention de la charge, ou aucune mission terrain reprise.",
    ]),
  };
}

/** S2 — Profondeur de l'apprentissage personnel (socle F2F §4.3). */
function s2Criterion(weightPoints: number): RubricCriterion {
  return {
    label: "S2 — Profondeur de l'apprentissage personnel",
    competencyCode: "", origin: "socle", weightPoints, evidenceSource: "journal",
    whereToLook: "Journal de Bord, fiche d'ancrage revisitée et retour réflexif de la session finale",
    bands: bands(weightPoints, [
      "Nomme une croyance ou une habitude professionnelle révisée pendant le module et ce qui l'a fait changer d'avis. Rapporte au moins une tentative sans l'effet attendu et analyse l'écart. Relie le comportement visé dans sa fiche d'ancrage à ce qu'il constate en fin de module, écart compris. Formule ce qu'il fera différemment.",
      "Nomme un changement de pratique et son déclencheur. Mentionne au moins une difficulté rencontrée pendant les périodes terrain. Revient sur sa fiche d'ancrage en session finale.",
      "Décrit ce qu'il a appris en termes de contenu des sessions, sans retour sur sa propre pratique. Aucune difficulté rapportée.",
      "Bilan de satisfaction, appréciation du formateur ou de la formation. Aucun élément d'analyse personnelle.",
    ]),
  };
}

/** S4 — Transmission de la pratique (Niveau 3 — socle F2F §4.4). Livrable :
 *  vérification orale obligatoire (avenant n°1, objet B). */
function s4Criterion(): RubricCriterion {
  return {
    label: "S4 — Transmission de la pratique",
    competencyCode: "", origin: "socle", weightPoints: 15, minPoints: 8, evidenceSource: "livrable",
    whereToLook: "Dossier de transmission (fiche de séance, date, destinataire) et extrait animé en Session 4 — complété par la vérification orale",
    bands: bands(15, [
      "Nomme la personne ou l'équipe destinataire, produit la fiche de séance et la date, et rapporte un changement observé chez le destinataire appuyé sur un fait vérifiable. L'extrait animé comporte une mise en situation et respecte le plafond de théorie. Défend au moins un choix pédagogique en le reliant à l'effet attendu.",
      "Décrit une transmission réalisée, avec son format et sa date. Aucun effet observé rapporté, ou effet affirmé sans fait vérifiable. L'extrait animé est conforme au format attendu.",
      "Décrit une intention de transmission ou un support préparé, sans transmission effective auprès d'un tiers. Ou anime l'extrait sans mise en situation.",
      "Aucune transmission décrite, ou aucun extrait animé.",
    ]),
  };
}

/** S5 — Mise en application documentée (Niveaux 1-2, quand l'annexe l'active —
 *  avenant n°1, objet A.1). Livrable : mini-projet structure Bloc 4 DECLICK. */
function s5Criterion(level: number): RubricCriterion {
  return {
    label: "S5 — Mise en application documentée",
    competencyCode: "", origin: "socle", weightPoints: 15, minPoints: 8, evidenceSource: "livrable",
    whereToLook: "Mini-projet déposé sur la plateforme avant la session finale (Situation · Solution mise en œuvre · Résultat observé · Apprentissage personnel) — complété par la vérification orale",
    bands: bands(15, [
      `Décrit une situation de son propre contexte de travail, nomme la solution mise en œuvre et sa date, rapporte un résultat constaté appuyé sur un fait vérifiable, et nomme ce qu'il ferait différemment.${level === 2 ? " La solution a été appliquée dans au moins deux contextes ou auprès de deux interlocuteurs distincts." : ""}`,
      "Décrit une situation de son contexte et une solution effectivement mise en œuvre, avec sa date. Le résultat est affirmé sans fait vérifiable à l'appui.",
      "Décrit une solution préparée ou une intention de mise en œuvre, sans application effective. Ou décrit une application dont le contexte n'est pas le sien.",
      "Aucune mise en œuvre décrite. Ou exposé théorique sans situation propre.",
    ]),
  };
}

export type F2fRubricOptions = { s5Enabled?: boolean };

/** Construit la grille certifiante FACE2FACE d'un module : les critères du
 *  DOMAINE du parcours source (60 points également répartis — identiques dans
 *  les deux départements, objet A) + les critères du socle F2F selon la
 *  configuration du niveau. Les critères de domaine sans source déclarée sont
 *  observés en mise en situation (plancher de démonstration, objet C.2). */
export function buildF2fRubric(level: number, domainCriteria: RubricCriterion[], opts: F2fRubricOptions = {}): Rubric {
  if (level === 3 && opts.s5Enabled) throw new Error("S5 est propre aux Niveaux 1-2 — au Niveau 3, S4 le remplace (objet A.1)");
  const domain = domainCriteria.map((c) => ({
    ...c,
    origin: "annexe" as const,
    evidenceSource: c.evidenceSource ?? ("situation" as const),
  }));
  const socle: RubricCriterion[] = level === 3
    ? [s4Criterion(), s1Criterion(level, 10, 5), s2Criterion(15)]
    : opts.s5Enabled
      ? [s5Criterion(level), s1Criterion(level, 15, 8), s2Criterion(10)]
      : [s1Criterion(level, 20, 10), s2Criterion(20)];
  return { totalPoints: 100, threshold: 70, criteria: [...domain, ...socle] };
}

export type F2fRubricIssue = string;

/** Contrôles avant chargement d'une grille F2F (objets A.3/A.4, C.2, K.2). */
export function validateF2fRubric(rubric: Rubric, level: number, opts: F2fRubricOptions = {}): F2fRubricIssue[] {
  const issues: F2fRubricIssue[] = [];
  const isSocle = (c: RubricCriterion) => c.origin === "socle" || /^S[1-5]\b/.test(c.label.trim());
  const domain = rubric.criteria.filter((c) => !isSocle(c));
  const socle = rubric.criteria.filter(isSocle);

  // Bloc domaine : 60 points également répartis, minimum à 50 % arrondi sup.
  const domSum = domain.reduce((a, c) => a + c.weightPoints, 0);
  if (domSum !== 60) issues.push(`objet A : le bloc domaine vaut 60 points (actuel : ${domSum})`);
  if (new Set(domain.map((c) => c.weightPoints)).size > 1) issues.push("objet A.3 : les 60 points du bloc domaine se répartissent également");
  for (const c of domain) {
    if (c.minPoints !== Math.ceil(c.weightPoints / 2)) issues.push(`« ${c.label} » : minimum attendu ${Math.ceil(c.weightPoints / 2)} (50 % arrondi au supérieur)`);
  }

  // Configuration du socle F2F selon le niveau.
  const expect: [string, number, number | null][] = level === 3
    ? [["S4", 15, 8], ["S1", 10, 5], ["S2", 15, null]]
    : opts.s5Enabled
      ? [["S5", 15, 8], ["S1", 15, 8], ["S2", 10, null]]
      : [["S1", 20, 10], ["S2", 20, null]];
  for (const [name, weight, min] of expect) {
    const c = socle.find((x) => x.label.trim().startsWith(name));
    if (!c) { issues.push(`critère ${name} du socle FACE2FACE absent (configuration ${level === 3 ? "N3" : opts.s5Enabled ? "avec S5" : "standard"})`); continue; }
    if (c.weightPoints !== weight) issues.push(`« ${c.label} » : ${weight} points attendus (reçu ${c.weightPoints})`);
    if ((c.minPoints ?? null) !== min) issues.push(`« ${c.label} » : minimum attendu ${min ?? "aucun"} (reçu ${c.minPoints ?? "aucun"})`);
  }
  if (socle.some((c) => c.label.trim().startsWith("S3"))) issues.push("FACE2FACE n'a pas de critère S3 — l'ancrage s'observe en situation");
  if (level === 3 && socle.some((c) => c.label.trim().startsWith("S5"))) issues.push("S5 est propre aux Niveaux 1-2 (objet A.1)");
  if (level !== 3 && socle.some((c) => c.label.trim().startsWith("S4"))) issues.push("S4 est réservé au Niveau 3");

  // Bandes : table de conversion unique K.2, minimum = haut de la bande 2.
  for (const c of rubric.criteria) {
    const table = F2F_BAND_TABLE[c.weightPoints];
    if (!table) { issues.push(`« ${c.label} » : pondération ${c.weightPoints} hors table de conversion (20, 15, 12, 10)`); continue; }
    const sorted = (c.bands ?? []).slice().sort((a, b) => b.band - a.band);
    if (sorted.length !== 4) { issues.push(`« ${c.label} » : 4 bandes attendues`); continue; }
    sorted.forEach((b, i) => {
      const [lo, hi] = table.ranges[i]!;
      if (b.scoreRange[0] !== lo || b.scoreRange[1] !== hi) {
        issues.push(`« ${c.label} » bande ${4 - i} : ${lo}–${hi} attendu (objet K.2 — reçu ${b.scoreRange[0]}–${b.scoreRange[1]})`);
      }
    });
    if (c.minPoints != null && c.minPoints !== table.min) issues.push(`« ${c.label} » : minimum ${table.min} attendu (haut de la bande 2 — objet K.2)`);
  }

  // Plancher de démonstration (objet C.2) : au moins la moitié des 60 points
  // du bloc domaine observée en mise en situation certifiante.
  const observed = domain.filter((c) => (c.evidenceSource ?? "situation") === "situation").reduce((a, c) => a + c.weightPoints, 0);
  if (observed * 2 < 60) issues.push(`objet C.2 : plancher de démonstration non atteint — ${observed}/60 points du domaine observés en mise en situation (minimum : la moitié)`);

  // Non-compensation (§9 / objet A.4) : au strict minimum, on reste sous 70.
  const nc = nonCompensationCheck(rubric.criteria, rubric.threshold);
  if (!nc.ok) issues.push(`non-compensation : ${nc.maxAtStrictMinimums} atteignable au strict minimum ≥ seuil ${rubric.threshold}`);

  return issues;
}

export type F2fDecisionResult = {
  decision: "CERTIFIED" | "RESUBMIT" | "NOT_CERTIFIED";
  total: number;
  threshold: number;
  minimumsMissed: { label: string; points: number; minPoints: number; source: EvidenceSource }[];
  allMinimumsMet: boolean;
  /** Motif §9 quand la nature du critère interdit la reprise. */
  natureBlocked: boolean;
};

/** Décision certifiante FACE2FACE (socle F2F §9) — l'ordre de lecture est
 *  exclusif : deux minimums manqués l'emportent sur le total, et la NATURE du
 *  critère en défaut l'emporte sur la fourchette. Un minimum manqué sur S1,
 *  S4 ou tout critère porté au Journal de Bord ou à un livrable → Non
 *  certifié (un journal horodaté ne se rattrape pas, une transmission non
 *  plus). La reprise (unique, 60 jours) n'existe que pour un critère observé
 *  en mise en situation. Sans source déclarée (grilles antérieures), un
 *  critère est réputé observé en situation. */
export function decideF2fCertification(
  criteria: RubricCriterion[],
  scores: CriterionScore[],
  threshold = 70,
): F2fDecisionResult {
  if (scores.length !== criteria.length) throw new Error(`scores (${scores.length}) et critères (${criteria.length}) désalignés`);
  let total = 0;
  const minimumsMissed: F2fDecisionResult["minimumsMissed"] = [];
  criteria.forEach((c, i) => {
    const pts = scores[i]!.points;
    if (!Number.isInteger(pts) || pts < 0 || pts > c.weightPoints) throw new Error(`score invalide pour « ${c.label} » : ${pts} (0..${c.weightPoints})`);
    total += pts;
    if (c.minPoints != null && pts < c.minPoints) {
      minimumsMissed.push({ label: c.label, points: pts, minPoints: c.minPoints, source: c.evidenceSource ?? "situation" });
    }
  });
  const allMinimumsMet = minimumsMissed.length === 0;
  const natureBlocked = minimumsMissed.some((m) => m.source !== "situation");

  let decision: F2fDecisionResult["decision"];
  if (total >= threshold && allMinimumsMet) decision = "CERTIFIED";
  else if (minimumsMissed.length >= 2 || total < 55 || natureBlocked) decision = "NOT_CERTIFIED";
  else decision = "RESUBMIT";

  return { decision, total, threshold, minimumsMissed, allMinimumsMet, natureBlocked };
}

/** Fenêtre de reprise après une décision « Nouvelle mise en situation »
 *  (socle §9, avenant n°3 objet J) : une reprise unique dans les 60 jours. */
export const F2F_RETAKE_WINDOW_DAYS = 60;
