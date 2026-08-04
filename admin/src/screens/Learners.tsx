import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, auth, courseTitle, type LearnerRow, type AtRiskLearner, type LearnerDiagnostic } from "../lib/api";
import { avatarColor, initials, ago, useAsync } from "../lib/ui";
import { table, downloadCsv, today, type Col } from "../lib/csv";
import { Pager, SortTh, ViewsBar } from "../lib/widgets";
import { modal } from "../lib/modal";

const RISK_PILL: Record<string, string> = { high: "pill--red", medium: "pill--warn", low: "pill--soft" };
const RISK_FR: Record<string, string> = { high: "Élevé", medium: "Moyen", low: "Faible" };

const CAN_MANAGE = ["SUPER_ADMIN", "COURSE_ADMIN"];
import type { CourseCtx } from "../App";

// The last active screen state stays per-browser; NAMED views are stored
// server-side (SavedView) and follow the account — see <ViewsBar/>.
const DEFAULT_COLS = ["progress", "finalQuiz", "rubric", "lastActivity", "status", "risk"];
const ACTIVE_KEY = "klms_learners_active";
type ViewConfig = { cols: string[]; filter: string; q: string; sort?: string };
function loadJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
// Map the UI filter label to the server's status param.
const FILTER_TO_STATUS: Record<string, string | undefined> = { Tous: undefined, Certifiés: "certified", "En cours": "active", Inactifs: "inactive" };
const PAGE_SIZE = 25;

function statusPill(l: LearnerRow) {
  if (l.status === "CERTIFIED") return <span className="pill pill--green"><span className="dot" />Certifié</span>;
  if (l.active) return <span className="pill pill--navy"><span className="dot" />En cours</span>;
  return <span className="pill pill--red"><span className="dot" />Inactif</span>;
}
function b4Pill(l: LearnerRow) {
  if (l.status === "CERTIFIED") return <span className="pill pill--green">Validé</span>;
  if (l.rubric != null) return <span className="pill pill--navy">Évalué · {l.rubric}%</span>;
  return <span className="muted">—</span>;
}

function DiagPanel({ d }: { d: LearnerDiagnostic | "loading" | undefined }) {
  if (!d || d === "loading") return <span className="muted">Chargement du profil…</span>;
  if (!d.taken || !d.subAreaScores?.length) return <span className="muted">Quiz diagnostique non passé.</span>;
  return (
    <div style={{ padding: "4px 2px" }}>
      <div style={{ fontSize: 12.5, marginBottom: 8 }}><b>Profil de compétences</b>{d.profile ? ` · ${d.profile}` : ""}{d.scorePct != null ? ` · ${d.scorePct}% au diagnostique` : ""}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", maxWidth: 720 }}>
        {d.subAreaScores.map((s) => {
          const col = s.pct < 50 ? "var(--danger)" : s.pct < 70 ? "var(--orange-500)" : "var(--green)";
          return (
            <div key={s.subArea}>
              <div className="row between" style={{ fontSize: 12.5 }}><span>{s.subArea}</span><b className="num">{s.pct}%</b></div>
              <div style={{ height: 7, background: "var(--bg)", borderRadius: 999, marginTop: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(s.pct, 2)}%`, background: col, borderRadius: 999 }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Learners({ ctx }: { ctx: CourseCtx }) {
  const { courseId, courses, setCourseId } = ctx;
  const [reloadKey, setReloadKey] = useState(0);
  const risk = useAsync<AtRiskLearner[]>(() => api.atRisk(courseId), [courseId, reloadKey]);
  const riskMap = useMemo(() => new Map((risk.data ?? []).map((r) => [r.enrollmentId, r])), [risk.data]);

  const active0 = loadJSON<Partial<ViewConfig>>(ACTIVE_KEY, {});
  const [q, setQ] = useState(active0.q ?? "");
  const [filter, setFilter] = useState(active0.filter ?? "Tous");
  const [sort, setSort] = useState(active0.sort ?? "startedAt:desc");
  const [visible, setVisible] = useState<string[]>(active0.cols ?? DEFAULT_COLS);
  const [colMenu, setColMenu] = useState(false);
  // Server-side pagination (M2): the API returns one page + the total.
  const [rows, setRows] = useState<LearnerRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  // Global header search: « Entrée » from the topbar lands here with its query.
  useEffect(() => {
    const onSearch = (e: Event) => setQ((e as CustomEvent<string>).detail ?? "");
    const onFilter = (e: Event) => setFilter((e as CustomEvent<string>).detail || "Tous");
    window.addEventListener("kd-admin-search", onSearch);
    window.addEventListener("kd-learners-filter", onFilter);
    return () => { window.removeEventListener("kd-admin-search", onSearch); window.removeEventListener("kd-learners-filter", onFilter); };
  }, []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const canManage = CAN_MANAGE.includes(auth.user()?.role ?? "");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, LearnerDiagnostic | "loading">>({});

  useEffect(() => {
    if (!courseId) return;
    const t = setTimeout(() => {
      api.learnersPaged(courseId, { q, status: FILTER_TO_STATUS[filter], sort, page, pageSize: PAGE_SIZE })
        .then((r) => { setRows(r.data); setTotal(r.total); setError(null); })
        .catch((e) => { setError(e instanceof Error ? e.message : "Erreur"); setRows([]); });
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [courseId, q, filter, sort, page, reloadKey]);
  useEffect(() => { setPage(1); }, [q, filter, sort, courseId]);

  // Persist the active screen state locally (named views live server-side).
  useEffect(() => { localStorage.setItem(ACTIVE_KEY, JSON.stringify({ cols: visible, filter, q, sort } satisfies ViewConfig)); }, [visible, filter, q, sort]);

  // Column registry — single source of truth for the table cells AND the export.
  // `sortField` marks the columns the server knows how to sort.
  type ColDef = { key: string; label: string; sortField?: string; cell: (l: LearnerRow) => ReactNode; csv: Col<LearnerRow>[] };
  const ALL_COLS: ColDef[] = [
    { key: "progress", label: "Progression", sortField: "progressPercent", csv: [{ label: "Progression (%)", value: (l) => l.progressPercent }],
      cell: (l) => <div className="progress"><div className="track"><i style={{ width: `${l.progressPercent}%`, background: l.progressPercent === 100 ? "var(--green)" : "var(--orange-500)" }} /></div><span className="pct">{l.progressPercent}%</span></div> },
    { key: "finalQuiz", label: "Quiz final", csv: [{ label: "Quiz final (%)", value: (l) => l.finalQuiz ?? "" }],
      cell: (l) => l.finalQuiz != null ? <span className="pill pill--soft">{l.finalQuiz}%</span> : <span className="muted">—</span> },
    { key: "rubric", label: "Projet B4", csv: [{ label: "Projet B4 (%)", value: (l) => l.rubric ?? "" }], cell: (l) => b4Pill(l) },
    { key: "lastActivity", label: "Dernière activité", sortField: "lastActivity", csv: [{ label: "Dernière activité", value: (l) => l.lastActivity ?? "" }],
      cell: (l) => <span className="muted" style={{ fontSize: 12.5 }}>{ago(l.lastActivity)}</span> },
    { key: "status", label: "Statut", csv: [{ label: "Statut", value: (l) => l.status }], cell: (l) => statusPill(l) },
    { key: "risk", label: "Risque",
      csv: [
        { label: "Score de risque", value: (l) => riskMap.get(l.enrollmentId)?.riskScore ?? "" },
        { label: "Niveau de risque", value: (l) => { const rk = riskMap.get(l.enrollmentId); return rk ? RISK_FR[rk.riskLevel] : ""; } },
        { label: "Facteurs de risque", value: (l) => riskMap.get(l.enrollmentId)?.factors.join(" · ") ?? "" },
      ],
      cell: (l) => { const rk = riskMap.get(l.enrollmentId); return rk ? <span className={`pill ${RISK_PILL[rk.riskLevel]}`} title={rk.factors.join(" · ")}>{rk.riskScore} · {RISK_FR[rk.riskLevel]}</span> : <span className="muted">—</span>; } },
    { key: "startedAt", label: "Démarré le", sortField: "startedAt", csv: [{ label: "Démarré le", value: (l) => l.startedAt ?? "" }],
      cell: (l) => <span className="muted" style={{ fontSize: 12.5 }}>{ago(l.startedAt)}</span> },
    { key: "completedAt", label: "Certifié le", csv: [{ label: "Certifié le", value: (l) => l.completedAt ?? "" }],
      cell: (l) => <span className="muted" style={{ fontSize: 12.5 }}>{ago(l.completedAt)}</span> },
  ];
  const shownCols = ALL_COLS.filter((c) => visible.includes(c.key));

  // Toggle a learner's competency profile (diagnostic strengths/weaknesses).
  async function toggleDetail(l: LearnerRow) {
    if (detailId === l.enrollmentId) { setDetailId(null); return; }
    setDetailId(l.enrollmentId);
    if (!details[l.enrollmentId]) {
      setDetails((d) => ({ ...d, [l.enrollmentId]: "loading" }));
      try { const dg = await api.learnerDiagnostic(l.enrollmentId); setDetails((d) => ({ ...d, [l.enrollmentId]: dg })); }
      catch { setDetails((d) => ({ ...d, [l.enrollmentId]: { taken: false } })); }
    }
  }

  // Re-point the enrolment to the latest published version (so new videos/edits
  // show up). "full" wipes progress, "version" keeps it. Never deletes the account.
  async function resetCourse(l: LearnerRow, mode: "full" | "version") {
    const ok = await modal.confirm(mode === "full"
      ? { title: `Réinitialiser le parcours de ${l.email} ?`, body: "La progression est remise à zéro ET l'inscription repasse à la dernière version publiée (nouvelles vidéos/modifs). Le compte n'est pas supprimé.", danger: true, okLabel: "Réinitialiser" }
      : { title: `Mettre à jour ${l.email} vers la dernière version publiée ?`, body: "La progression est conservée ; seules les nouvelles vidéos/modifications apparaissent.", okLabel: "Mettre à jour" });
    if (!ok) return;
    setBusyId(l.id); setNote(null);
    try { const r = await api.resetEnrollment(l.enrollmentId, mode); setNote(`✅ ${l.email} — ${mode === "full" ? "parcours réinitialisé" : "mis à jour"} (version ${r.version}).`); setReloadKey((k) => k + 1); }
    catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }

  // Progress peer: view + set/replace (server notifies the peer on badge events).
  async function editPeer(l: LearnerRow) {
    try {
      const cur = await api.enrollmentPeer(l.enrollmentId).catch(() => ({ name: null as string | null, notified: false }));
      const name = await modal.prompt({ title: `Pair de progression de ${l.name}`, body: cur.name ? `Actuel : ${cur.name}` : "Aucun pair défini pour l'instant.", label: "Nom du pair", initial: cur.name ?? "" });
      if (!name?.trim()) return;
      const email = await modal.prompt({ title: `Pair de progression de ${l.name}`, label: "E-mail du pair", placeholder: "pair@exemple.com" });
      if (!email?.trim() || !/.+@.+\..+/.test(email)) { setNote("E-mail du pair invalide."); return; }
      await api.setPeer(l.enrollmentId, name.trim(), email.trim());
      setNote(`✅ Pair de progression de ${l.name} : ${name.trim()} <${email.trim()}>.`);
    } catch (e) { setNote(e instanceof Error ? e.message : "Modification impossible"); }
  }

  // Manual re-engagement: send the learner a personalised "come back" nudge.
  async function relancer(l: LearnerRow) {
    setBusyId(l.id); setNote(null);
    try { await api.nudgeLearner(l.enrollmentId); setNote(`✅ Relance envoyée à ${l.email}.`); }
    catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }

  async function resend(l: LearnerRow) {
    setBusyId(l.id); setNote(null);
    try {
      const r = await api.invite(l.id);
      setNote(r.delivered
        ? `✅ Invitation renvoyée à ${l.email}. Nouveau mot de passe : ${r.tempPassword}`
        : `⚠️ Aucun canal d'envoi configuré (SMTP) — l'invitation n'a PAS été délivrée. Nouveau mot de passe à communiquer manuellement : ${r.tempPassword}`);
    } catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }

  // Export the visible columns of the FULL filtered list (not just this page).
  async function exportCsv() {
    try {
      const all = await api.courseLearners(courseId);
      const term = q.trim().toLowerCase();
      const filtered = all.filter((l) =>
        (filter === "Tous" || (filter === "Certifiés" && l.status === "CERTIFIED") || (filter === "En cours" && l.active && l.status !== "CERTIFIED") || (filter === "Inactifs" && !l.active && l.status !== "CERTIFIED")) &&
        (term === "" || (l.name + l.email).toLowerCase().includes(term)));
      const cols: Col<LearnerRow>[] = [
        { label: "Nom", value: (l) => l.name },
        { label: "E-mail", value: (l) => l.email },
        ...shownCols.flatMap((c) => c.csv),
      ];
      downloadCsv(`apprenants-${today()}.csv`, table(cols, filtered));
    } catch (e) { setNote(e instanceof Error ? e.message : "Export impossible"); }
  }

  const toggleCol = (k: string) => setVisible((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]));

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{rows == null ? "…" : `${total} apprenant${total > 1 ? "s" : ""}`}</div>
          <h1>Apprenants</h1>
          <div className="sub">{courses.find((c) => c.id === courseId) ? courseTitle(courses.find((c) => c.id === courseId)!) : ""}</div>
        </div>
        <div className="filters">
          <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>{courses.map((c) => <option key={c.id} value={c.id}>{courseTitle(c)}</option>)}</select>
          {canManage && <a href="#/enrol" className="btn btn--primary">+ Inscrire un apprenant</a>}
        </div>
      </div>

      {note && <div className="card" style={{ background: (note.startsWith("✅") || note.startsWith("🗑️")) ? "var(--success-tint)" : "var(--warning-tint)", border: "none", padding: "11px 14px", marginBottom: 14, fontSize: 13 }} onClick={() => setNote(null)}>{note}</div>}

      <div className="card">
        <div className="card-h" style={{ paddingBottom: 14, borderBottom: "1px solid var(--line)", flexWrap: "wrap", gap: 8 }}>
          <label className="search" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: "var(--r-pill)", padding: "8px 14px", width: 260 }}>
            <input style={{ border: 0, background: "none", outline: "none", fontFamily: "inherit", fontSize: 13, width: "100%" }} placeholder="Rechercher par nom ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}><option>Tous</option><option>En cours</option><option>Inactifs</option><option>Certifiés</option></select>

          {/* Column picker */}
          <div style={{ position: "relative" }}>
            <button className="btn" onClick={() => setColMenu((o) => !o)} title="Choisir les colonnes affichées">⚙ Colonnes ▾</button>
            {colMenu && (
              <div style={{ position: "absolute", zIndex: 20, top: "calc(100% + 4px)", left: 0, background: "#fff", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow-lg)", padding: 8, minWidth: 190 }}>
                {ALL_COLS.map((c) => (
                  <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={visible.includes(c.key)} onChange={() => toggleCol(c.key)} /> {c.label}
                  </label>
                ))}
                <button className="btn btn--sm" style={{ width: "100%", marginTop: 6 }} onClick={() => setVisible(DEFAULT_COLS)}>Réinitialiser</button>
              </div>
            )}
          </div>

          {/* Saved views — stored server-side, they follow the account. */}
          <ViewsBar screen="learners" config={{ cols: visible, filter, q, sort }}
            onApply={(c) => {
              setVisible((c.cols as string[]) ?? DEFAULT_COLS);
              setFilter((c.filter as string) ?? "Tous");
              setQ((c.q as string) ?? "");
              setSort((c.sort as string) ?? "startedAt:desc");
            }} />

          <button className="btn" style={{ marginLeft: "auto" }} onClick={() => void exportCsv()} disabled={total === 0} title="Exporter les colonnes visibles de la liste filtrée complète (CSV Excel/Sheets)">⤓ Exporter CSV</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr>
              <SortTh label="Apprenant" field="name" sort={sort} onSort={setSort} />
              {shownCols.map((c) => c.sortField
                ? <SortTh key={c.key} label={c.label} field={c.sortField} sort={sort} onSort={setSort} />
                : <th key={c.key}>{c.label}</th>)}
              {canManage && <th>Actions</th>}
            </tr></thead>
            <tbody>
              {(rows ?? []).map((l) => (
                <Fragment key={l.email}>
                <tr>
                  <td onClick={() => toggleDetail(l)} style={{ cursor: "pointer" }} title="Voir le profil de compétences"><div className="uitem"><span className="av" style={{ background: avatarColor(l.name) }}>{initials(l.name)}</span><div className="who"><b>{detailId === l.enrollmentId ? "▾ " : "▸ "}{l.name}</b><span>{l.email}</span></div></div></td>
                  {shownCols.map((c) => <td key={c.key}>{c.cell(l)}</td>)}
                  {canManage && (
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        {l.status !== "CERTIFIED" && <button className="btn btn--sm" disabled={busyId === l.id} onClick={() => relancer(l)} title="Envoyer une relance d'engagement personnalisée à l'apprenant">📣 Relancer</button>}
                        <button className="btn btn--sm" disabled={busyId === l.id} onClick={() => resend(l)} title="Réinitialise le mot de passe et renvoie l'invitation">{busyId === l.id ? "…" : "↻ Renvoyer"}</button>
                        <button className="btn btn--sm" onClick={() => editPeer(l)} title="Voir / modifier le pair de progression">🤝 Pair</button>
                        <button className="btn btn--sm" disabled={busyId === l.id} onClick={() => resetCourse(l, "version")} title="Mettre à jour vers la dernière version publiée (garde la progression)">⟳ Maj version</button>
                        <button className="btn btn--sm" disabled={busyId === l.id} onClick={() => resetCourse(l, "full")} title="Réinitialiser le parcours (remet la progression à zéro + dernière version)" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>↺ Réinitialiser</button>
                      </div>
                    </td>
                  )}
                </tr>
                {detailId === l.enrollmentId && (
                  <tr><td colSpan={1 + shownCols.length + (canManage ? 1 : 0)} style={{ background: "var(--bg-soft)" }}><DiagPanel d={details[l.enrollmentId]} /></td></tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {rows == null && <div className="empty">Chargement des apprenants…</div>}
          {error && <div className="empty" style={{ color: "var(--danger)" }}>Erreur : {error}</div>}
          {rows != null && !error && rows.length === 0 && <div className="empty"><div className="big">👤</div>Aucun apprenant pour ce filtre. Utilisez « Inscrire un apprenant ».</div>}
          {rows != null && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}
        </div>
      </div>
    </div>
  );
}
