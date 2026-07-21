/**
 * content.ts — derive the ordered learner-facing item list of a block from the
 * (cached) bundle content. Types come from the shared contract `@kd/shared`, so
 * the renderer consumes exactly what the author defines — no drift. Pure + tested.
 */
import type { Block, CourseContent, MicroSession } from "@kd/shared";

export type ItemKind =
  | "onboarding" | "diagnostic" | "session" | "case" | "scenarios"
  | "interblock" | "field" | "self" | "plan" | "final" | "journal" | "project";

export type BlockItem = { key: string; kind: ItemKind; label: string; durationSec?: number };

/** Map a non-quiz/non-session item kind to its ItemCompletion itemType. */
export const ITEM_TYPE: Partial<Record<ItemKind, string>> = {
  case: "CASE_STUDY", scenarios: "GUIDED_SCENARIOS", field: "FIELD_APPLICATION",
  self: "SELF_ASSESSMENT", plan: "ACTION_PLAN", journal: "JOURNAL_ENTRY", project: "PROJECT",
};

/** Parse "20 min" / "1 h" style estimates to seconds (0 when unparsable). */
export function parseEstimate(est?: string): number {
  if (!est) return 0;
  const h = /([\d,.]+)\s*h/i.exec(est); const m = /(\d+)\s*m/i.exec(est);
  return Math.round((h ? parseFloat(h[1]!.replace(",", ".")) * 3600 : 0) + (m ? parseInt(m[1]!, 10) * 60 : 0));
}
/** Default effort estimates (seconds) per item kind, when the content gives none. */
const KIND_ESTIMATE: Record<string, number> = {
  onboarding: 600, diagnostic: 0, session: 600, case: 600, scenarios: 600,
  interblock: 0, field: 900, self: 300, plan: 600, final: 0, journal: 300, project: 1800,
};
const quizEstimate = (n: number) => n * 90; // ~1 min 30 par question

const sessionItems = (ms: MicroSession[]): BlockItem[] =>
  ms.map((m) => ({ key: m.id, kind: "session" as const, label: `${m.id} — ${m.title}`, durationSec: m.video?.durationSec || parseEstimate((m as { durationEstimate?: string }).durationEstimate) || KIND_ESTIMATE.session }));

/** Optional translator (passed by the renderer); falls back to French. */
type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function blockItems(block: Block, t?: Translate): BlockItem[] {
  const items = rawBlockItems(block, t);
  // Every item carries an effort estimate so remaining-time maths cover quizzes,
  // deliverables and journals — not just the videos.
  const qCount = (c?: { questions?: unknown[] } | null) => c?.questions?.length ?? 0;
  const quizN: Record<string, number> = {
    diagnostic: block.type === "COMPREHENSION" ? qCount(block.payload.diagnosticQuiz) : 0,
    interblock: block.type === "PRACTICE" ? qCount(block.payload.interBlockQuiz) : 0,
    final: block.type === "ANCHORING" ? qCount(block.payload.finalQuiz) : 0,
  };
  return items.map((it) => ({
    ...it,
    durationSec: it.durationSec
      || (it.kind in quizN && quizN[it.kind as keyof typeof quizN] ? quizEstimate(quizN[it.kind as keyof typeof quizN]!) : 0)
      || KIND_ESTIMATE[it.kind]
      || 300,
  }));
}

function rawBlockItems(block: Block, t?: Translate): BlockItem[] {
  const tr = (key: string, fr: string, vars?: Record<string, string | number>) => (t ? t(key, vars) : fr);
  switch (block.type) {
    case "ONBOARDING": {
      const items: BlockItem[] = [{ key: "onboarding", kind: "onboarding", label: tr("ci.onboarding", "Introduction & point de départ") }];
      // The trigger ("déclencheur") video — a distinct key so it never collides
      // with the trigger QUIZ ("trigger"). Optional: not a completion requirement.
      if (block.payload.triggerVideo) items.push({ key: "declencheur", kind: "session", label: tr("sess.triggerVideo", "Vidéo déclencheur"), durationSec: block.payload.triggerVideo.durationSec });
      return items;
    }
    case "COMPREHENSION": {
      // Author-defined titles win; the app's generic labels are the fallback.
      const items: BlockItem[] = [{ key: "diagnostic", kind: "diagnostic", label: block.payload.diagnosticQuiz?.title || tr("qz.diagnostic", "Quiz diagnostique") }, ...sessionItems(block.payload.microSessions)];
      if (block.payload.caseStudy) items.push({ key: "case", kind: "case", label: block.payload.caseStudy.title ?? tr("ci.case", "Étude de cas") });
      return items;
    }
    case "PRACTICE": {
      const items = [...sessionItems(block.payload.microSessions)];
      if (block.payload.guidedScenarios.length) items.push({ key: "scenarios", kind: "scenarios", label: block.payload.guidedScenariosTitle || tr("ci.scenarios", "Mises en situation guidées") });
      if (block.payload.interBlockQuiz) items.push({ key: "interblock", kind: "interblock", label: block.payload.interBlockQuiz.title || tr("qz.interblock", "Quiz interbloc") });
      items.push({ key: "field", kind: "field", label: block.payload.fieldApplication?.title || tr("dl.fieldTitle", "Application terrain") });
      return items;
    }
    case "ANCHORING":
      return [...sessionItems(block.payload.microSessions),
        { key: "self", kind: "self", label: block.payload.selfAssessment?.title || tr("ci.self", "Auto-évaluation") },
        { key: "plan", kind: "plan", label: block.payload.actionPlan30d?.title || tr("ci.plan", "Plan d'action 30 jours") },
        { key: "final", kind: "final", label: block.payload.finalQuiz?.title || tr("qz.final", "Quiz final") }];
    case "CERTIFICATION": {
      const journal: BlockItem[] = block.payload.journal.entries.map((e) => ({ key: `J+${e.day}`, kind: "journal" as const, label: tr("ci.journal", `Journal J+${e.day}`, { day: e.day }) }));
      return [{ key: "project", kind: "project", label: tr("pj.title", "Projet de certification") }, ...journal];
    }
  }
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
