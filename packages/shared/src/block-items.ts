/**
 * block-items.ts — derive the ordered learner-facing item list of a block from
 * the course content. SINGLE SOURCE shared by the learner PWA (renderer) and
 * the admin console (arrangement editor + preview) — no drift.
 *
 * The list follows the canonical per-block order, then applies the
 * author-declared `block.itemOrder` (display arrangement) when present.
 */
import type { Block, CourseContent, MicroSession } from "./content-model.js";

/** Apply an author-declared item order to a derived item list (pure).
 *  Lives HERE (zod-free module) so the learner PWA bundle stays lean —
 *  importing it must never pull the Zod content model into the client. */
export function applyItemOrder<T extends { key: string }>(items: T[], itemOrder?: string[] | null): T[] {
  if (!itemOrder || itemOrder.length === 0) return items;
  const byKey = new Map(items.map((it) => [it.key, it]));
  const picked = itemOrder.map((k) => byKey.get(k)).filter((x): x is T => x !== undefined);
  const pickedKeys = new Set(picked.map((it) => it.key));
  return [...picked, ...items.filter((it) => !pickedKeys.has(it.key))];
}


export type ItemKind =
  | "onboarding" | "diagnostic" | "session" | "case" | "scenarios"
  | "interblock" | "field" | "self" | "plan" | "final" | "journal" | "project";

export type BlockItem = {
  key: string;
  kind: ItemKind;
  label: string;
  /** Secondary line under the label in the course list (e.g. the case line
   *  « Nadia : compétente, épuisée… » or « Vidéo déclencheur + Quiz (non noté) »). */
  sublabel?: string;
  durationSec?: number;
  /** Display-group header this item renders under (indented). Set on every
   *  member; `groupFirst` marks where the header line is drawn. */
  groupTitle?: string;
  groupDurationLabel?: string;
  groupFirst?: boolean;
};

/**
 * Is this item satisfied by the completion set? The Bloc 4 section lines are
 * display aliases of the single "project" completion (the project submits as
 * one deliverable), so they all light up when the project is submitted.
 */
export function isItemDone(item: { key: string; kind: ItemKind }, completedKeys: ReadonlySet<string> | readonly string[]): boolean {
  const done = completedKeys instanceof Set ? completedKeys : new Set(completedKeys as readonly string[]);
  return done.has(item.key) || (item.kind === "project" && done.has("project"));
}

/** Map a non-quiz/non-session item kind to its ItemCompletion itemType. */
export const ITEM_TYPE: Partial<Record<ItemKind, string>> = {
  case: "CASE_STUDY", scenarios: "GUIDED_SCENARIOS", field: "FIELD_APPLICATION",
  self: "SELF_ASSESSMENT", plan: "ACTION_PLAN", journal: "JOURNAL_ENTRY", project: "PROJECT",
};

/** Parse "20 min" / "1 h" / "1,5 h" style estimates to seconds (0 when
 *  unparsable). Input is truncated and the patterns are unambiguous with
 *  bounded whitespace — no super-linear regex backtracking (CodeQL). */
export function parseEstimate(est?: string): number {
  if (!est) return 0;
  const s = est.slice(0, 64); // duration estimates are short labels ("~2 h 30")
  const h = /(\d{1,3}(?:[.,]\d{1,2})?)\s{0,4}h/i.exec(s);
  const m = /(\d{1,4})\s{0,4}m/i.exec(s);
  return Math.round((h ? parseFloat(h[1]!.replace(",", ".")) * 3600 : 0) + (m ? parseInt(m[1]!, 10) * 60 : 0));
}
/** Default effort estimates (seconds) per item kind, when the content gives none. */
const KIND_ESTIMATE: Record<string, number> = {
  onboarding: 600, diagnostic: 0, session: 600, case: 600, scenarios: 600,
  interblock: 0, field: 900, self: 300, plan: 600, final: 0, journal: 300, project: 1800,
};
const quizEstimate = (n: number) => n * 90; // ~1 min 30 par question

/** Optional translator (passed by the renderer); falls back to French. */
type Translate = (key: string, vars?: Record<string, string | number>) => string;

// Micro-sessions are labelled « Micro-session X.Y — titre » on every screen
// (harmonisation) and sized by their DECLARED estimate first — the estimate
// covers video + exercise, not just the video runtime.
const sessionItems = (ms: MicroSession[], t?: Translate): BlockItem[] =>
  ms.map((m) => ({
    key: m.id,
    kind: "session" as const,
    label: `${t ? t("ci.msPrefix") : "Micro-session"} ${m.id} — ${m.title}`,
    durationSec: parseEstimate((m as { durationEstimate?: string }).durationEstimate) || m.video?.durationSec || KIND_ESTIMATE.session,
  }));

export function blockItems(block: Block, t?: Translate): BlockItem[] {
  // Author-declared display order first (falls back to the canonical order).
  const items = applyItemOrder(rawBlockItems(block, t), (block as { itemOrder?: string[] }).itemOrder);
  // Every item carries an effort estimate so remaining-time maths cover quizzes,
  // deliverables and journals — not just the videos.
  const qCount = (c?: { questions?: unknown[] } | null) => c?.questions?.length ?? 0;
  const quizN: Record<string, number> = {
    diagnostic: block.type === "COMPREHENSION" ? qCount(block.payload.diagnosticQuiz) : 0,
    interblock: block.type === "PRACTICE" ? qCount(block.payload.interBlockQuiz) : 0,
    final: block.type === "ANCHORING" ? qCount(block.payload.finalQuiz) : 0,
  };
  const sized = items.map((it) => ({
    ...it,
    durationSec: it.durationSec
      || (it.kind in quizN && quizN[it.kind as keyof typeof quizN] ? quizEstimate(quizN[it.kind as keyof typeof quizN]!) : 0)
      || KIND_ESTIMATE[it.kind]
      || 300,
  }));
  // Author-declared display groups (« Activité Expérientielle Longue — … ») :
  // members render indented under one header; a grouped micro-session drops its
  // « Micro-session X.Y » numbering (it reads as a sub-step of the activity).
  const groups = (block as { itemGroups?: { title: string; durationLabel?: string; keys: string[] }[] }).itemGroups ?? [];
  if (groups.length) {
    const msTitle = new Map<string, string>(
      "microSessions" in block.payload ? (block.payload.microSessions as MicroSession[]).map((m) => [m.id, m.title]) : [],
    );
    for (const it of sized) {
      const g = groups.find((x) => x.keys.includes(it.key));
      if (!g) continue;
      it.groupTitle = g.title;
      it.groupDurationLabel = g.durationLabel || undefined;
      if (it.kind === "session" && msTitle.has(it.key)) it.label = msTitle.get(it.key)!;
    }
  }
  // The header renders before the FIRST member in display order — recompute
  // after ordering so itemOrder rearrangements keep a single header per group.
  const headerSeen = new Set<string>();
  for (const it of sized) {
    if (!it.groupTitle) continue;
    it.groupFirst = !headerSeen.has(it.groupTitle);
    headerSeen.add(it.groupTitle);
  }
  return sized;
}

function rawBlockItems(block: Block, t?: Translate): BlockItem[] {
  const tr = (key: string, fr: string, vars?: Record<string, string | number>) => (t ? t(key, vars) : fr);
  // A structured/legacy case study rendered as one course item. `dur` lets the
  // designer's estimate ("30 min") win over the KIND fallback.
  const caseItem = (cs: { title?: string; subtitle?: string; durationEstimate?: string } | undefined, fallback: string): BlockItem => ({
    key: "case", kind: "case", label: cs?.title || fallback, sublabel: cs?.subtitle || undefined,
    durationSec: parseEstimate(cs?.durationEstimate) || undefined,
  });
  switch (block.type) {
    case "ONBOARDING": {
      const items: BlockItem[] = [{
        key: "onboarding", kind: "onboarding",
        label: tr("ci.ms01", "Micro-session 0.1 — Onboarding"),
        sublabel: tr("ci.onboarding", "Introduction & point de départ"),
        durationSec: KIND_ESTIMATE.onboarding,
      }];
      // The trigger ("déclencheur") video + quiz — a distinct key so it never
      // collides with the trigger QUIZ completion key ("trigger"). Its declared
      // estimate covers vidéo + quiz ("10 min"), not just the video runtime.
      if (block.payload.triggerVideo) items.push({
        key: "declencheur", kind: "session",
        label: tr("ci.ms02", "Micro-session 0.2 — Déclencheur"),
        sublabel: tr("ci.ms02sub", "Vidéo déclencheur + Quiz (non noté)"),
        durationSec: parseEstimate((block.payload as { triggerDuration?: string }).triggerDuration) || block.payload.triggerVideo.durationSec,
      });
      return items;
    }
    case "COMPREHENSION": {
      // Author-defined titles win; the app's generic labels are the fallback.
      const dq = block.payload.diagnosticQuiz;
      const items: BlockItem[] = [
        { key: "diagnostic", kind: "diagnostic", label: dq?.title || tr("qz.diagnostic", "Quiz diagnostique"), durationSec: parseEstimate((dq as { durationEstimate?: string } | undefined)?.durationEstimate) || undefined },
        ...sessionItems(block.payload.microSessions, t),
      ];
      if (block.payload.caseStudy) items.push(caseItem(block.payload.caseStudy, tr("ci.case", "Étude de cas")));
      return items;
    }
    case "PRACTICE": {
      const p = block.payload;
      const items = [...sessionItems(p.microSessions, t)];
      if (p.guidedScenarios.length) items.push({ key: "scenarios", kind: "scenarios", label: p.guidedScenariosTitle || tr("ci.scenarios", "Mises en situation guidées"), durationSec: parseEstimate((p as { guidedScenariosDuration?: string }).guidedScenariosDuration) || undefined });
      if (p.interBlockQuiz) items.push({ key: "interblock", kind: "interblock", label: p.interBlockQuiz.title || tr("qz.interblock", "Quiz interbloc"), durationSec: parseEstimate((p.interBlockQuiz as { durationEstimate?: string }).durationEstimate) || undefined });
      items.push({ key: "field", kind: "field", label: p.fieldApplication?.title || tr("dl.fieldTitle", "Application terrain"), durationSec: parseEstimate((p.fieldApplication as { durationEstimate?: string } | undefined)?.durationEstimate) || undefined });
      return items;
    }
    case "ANCHORING": {
      const p = block.payload;
      const items = [...sessionItems(p.microSessions, t)];
      if ((p as { transversalCase?: { title?: string } }).transversalCase) items.push(caseItem((p as { transversalCase?: { title: string } }).transversalCase, tr("ci.transversal", "Cas transversal de synthèse")));
      items.push(
        { key: "self", kind: "self", label: p.selfAssessment?.title || tr("ci.self", "Auto-évaluation"), durationSec: parseEstimate((p.selfAssessment as { durationEstimate?: string } | undefined)?.durationEstimate) || undefined },
        { key: "plan", kind: "plan", label: p.actionPlan30d?.title || tr("ci.plan", "Plan d'action 30 jours"), durationSec: parseEstimate((p.actionPlan30d as { durationEstimate?: string } | undefined)?.durationEstimate) || undefined },
        { key: "final", kind: "final", label: p.finalQuiz?.title || tr("qz.final", "Quiz final"), durationSec: parseEstimate((p.finalQuiz as { durationEstimate?: string } | undefined)?.durationEstimate) || undefined },
      );
      return items;
    }
    case "CERTIFICATION": {
      // The 5 sections display as their own lines (MS 4.1–4.3, then the journal
      // long activity in Section 4's slot, then MS 4.4 — Section 5). They are
      // display ALIASES of the single "project" completion (one submission);
      // `isItemDone` maps them all to the "project" key. Section index 3 (the
      // journal section) is replaced by the grouped journal micro-entries.
      const sections = block.payload.sections ?? [];
      const journal: BlockItem[] = block.payload.journal.entries.map((e) => ({
        key: `J+${e.day}`, kind: "journal" as const, label: tr("ci.journal", `Journal J+${e.day}`, { day: e.day }),
        groupTitle: sections[3]?.title || tr("ci.journalGroup", "Journal des 2 semaines"),
      }));
      if (sections.length !== 5) return [{ key: "project", kind: "project", label: tr("pj.title", "Projet de certification") }, ...journal];
      const sectionItem = (i: number): BlockItem => ({
        key: i === 0 ? "project" : `project@${i}`, kind: "project",
        label: sections[i]!.title,
        durationSec: parseEstimate((sections[i] as { durationEstimate?: string }).durationEstimate) || undefined,
      });
      return [sectionItem(0), sectionItem(1), sectionItem(2), ...journal, sectionItem(4)];
    }
  }
}

/** Total effort of a block (seconds) = the sum of its item estimates. */
export function blockDurationSec(block: Block, t?: Translate): number {
  return blockItems(block, t).reduce((a, it) => a + (it.durationSec ?? 0), 0);
}

/**
 * The item to open right after `currentKey` in a block's DISPLAYED order —
 * the « Continuer » / « Session suivante » chaining target. Skips items already
 * completed; returns null when the block has nothing left after this item.
 */
export function nextBlockItem(block: Block, currentKey: string, completedKeys: readonly string[], t?: Translate): BlockItem | null {
  const items = blockItems(block, t);
  const done = new Set(completedKeys);
  const at = items.findIndex((it) => it.key === currentKey);
  return items.find((it, i) => i > at && !isItemDone(it, done) && it.key !== currentKey) ?? null;
}

export type SessionRef = { blockIndex: number; id: string; title: string; summaryPoints: string[] };

/** All micro-sessions across the course, in order. */
export function flattenSessions(blocks: CourseContent["blocks"]): SessionRef[] {
  const out: SessionRef[] = [];
  for (const b of blocks) {
    if (!("microSessions" in b.payload)) continue;
    for (const m of b.payload.microSessions) out.push({ blockIndex: b.index, id: m.id, title: m.title, summaryPoints: m.summaryPoints ?? [] });
  }
  return out;
}

/** The session immediately preceding (blockIndex,id) — for the AC#18 summary. */
export function previousSession(blocks: CourseContent["blocks"], blockIndex: number, id: string): SessionRef | null {
  const all = flattenSessions(blocks);
  const i = all.findIndex((s) => s.blockIndex === blockIndex && s.id === id);
  return i > 0 ? all[i - 1]! : null;
}
