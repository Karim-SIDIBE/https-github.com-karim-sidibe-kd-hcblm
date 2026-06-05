import { useEffect, useMemo, useState } from "react";
import { api, auth, type ValidateResult, type ValidationIssue } from "../lib/api";

const CAN_PUBLISH = ["SUPER_ADMIN", "COURSE_ADMIN", "REVIEWER"];

type Content = {
  title: string; level: number; language?: string;
  domain: { code: string; label: string }; passThreshold: number;
  blocks: { index: number; type: string; title: string; payload?: any }[];
  [k: string]: unknown;
};

const field: React.CSSProperties = { width: "100%", padding: "9px 11px", border: "1px solid var(--line-strong)", borderRadius: 8, fontFamily: "inherit", fontSize: 13.5 };
const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--fg-1)", margin: "0 0 5px" };

export function CourseEditor({ initial, courseId, isNew, onClose, onSaved }: {
  initial: Content; courseId?: string; isNew: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [content, setContent] = useState<Content>(() => structuredClone(initial));
  const [slug, setSlug] = useState("");
  const [tab, setTab] = useState<"form" | "json">("form");
  const [jsonDraft, setJsonDraft] = useState(() => JSON.stringify(initial, null, 2));
  const [jsonErr, setJsonErr] = useState<string | null>(null);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);

  // Keep the JSON view in sync when the form mutates content.
  useEffect(() => { setJsonDraft(JSON.stringify(content, null, 2)); }, [content]);

  const set = (fn: (c: Content) => void) => setContent((prev) => { const n = structuredClone(prev); fn(n); return n; });

  const b4 = content.blocks.find((b) => b.type === "CERTIFICATION");
  const rubric = b4?.payload?.rubric as { criteria: { label: string; weightPoints: number }[]; threshold: number } | undefined;
  const weightSum = (rubric?.criteria ?? []).reduce((s, c) => s + (Number(c.weightPoints) || 0), 0);

  function applyJson() {
    try { const parsed = JSON.parse(jsonDraft); setContent(parsed); setJsonErr(null); setTab("form"); }
    catch (e: any) { setJsonErr("JSON invalide : " + (e?.message || "")); }
  }

  async function validate() {
    setBusy("validate"); setMsg(null);
    try { setResult(await api.validateCourse(content)); } catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(""); }
  }
  async function save() {
    setBusy("save"); setMsg(null); setVersionId(null);
    try {
      if (isNew) {
        if (!slug.trim()) { setMsg("Indiquez un identifiant (slug) pour le nouveau cours."); setBusy(""); return; }
        const c = await api.createCourse(slug.trim(), content);
        const full = await api.course(c.id);
        setVersionId((full.versions[0] as any)?.id ?? null);
        setMsg("Cours créé en brouillon.");
      } else if (courseId) {
        const v = await api.newVersion(courseId, content);
        setVersionId(v.id);
        setMsg(`Nouvelle version ${v.version} créée (brouillon).`);
      }
      onSaved();
    } catch (e: any) { setMsg(e?.message || "Erreur à l'enregistrement"); } finally { setBusy(""); }
  }
  async function publish() {
    if (!versionId) return;
    setBusy("publish"); setMsg(null);
    try { await api.publishVersion(versionId); setMsg("✅ Version publiée."); onSaved(); }
    catch (e: any) { setMsg("Publication refusée : " + (e?.message || "la version doit passer la validation")); } finally { setBusy(""); }
  }
  async function submitForReview() {
    if (!versionId) return;
    setBusy("review"); setMsg(null);
    try { await api.submitReview(versionId); setMsg("✅ Soumis pour revue — un relecteur va l'examiner."); onSaved(); }
    catch (e: any) { setMsg("Soumission refusée : " + (e?.message || "la version doit être un brouillon valide")); } finally { setBusy(""); }
  }
  const canPublish = CAN_PUBLISH.includes(auth.user()?.role ?? "");

  const issues: ValidationIssue[] = useMemo(() => {
    if (!result) return [];
    if (!result.shape.ok) return result.shape.issues ?? [];
    return result.policy?.issues ?? [];
  }, [result]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const conform = result != null && result.shape.ok && (result.policy?.ok ?? false);

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{isNew ? "Nouveau cours" : "Édition"}</div>
          <h1>Éditeur de cours</h1>
          <div className="sub">Modèle figé à 5 blocs — validé par la barrière de publication.</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn--ghost" onClick={onClose}>Annuler</button>
          <button className="btn" disabled={busy === "validate"} onClick={validate}>{busy === "validate" ? "…" : "Valider"}</button>
          <button className="btn btn--primary" disabled={busy === "save"} onClick={save}>{busy === "save" ? "…" : "Enregistrer (brouillon)"}</button>
        </div>
      </div>

      {(result || msg) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-b" style={{ paddingTop: 14 }}>
            {msg && <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--navy-700)", fontSize: 13.5 }}>{msg}{versionId && !isNew ? "" : ""}</p>}
            {result && (conform
              ? <span className="pill pill--green"><span className="dot" />Conforme — publiable</span>
              : <div>
                  {errors.length > 0 && <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: warnings.length ? 8 : 0 }}>{errors.map((e, i) => <span key={i} className="pill pill--red" title={e.path}>{e.message}</span>)}</div>}
                  {warnings.length > 0 && <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{warnings.map((w, i) => <span key={i} className="pill pill--warn" title={w.path}>{w.message}</span>)}</div>}
                  {errors.length === 0 && warnings.length === 0 && <span className="pill pill--soft">Aucun problème signalé</span>}
                </div>)}
            {versionId && (canPublish
              ? <div style={{ marginTop: 12 }}><button className="btn btn--primary btn--sm" disabled={busy === "publish"} onClick={publish}>{busy === "publish" ? "…" : "Publier cette version"}</button> <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>(la publication relance la validation complète)</span></div>
              : <div style={{ marginTop: 12 }}><button className="btn btn--primary btn--sm" disabled={busy === "review"} onClick={submitForReview}>{busy === "review" ? "…" : "Soumettre pour revue"}</button> <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>(un relecteur validera et publiera)</span></div>)}
          </div>
        </div>
      )}

      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        <button className={`btn btn--sm ${tab === "form" ? "btn--primary" : ""}`} onClick={() => setTab("form")}>Formulaire</button>
        <button className={`btn btn--sm ${tab === "json" ? "btn--primary" : ""}`} onClick={() => setTab("json")}>JSON (avancé)</button>
      </div>

      {tab === "form" ? (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
          <div className="card">
            <div className="card-h"><h3>Métadonnées</h3></div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {isNew && <div><label style={lbl}>Identifiant (slug)</label><input style={field} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="gestion-du-stress-n1" /></div>}
              <div><label style={lbl}>Titre du parcours</label><input style={field} value={content.title} onChange={(e) => set((c) => { c.title = e.target.value; })} /></div>
              <div className="row" style={{ gap: 12 }}>
                <div style={{ flex: 1 }}><label style={lbl}>Niveau</label><select style={field} value={content.level} onChange={(e) => set((c) => { c.level = Number(e.target.value); })}><option value={1}>Niveau 1</option><option value={2}>Niveau 2</option><option value={3}>Niveau 3</option></select></div>
                <div style={{ flex: 1 }}><label style={lbl}>Seuil quiz final (%)</label><input style={field} type="number" min={0} max={100} value={content.passThreshold} onChange={(e) => set((c) => { c.passThreshold = Number(e.target.value); })} /></div>
              </div>
              <div className="row" style={{ gap: 12 }}>
                <div style={{ flex: 1 }}><label style={lbl}>Code domaine</label><input style={field} value={content.domain?.code ?? ""} onChange={(e) => set((c) => { c.domain.code = e.target.value; })} /></div>
                <div style={{ flex: 2 }}><label style={lbl}>Libellé domaine</label><input style={field} value={content.domain?.label ?? ""} onChange={(e) => set((c) => { c.domain.label = e.target.value; })} /></div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card">
              <div className="card-h"><h3>Titres des blocs</h3></div>
              <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {content.blocks.map((b, i) => (
                  <div key={b.index}><label style={lbl}>Bloc {b.index} · {b.type}</label><input style={field} value={b.title} onChange={(e) => set((c) => { c.blocks[i].title = e.target.value; })} /></div>
                ))}
              </div>
            </div>

            {rubric && (
              <div className="card">
                <div className="card-h"><h3>Grille Bloc 4</h3><span className={`pill ${weightSum === 100 ? "pill--green" : "pill--red"}`}>Somme : {weightSum}/100</span></div>
                <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rubric.criteria.map((cr, j) => (
                    <div className="row" key={j} style={{ gap: 8 }}>
                      <input style={{ ...field, flex: 1 }} value={cr.label} onChange={(e) => set((c) => { c.blocks.find((x) => x.type === "CERTIFICATION")!.payload.rubric.criteria[j].label = e.target.value; })} />
                      <input style={{ ...field, width: 70 }} type="number" value={cr.weightPoints} onChange={(e) => set((c) => { c.blocks.find((x) => x.type === "CERTIFICATION")!.payload.rubric.criteria[j].weightPoints = Number(e.target.value); })} />
                    </div>
                  ))}
                  <span className="muted" style={{ fontSize: 11.5 }}>La somme des points doit faire 100 (règle de la barrière de publication).</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-h"><h3>Contenu complet (JSON)</h3><button className="btn btn--sm btn--primary" onClick={applyJson}>Appliquer le JSON</button></div>
          <div className="card-b">
            {jsonErr && <p style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 8px" }}>{jsonErr}</p>}
            <textarea value={jsonDraft} onChange={(e) => setJsonDraft(e.target.value)} spellCheck={false}
              style={{ width: "100%", minHeight: 420, fontFamily: "ui-monospace,monospace", fontSize: 12, border: "1px solid var(--line-strong)", borderRadius: 8, padding: 12, lineHeight: 1.5 }} />
            <span className="muted" style={{ fontSize: 11.5 }}>Édition fine de tous les champs (micro-sessions, questions, scénarios…). Cliquez « Appliquer » pour répercuter dans le formulaire.</span>
          </div>
        </div>
      )}
    </div>
  );
}
