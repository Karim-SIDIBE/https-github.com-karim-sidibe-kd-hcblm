/**
 * content.ts — derive the ordered learner-facing item list of a block from the
 * (cached) bundle content, so the dashboard renders offline. Pure + unit-tested.
 */
export type ItemKind =
  | "onboarding" | "diagnostic" | "session" | "case" | "scenarios"
  | "interblock" | "field" | "self" | "plan" | "final" | "journal" | "project";

export type BlockItem = { key: string; kind: ItemKind; label: string; durationSec?: number };

type AnyBlock = { index: number; type: string; title: string; payload?: any };

/** Map a non-quiz/non-session item kind to its ItemCompletion itemType. */
export const ITEM_TYPE: Partial<Record<ItemKind, string>> = {
  case: "CASE_STUDY", scenarios: "GUIDED_SCENARIOS", field: "FIELD_APPLICATION",
  self: "SELF_ASSESSMENT", plan: "ACTION_PLAN", journal: "JOURNAL_ENTRY", project: "PROJECT",
};

export function blockItems(block: AnyBlock): BlockItem[] {
  const p = block.payload ?? {};
  const sessions: BlockItem[] = (p.microSessions ?? []).map((m: any) => ({
    key: m.id, kind: "session" as const, label: `${m.id} — ${m.title}`, durationSec: m.video?.durationSec,
  }));
  switch (block.type) {
    case "ONBOARDING":
      return [{ key: "onboarding", kind: "onboarding", label: "Introduction & point de départ" }];
    case "COMPREHENSION": {
      const items: BlockItem[] = [{ key: "diagnostic", kind: "diagnostic", label: "Quiz diagnostique" }, ...sessions];
      if (p.caseStudy) items.push({ key: "case", kind: "case", label: p.caseStudy.title ?? "Étude de cas" });
      return items;
    }
    case "PRACTICE": {
      const items = [...sessions];
      if ((p.guidedScenarios ?? []).length) items.push({ key: "scenarios", kind: "scenarios", label: "Mises en situation guidées" });
      if (p.interBlockQuiz) items.push({ key: "interblock", kind: "interblock", label: p.interBlockQuiz.title || "Quiz interbloc" });
      items.push({ key: "field", kind: "field", label: "Application terrain" });
      return items;
    }
    case "ANCHORING":
      return [...sessions,
        { key: "self", kind: "self", label: "Auto-évaluation" },
        { key: "plan", kind: "plan", label: "Plan d'action 30 jours" },
        { key: "final", kind: "final", label: "Quiz final" }];
    case "CERTIFICATION": {
      const journal: BlockItem[] = (p.journal?.entries ?? []).map((e: any) => ({ key: `J+${e.day}`, kind: "journal" as const, label: `Journal J+${e.day}` }));
      return [{ key: "project", kind: "project", label: "Projet de certification" }, ...journal];
    }
    default: return sessions;
  }
}

export type SessionRef = { blockIndex: number; id: string; title: string; summaryPoints: string[] };

/** All micro-sessions across the course, in order. */
export function flattenSessions(blocks: AnyBlock[]): SessionRef[] {
  const out: SessionRef[] = [];
  for (const b of blocks) {
    for (const m of b.payload?.microSessions ?? []) {
      out.push({ blockIndex: b.index, id: m.id, title: m.title, summaryPoints: m.summaryPoints ?? [] });
    }
  }
  return out;
}

/** The session immediately preceding (blockIndex,id) — for the AC#18 summary. */
export function previousSession(blocks: AnyBlock[], blockIndex: number, id: string): SessionRef | null {
  const all = flattenSessions(blocks);
  const i = all.findIndex((s) => s.blockIndex === blockIndex && s.id === id);
  return i > 0 ? all[i - 1]! : null;
}
