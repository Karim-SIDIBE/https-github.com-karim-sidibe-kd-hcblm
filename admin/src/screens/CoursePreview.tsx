/**
 * CoursePreview — "Voir comme apprenant": a read-only render of the course
 * content as a learner would experience it, inside the admin console (mobile-
 * framed). Lets staff see the effect of their edits without a test account.
 * Correct quiz answers are marked (✓) since this is a staff preview.
 */
type Opt = { key: string; label: string };
type Block = { index: number; type: string; title: string; objective?: string; payload?: any };
type Content = { title: string; level?: number; objective?: string; summary?: string; durationEstimate?: string; domain?: { code: string; label: string }; competencies?: { code: string; label: string }[]; blocks: Block[]; [k: string]: unknown };

const TYPE_FR: Record<string, string> = { ONBOARDING: "Bloc 0 · Onboarding", COMPREHENSION: "Bloc 1 · Compréhension", PRACTICE: "Bloc 2 · Pratique", ANCHORING: "Bloc 3 · Ancrage", CERTIFICATION: "Bloc 4 · Certification" };
type Unit = { type: string };
const cnt = (units?: Unit[]) => { const c = { ms: 0, la: 0, mt: 0 }; for (const u of units ?? []) { if (u.type === "micro-session") c.ms++; else if (u.type === "long-activity") c.la++; else if (u.type === "micro-task") c.mt++; } return c; };
function CountLine({ units, dark }: { units?: Unit[]; dark?: boolean }) {
  if (!units?.length) return null;
  const c = cnt(units);
  return <div style={{ fontSize: 11, opacity: dark ? .85 : 1, color: dark ? "#fff" : "var(--fg-3)", marginTop: 4 }}>{c.ms} micro-session{c.ms > 1 ? "s" : ""} · {c.la} activité{c.la > 1 ? "s" : ""} longue{c.la > 1 ? "s" : ""} · {c.mt} micro-tâche{c.mt > 1 ? "s" : ""}</div>;
}

const phone: React.CSSProperties = { maxWidth: 430, margin: "0 auto", background: "var(--bg-soft)", borderRadius: 22, border: "1px solid var(--line)", padding: 16, boxShadow: "var(--shadow-md)" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 14, marginBottom: 12 };
const h: React.CSSProperties = { fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--navy-700)", margin: "0 0 6px" };
const eye: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--orange-500)" };

function Vid({ v }: { v: any }) {
  if (!v) return null;
  return (
    <div style={{ ...card, background: "var(--navy-700)", color: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.15)", display: "grid", placeItems: "center" }}>▶</div>
        <div><b style={{ fontSize: 13.5 }}>{v.title || "Vidéo"}</b><div style={{ fontSize: 11.5, opacity: .8 }}>{v.mediaId ? "Vidéo liée" : "Aucune vidéo liée"}{v.durationSec ? ` · ${Math.round(v.durationSec / 60)} min` : ""}</div></div>
      </div>
      {v.keyMessage && <div style={{ marginTop: 8, fontSize: 12.5, opacity: .9 }}>💡 {v.keyMessage}</div>}
    </div>
  );
}
function Qs({ items, scored = true }: { items: any[]; scored?: boolean }) {
  return (
    <>{(items ?? []).map((q, i) => (
      <div key={i} style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{i + 1}. {q.scenarioText || q.text || q.question}</div>
        {(q.options ?? []).map((o: Opt) => (
          <div key={o.key} style={{ fontSize: 12.5, padding: "5px 9px", border: "1px solid var(--line)", borderRadius: 7, marginBottom: 4, background: scored && q.correctKey === o.key ? "var(--success-tint)" : "#fff" }}>
            <b>{o.key}.</b> {o.label} {scored && q.correctKey === o.key && <span style={{ color: "var(--success)", fontWeight: 700 }}> ✓</span>}
          </div>
        ))}
        {(q.feedbackText || q.feedback) && <div style={{ fontSize: 11.5, color: "var(--fg-3)", marginTop: 2 }}>↳ {q.feedbackText || q.feedback}</div>}
      </div>
    ))}</>
  );
}
function Exercise({ ex }: { ex: any }) {
  if (!ex) return null;
  return (
    <div style={{ background: "var(--bg-soft)", borderRadius: 8, padding: 10, marginTop: 8 }}>
      <div style={eye}>Exercice · {ex.type}</div>
      <div style={{ fontSize: 12.5, margin: "4px 0" }}>{ex.prompt}</div>
      {ex.type === "multi" && <Qs items={[{ options: ex.options, correctKey: ex.correctKey, feedbackText: ex.feedbackText }]} />}
      {ex.type === "guidedForm" && (ex.fields ?? []).map((f: any, i: number) => <div key={i} style={{ fontSize: 12, color: "var(--fg-2)" }}>• {f.label}</div>)}
      {ex.type === "written" && <div style={{ fontSize: 11.5, color: "var(--fg-3)" }}>Réponse écrite (≥ {ex.minChars} car.)</div>}
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  const p = b.payload ?? {};
  return (
    <div style={card}>
      <div style={eye}>{TYPE_FR[b.type] ?? b.type}</div>
      <h3 style={{ ...h, fontSize: 16 }}>{b.title}</h3>
      <CountLine units={(b as any).units} />
      {b.objective && <div style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 4, marginBottom: 8 }}>{b.objective}</div>}

      {b.type === "ONBOARDING" && (<>
        {/* Rendered in the LEARNER's order: micro-session 1 (MA → profil → pair),
            then micro-session 2 (vidéo déclencheur → quiz déclencheur). */}
        <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 10, marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>🚀 Micro-session 1 — Introduction &amp; point de départ</div>
          {p.momentAncrage && <div style={{ ...card, background: "var(--orange-50)", marginTop: 8 }}><div style={eye}>🎯 1. Moment d'Ancrage</div><div style={{ fontSize: 12.5 }}>{p.momentAncrage.promptText}</div></div>}
          {p.profileChoices && (
            <div style={{ ...card, marginTop: 8 }}>
              <div style={eye}>🧭 2. Auto-identification du profil</div>
              {p.profileChoices.map((x: any) => (
                <div key={x.key ?? x.name} style={{ fontSize: 12.5, padding: "5px 9px", border: "1px solid var(--line)", borderRadius: 7, marginTop: 4 }}><b>{x.name}</b>{x.description ? ` — ${x.description}` : ""}</div>
              ))}
            </div>
          )}
          <div style={{ ...card, background: "var(--success-tint)", marginTop: 8 }}>
            <div style={eye}>🤝 3. Pair de progression — obligatoire</div>
            <div style={{ fontSize: 12.5, margin: "4px 0 8px" }}>À la fin de cette micro-session, l'apprenant désigne la personne qui suivra sa progression. Le pair est notifié à chaque badge obtenu.</div>
            <div style={{ fontSize: 12, color: "var(--fg-2)" }}>Nom du pair</div>
            <div style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "6px 9px", fontSize: 12.5, background: "#fff", color: "var(--fg-3)", marginBottom: 6 }}>ex. Awa Diallo</div>
            <div style={{ fontSize: 12, color: "var(--fg-2)" }}>E-mail du pair</div>
            <div style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "6px 9px", fontSize: 12.5, background: "#fff", color: "var(--fg-3)" }}>ex. awa.diallo@exemple.com</div>
            <div style={{ fontSize: 11.5, color: "var(--fg-3)", marginTop: 6 }}>↳ Côté admin : visible et modifiable via Apprenants → 🤝 Pair.</div>
          </div>
        </div>
        <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 10, marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>🎬 Micro-session 2 — Vidéo déclencheur puis quiz</div>
          <Vid v={p.triggerVideo} />
          {p.triggerQuiz && <div style={{ marginTop: 8 }}><div style={eye}>Quiz déclencheur — joué juste APRÈS la vidéo</div><Qs items={p.triggerQuiz.questions} scored={false} /></div>}
        </div>
      </>)}

      {p.diagnosticQuiz && <div style={{ marginTop: 6 }}><div style={eye}>Quiz diagnostique</div><Qs items={p.diagnosticQuiz.questions} /></div>}

      {(p.microSessions ?? []).map((s: any, i: number) => (
        <div key={i} style={{ borderTop: "1px dashed var(--line)", paddingTop: 10, marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>🎬 Micro-session {s.id} — {s.title} <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>· {s.durationEstimate}</span></div>
          <Vid v={s.video} />
          {(s.summaryPoints ?? []).filter(Boolean).length > 0 && <ul style={{ margin: "4px 0", paddingLeft: 18, fontSize: 12 }}>{s.summaryPoints.map((pt: string, j: number) => pt && <li key={j}>{pt}</li>)}</ul>}
          <Exercise ex={s.exercise} />
        </div>
      ))}

      {p.caseStudy && <div style={{ marginTop: 8 }}><div style={eye}>Étude de cas — {p.caseStudy.title}</div><ol style={{ paddingLeft: 18, fontSize: 12 }}>{(p.caseStudy.steps ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></div>}
      {p.guidedScenarios?.length > 0 && <div style={{ marginTop: 8 }}><div style={eye}>Mises en situation</div>{p.guidedScenarios.map((sc: any, i: number) => <div key={i} style={{ fontSize: 12.5, marginTop: 4 }}><b>{sc.title}</b><Qs items={sc.steps ?? []} /></div>)}</div>}
      {p.interBlockQuiz && <div style={{ marginTop: 8 }}><div style={eye}>Quiz interbloc</div><Qs items={p.interBlockQuiz.questions} /></div>}
      {p.fieldApplication && <div style={{ ...card, background: "var(--orange-50)", marginTop: 8 }}><div style={eye}>📍 Application terrain {p.fieldApplication.gatesNextBlock ? "(obligatoire)" : ""}</div><div style={{ fontSize: 12.5 }}>{p.fieldApplication.brief}</div></div>}
      {p.selfAssessment && <div style={{ marginTop: 8 }}><div style={eye}>Auto-évaluation</div><div style={{ fontSize: 12 }}>Critères : {(p.selfAssessment.criteria ?? []).join(", ")}</div></div>}
      {p.actionPlan30d && <div style={{ marginTop: 8 }}><div style={eye}>Plan d'action 30 j</div>{(p.actionPlan30d.habits ?? []).map((hb: any, i: number) => <div key={i} style={{ fontSize: 12 }}>• {hb.title}</div>)}</div>}
      {p.finalQuiz && <div style={{ marginTop: 8 }}><div style={eye}>Quiz final · seuil {p.finalQuiz.passThreshold}%</div><Qs items={p.finalQuiz.questions} /></div>}

      {b.type === "CERTIFICATION" && (<>
        {p.projectBrief && <div style={{ ...card, background: "var(--orange-50)" }}><div style={eye}>🎓 Projet certifiant</div><div style={{ fontSize: 12.5 }}>{p.projectBrief}</div></div>}
        {p.sections && <div><div style={eye}>Sections ({p.sections.length})</div><ol style={{ paddingLeft: 18, fontSize: 12 }}>{p.sections.map((s: any, i: number) => <li key={i}>{s.title}</li>)}</ol></div>}
        {p.journal?.entries && <div style={{ marginTop: 6 }}><div style={eye}>Journal ({p.journal.entries.length} entrées)</div><div style={{ fontSize: 12, color: "var(--fg-2)" }}>{p.journal.entries.map((e: any) => `J+${e.day}`).join(" · ")}</div></div>}
      </>)}
    </div>
  );
}

export function CoursePreview({ content }: { content: Content }) {
  const allUnits = (content.blocks ?? []).flatMap((b: any) => b.units ?? []);
  return (
    <div style={phone}>
      <div style={{ ...card, background: "linear-gradient(135deg,var(--navy-700),var(--navy-500))", color: "#fff" }}>
        <div style={{ ...eye, color: "var(--orange-400)" }}>Aperçu apprenant · Niveau {content.level ?? "?"}</div>
        <h2 style={{ ...h, color: "#fff", fontSize: 18, margin: "6px 0" }}>{content.title}</h2>
        {content.domain && <div style={{ fontSize: 11.5, opacity: .85 }}>{content.domain.code} · {content.domain.label}{content.competencies?.length ? ` — ${content.competencies.length} compétence(s) clé(s)` : ""}</div>}
        {content.durationEstimate && <div style={{ fontSize: 11.5, opacity: .85 }}>⏱ {content.durationEstimate}</div>}
        <CountLine units={allUnits} dark />
      </div>
      {content.objective && <div style={{ ...card, background: "var(--orange-50)" }}><div style={eye}>🎯 Objectif</div><div style={{ fontSize: 13 }}>{content.objective}</div></div>}
      {(content.blocks ?? []).map((b) => <BlockView key={b.index} b={b} />)}
    </div>
  );
}
