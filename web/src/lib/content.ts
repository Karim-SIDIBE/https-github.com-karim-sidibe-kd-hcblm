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

const sessionItems = (ms: MicroSession[]): BlockItem[] =>
  ms.map((m) => ({ key: m.id, kind: "session" as const, label: `${m.id} — ${m.title}`, durationSec: m.video?.durationSec }));

export function blockItems(block: Block): BlockItem[] {
  switch (block.type) {
    case "ONBOARDING": {
      const items: BlockItem[] = [{ key: "onboarding", kind: "onboarding", label: "Introduction & point de départ" }];
      // The trigger ("déclencheur") video — a distinct key so it never collides
      // with the trigger QUIZ ("trigger"). Optional: not a completion requirement.
      if (block.payload.triggerVideo) items.push({ key: "declencheur", kind: "session", label: "Vidéo déclencheur", durationSec: block.payload.triggerVideo.durationSec });
      return items;
    }
    case "COMPREHENSION": {
      const items: BlockItem[] = [{ key: "diagnostic", kind: "diagnostic", label: "Quiz diagnostique" }, ...sessionItems(block.payload.microSessions)];
      if (block.payload.caseStudy) items.push({ key: "case", kind: "case", label: block.payload.caseStudy.title ?? "Étude de cas" });
      return items;
    }
    case "PRACTICE": {
      const items = [...sessionItems(block.payload.microSessions)];
      if (block.payload.guidedScenarios.length) items.push({ key: "scenarios", kind: "scenarios", label: "Mises en situation guidées" });
      if (block.payload.interBlockQuiz) items.push({ key: "interblock", kind: "interblock", label: block.payload.interBlockQuiz.title || "Quiz interbloc" });
      items.push({ key: "field", kind: "field", label: "Application terrain" });
      return items;
    }
    case "ANCHORING":
      return [...sessionItems(block.payload.microSessions),
        { key: "self", kind: "self", label: "Auto-évaluation" },
        { key: "plan", kind: "plan", label: "Plan d'action 30 jours" },
        { key: "final", kind: "final", label: "Quiz final" }];
    case "CERTIFICATION": {
      const journal: BlockItem[] = block.payload.journal.entries.map((e) => ({ key: `J+${e.day}`, kind: "journal" as const, label: `Journal J+${e.day}` }));
      return [{ key: "project", kind: "project", label: "Projet de certification" }, ...journal];
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
