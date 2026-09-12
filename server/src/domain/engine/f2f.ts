/**
 * f2f.ts — règles pures du modèle K-SPEM v2.0 (KOMPETENCES FACE2FACE).
 *
 * Formes par niveau (K-SPEM §3.3 / §5) et verrou de certification (§6) :
 * la décision certifiante n'est prononçable que si TOUTES les conditions
 * sont réunies — présence aux sessions complètes, Journal de Bord au minimum
 * du niveau, Missions Terrain engagées après chaque session sauf la dernière,
 * fiche d'ancrage déposée. Pur : aucune I/O, entièrement testable.
 */

export type F2fLevel = 1 | 2 | 3;

/** Structure d'un module par niveau : sessions présentielles, périodes de
 *  pratique terrain, minimum d'entrées de Journal de Bord (6/9/12 — V2.0). */
export const F2F_SHAPE: Record<F2fLevel, { sessions: number; periods: number; journalMin: number; label: string }> = {
  1: { sessions: 3, periods: 2, journalMin: 6, label: "Fondamentaux" },
  2: { sessions: 4, periods: 3, journalMin: 9, label: "Avancé" },
  3: { sessions: 5, periods: 4, journalMin: 12, label: "Expert" },
};

export function f2fShape(level: number) {
  const shape = F2F_SHAPE[level as F2fLevel];
  if (!shape) throw new Error(`niveau FACE2FACE invalide : ${level} (attendu 1..3)`);
  return shape;
}

/** Plancher de rédaction d'une entrée de journal (mots cumulés sur les
 *  4 champs de texte) — la qualité d'observation exige des phrases, pas des
 *  mots isolés. */
export const F2F_JOURNAL_MIN_WORDS = 25;

export type F2fPrereqInput = {
  level: number;
  /** Sessions du module : index (1..N) et tenue effective. */
  sessions: { index: number; held: boolean }[];
  /** Index des sessions où le participant est marqué PRÉSENT. */
  presentAt: number[];
  /** Nombre d'entrées de Journal de Bord déposées. */
  journalCount: number;
  /** Index des sessions après lesquelles une Mission Terrain est engagée. */
  missionAt: number[];
  /** Fiche d'ancrage déposée. */
  hasAnchor: boolean;
};

export type F2fPrereq = { code: string; label: string; ok: boolean };

// ---------------------------------------------------------------------------
// Palier 2 — rappels programmés & auto-évaluation
// ---------------------------------------------------------------------------

const DAY_MS = 864e5;

/** Bornes de l'auto-évaluation K-SPEM (confiance déclarée sur la compétence). */
export const F2F_SELF_SCORE_MIN = 1;
export const F2F_SELF_SCORE_MAX = 10;

/** Étape de convocation due pour une session à venir : 0 = rien encore,
 *  1 = convocation J-7, 2 = rappel J-1. Une session passée ne convoque plus. */
export function convocationStage(scheduledAt: Date, now: Date): 0 | 1 | 2 {
  const ms = scheduledAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  if (ms <= DAY_MS) return 2;
  if (ms <= 7 * DAY_MS) return 1;
  return 0;
}

/** Entrées de journal attendues par période terrain — identique à tous les
 *  niveaux du modèle V2.0 (6/2 · 9/3 · 12/4 = 3 par période). */
export function entriesPerPeriod(level: number): number {
  const s = f2fShape(level);
  return Math.ceil(s.journalMin / s.periods);
}

/** Ouverture des entrées du Journal de Bord : l'entrée k (1..3) d'une période
 *  s'ouvre à J+7·k après la tenue de la session qui ouvre la période — le
 *  rythme hebdomadaire des déclencheurs DECLICK, adapté aux périodes terrain
 *  de 4 semaines. Une entrée fermée est refusée par le service (423). */
export function journalSlotOpensAt(sessionHeldAt: Date, entryIndex: number): Date {
  return new Date(sessionHeldAt.getTime() + 7 * entryIndex * DAY_MS);
}

/** Relance journal « bienveillante » à mi-période : due quand la moitié de la
 *  période est écoulée et que le participant reste sous 2 entrées. */
export function journalNudgeDue(input: { periodStart: Date; periodEnd: Date; now: Date; entries: number }): boolean {
  if (input.entries >= 2) return false;
  if (input.periodEnd.getTime() <= input.periodStart.getTime()) return false;
  const mid = input.periodStart.getTime() + (input.periodEnd.getTime() - input.periodStart.getTime()) / 2;
  return input.now.getTime() >= mid && input.now.getTime() < input.periodEnd.getTime();
}

/** Conditions de certification K-SPEM §6, TOUTES requises. Retourne l'état
 *  détaillé (pour le panneau de l'évaluateur) et le verdict global. */
export function certificationPrereqs(input: F2fPrereqInput): { ok: boolean; prereqs: F2fPrereq[] } {
  const shape = f2fShape(input.level);
  const present = new Set(input.presentAt);
  const missions = new Set(input.missionAt);
  const heldCount = input.sessions.filter((s) => s.held).length;
  const missingPresence = Array.from({ length: shape.sessions }, (_, i) => i + 1)
    .filter((i) => !present.has(i));
  const missionRequired = Array.from({ length: shape.sessions - 1 }, (_, i) => i + 1);
  const missingMissions = missionRequired.filter((i) => !missions.has(i));

  const prereqs: F2fPrereq[] = [
    {
      code: "anchor",
      label: "Fiche d'ancrage déposée en Session 1",
      ok: input.hasAnchor,
    },
    {
      code: "presence",
      label: `Présence aux ${shape.sessions} sessions complètes`,
      ok: heldCount === shape.sessions && missingPresence.length === 0,
    },
    {
      code: "journal",
      label: `Journal de Bord : ${shape.journalMin} entrées minimum`,
      ok: input.journalCount >= shape.journalMin,
    },
    {
      code: "missions",
      label: `Mission Terrain engagée après ${missionRequired.length > 1 ? `les Sessions 1 à ${shape.sessions - 1}` : "la Session 1"}`,
      ok: missingMissions.length === 0,
    },
  ];
  return { ok: prereqs.every((p) => p.ok), prereqs };
}
