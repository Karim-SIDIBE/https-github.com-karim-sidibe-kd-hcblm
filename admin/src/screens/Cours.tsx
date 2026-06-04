import { useState } from "react";
import { api, courseTitle, type CourseFull } from "../lib/api";
import { ago, useAsync } from "../lib/ui";
import type { CourseCtx } from "../App";
import { CourseEditor } from "./CourseEditor";

const STATUS: Record<string, { cls: string; label: string }> = {
  DRAFT: { cls: "pill--warn", label: "Brouillon" },
  IN_REVIEW: { cls: "pill--info", label: "En revue" },
  PUBLISHED: { cls: "pill--green", label: "Publié" },
  ARCHIVED: { cls: "pill--soft", label: "Archivé" },
};
const TYPE_FR: Record<string, string> = { ONBOARDING: "Onboarding · Ancrage", COMPREHENSION: "Compréhension", PRACTICE: "Pratique terrain", ANCHORING: "Ancrage", CERTIFICATION: "Certification" };

function blockItems(p: Record<string, unknown> = {}): string[] {
  const out: string[] = [];
  const arr = (k: string) => Array.isArray(p[k]) ? (p[k] as unknown[]).length : 0;
  if (p.momentAncrage) out.push("Moment d'Ancrage (PAM)");
  if (p.profileChoices) out.push(`${arr("profileChoices")} profils`);
  if (p.triggerQuiz) out.push("Quiz déclencheur");
  if (p.diagnosticQuiz) out.push("Quiz diagnostique");
  if (arr("microSessions")) out.push(`${arr("microSessions")} micro-sessions vidéo`);
  if (p.caseStudy) out.push("Étude de cas");
  if (arr("guidedScenarios")) out.push(`${arr("guidedScenarios")} mises en situation`);
  if (p.interBlockQuiz) out.push("Quiz interbloc");
  if (p.fieldApplication) out.push("Application terrain");
  if (p.selfAssessment) out.push("Auto-évaluation");
  if (p.actionPlan) out.push("Plan d'action 30 j");
  if (p.finalQuiz) out.push(`Quiz final (seuil ${(p.finalQuiz as { passThreshold?: number }).passThreshold ?? "?"}%)`);
  if (p.projectBrief) out.push("Projet certifiant");
  if (arr("sections")) out.push(`${arr("sections")} sections de projet`);
  const rubric = p.rubric as { criteria?: unknown[]; threshold?: number } | undefined;
  if (rubric) out.push(`Grille ${rubric.criteria?.length ?? 0} critères (seuil ${rubric.threshold ?? "?"})`);
  const journal = p.journal as { entries?: unknown[] } | undefined;
  if (journal?.entries) out.push(`Journal ${journal.entries.length} entrées`);
  return out;
}

function Structure({ id, onBack, onEdit }: { id: string; onBack: () => void; onEdit: (content: unknown, courseId: string) => void }) {
  const { data, loading, error } = useAsync<CourseFull>(() => api.course(id), [id]);
  const v = data?.versions?.[0];
  const blocks = v?.content?.blocks ?? [];
  return (
    <div className="content">
      <button className="btn btn--ghost btn--sm" style={{ marginBottom: 14 }} onClick={onBack}>← Catalogue</button>
      {loading && <div className="card"><div className="card-b">Chargement…</div></div>}
      {error && <div className="card"><div className="card-b" style={{ color: "var(--danger)" }}>Erreur : {error}</div></div>}
      {v && (
        <>
          <div className="pagehead">
            <div>
              <div className="eyebrow">{v.level} · {v.domainLabel ?? "Parcours"}</div>
              <h1>{v.title}</h1>
              <div className="sub">Version {v.version} · seuil de réussite {v.passThreshold ?? "?"}% · {blocks.length} blocs</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <span className={`pill ${(STATUS[v.status] ?? { cls: "pill--soft" }).cls}`}>{(STATUS[v.status] ?? { label: v.status }).label}</span>
              <button className="btn btn--primary" onClick={() => onEdit(v.content, id)}>Éditer (nouvelle version)</button>
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {blocks.map((b) => (
              <div className="card" key={b.index}>
                <div className="card-h"><h3 style={{ fontSize: 14 }}>Bloc {b.index} · {TYPE_FR[b.type] ?? b.type}</h3></div>
                <div className="card-b" style={{ paddingTop: 6 }}>
                  <b style={{ fontSize: 13.5, color: "var(--fg-1)" }}>{b.title}</b>
                  <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                    {blockItems(b.payload).map((it) => <span key={it} className="pill pill--soft" style={{ fontSize: 11.5 }}>{it}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type Mode = { t: "list" } | { t: "structure"; id: string } | { t: "editor"; isNew: boolean; courseId?: string; initial: any };

export function Cours({ ctx }: { ctx: CourseCtx }) {
  const [mode, setMode] = useState<Mode>({ t: "list" });
  const [loadingNew, setLoadingNew] = useState(false);

  async function newCourse() {
    // Start from the canonical course as a gate-passing template.
    const template = ctx.courses[0];
    if (!template) return;
    setLoadingNew(true);
    try {
      const full = await api.course(template.id);
      const content = structuredClone(full.versions[0].content) as any;
      content.title = "Nouveau parcours";
      setMode({ t: "editor", isNew: true, initial: content });
    } finally { setLoadingNew(false); }
  }

  if (mode.t === "editor")
    return <CourseEditor initial={mode.initial} courseId={mode.courseId} isNew={mode.isNew} onClose={() => setMode({ t: "list" })} onSaved={() => { /* keep editor open to allow publish */ }} />;
  if (mode.t === "structure")
    return <Structure id={mode.id} onBack={() => setMode({ t: "list" })} onEdit={(content, courseId) => setMode({ t: "editor", isNew: false, courseId, initial: content })} />;

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Catalogue · {ctx.courses.length}</div>
          <h1>Cours</h1>
          <div className="sub">Parcours certifiants — structure, versions et statut de publication.</div>
        </div>
        <button className="btn btn--primary" disabled={loadingNew || ctx.courses.length === 0} onClick={newCourse}>{loadingNew ? "…" : "+ Nouveau cours"}</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))" }}>
        {ctx.courses.map((c) => {
          const v = c.versions.find((x) => x.status === "PUBLISHED") ?? c.versions[0];
          const st = STATUS[v?.status ?? ""] ?? { cls: "pill--soft", label: v?.status ?? "—" };
          return (
            <button key={c.id} className="card" style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--line)" }} onClick={() => setMode({ t: "structure", id: c.id })}>
              <div className="card-b">
                <div className="row between" style={{ marginBottom: 10 }}>
                  <span className="pill pill--navy">{v?.level ?? "—"}</span>
                  <span className={`pill ${st.cls}`}>{st.label}</span>
                </div>
                <b style={{ fontSize: 15, color: "var(--navy-700)", fontFamily: "var(--font-display)", display: "block", lineHeight: 1.3 }}>{courseTitle(c)}</b>
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{c.versions.length} version(s) · maj {v ? ago((v as { updatedAt?: string }).updatedAt ?? null) : "—"}</div>
              </div>
            </button>
          );
        })}
      </div>
      {ctx.courses.length === 0 && <div className="empty"><div className="big">📚</div>Aucun cours.</div>}
    </div>
  );
}
