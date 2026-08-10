import { useEffect, useState } from "react";
import { api } from "../lib/app";
import { navigate, routes } from "../lib/router";
import { useT } from "../lib/i18n";

/**
 * Cohorte (K-HCBLM v2.2, Pilier 6.3) — deux dispositifs d'apprentissage social :
 *  - le tableau de progression de cohorte ANONYMISÉ (agrégats, aucun individu) ;
 *  - le forum de pratique de la cohorte (fils + réponses ; modéré côté admin).
 * En ligne uniquement : l'écran affiche un bandeau hors-ligne le cas échéant.
 */

type Board = { members: number; distribution: number[]; avgPct: number; certified: number };
type CohortInfo = { cohort: { id: string; name: string } | null; board: Board | null };
type ThreadRow = { id: string; title: string; pinned: boolean; locked: boolean; createdAt: string; author?: { name?: string | null } | null; _count?: { posts: number } };
type Post = { id: string; body: string; createdAt: string; hidden?: boolean; author?: { name?: string | null } | null };
type ThreadDetail = { id: string; title: string; locked: boolean; posts: Post[] };

export function Cohorte({ eid }: { eid: string }) {
  const t = useT();
  const [info, setInfo] = useState<CohortInfo | null | "offline">(null);
  const [threads, setThreads] = useState<ThreadRow[] | null>(null);
  const [open, setOpen] = useState<ThreadDetail | null>(null);
  const [reply, setReply] = useState("");
  const [draft, setDraft] = useState<{ title: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api.get<CohortInfo>(`/enrollments/${eid}/cohort`);
        if (!alive) return;
        setInfo(d);
        if (d?.cohort) setThreads(await api.get<ThreadRow[]>(`/cohorts/${d.cohort.id}/threads`) ?? []);
      } catch { if (alive) setInfo("offline"); }
    })();
    return () => { alive = false; };
  }, [eid]);

  const openThread = async (id: string) => {
    try { setOpen(await api.get<ThreadDetail>(`/threads/${id}`)); setReply(""); } catch { /* réseau */ }
  };
  const refreshThreads = async () => {
    if (info && info !== "offline" && info.cohort) setThreads(await api.get<ThreadRow[]>(`/cohorts/${info.cohort.id}/threads`) ?? []);
  };
  const sendReply = async () => {
    if (!open || reply.trim().length < 2) return;
    setBusy(true);
    try { await api.post(`/threads/${open.id}/posts`, { body: reply.trim() }); await openThread(open.id); await refreshThreads(); }
    finally { setBusy(false); }
  };
  const createThread = async () => {
    if (!draft || !info || info === "offline" || !info.cohort || !draft.title.trim() || draft.body.trim().length < 2) return;
    setBusy(true);
    try { await api.post(`/cohorts/${info.cohort.id}/threads`, { title: draft.title.trim(), body: draft.body.trim() }); setDraft(null); await refreshThreads(); }
    finally { setBusy(false); }
  };

  const Back = () => <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ paddingLeft: 0 }} onClick={() => navigate(routes.cours(eid))}>{t("nav.backCourse")}</button>;

  if (info === null) return <div className="stack"><Back /><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" /></div>;
  if (info === "offline") return <div className="stack"><Back /><p className="banner offline">{t("ch.offline")}</p></div>;
  if (!info.cohort) return <div className="stack"><Back /><div className="hf-card"><p className="body" style={{ margin: 0 }}>{t("ch.none")}</p></div></div>;

  const b = info.board!;
  const maxBar = Math.max(1, ...b.distribution);
  const stageLabel = (i: number) => (i === 5 ? t("ch.certified") : t("ch.blocksDone", { n: i }));

  return (
    <div className="stack">
      <Back />
      <div><div className="eyebrow">{t("ch.eyebrow")}</div><h1 style={{ marginTop: 6 }}>{info.cohort.name}</h1></div>

      {/* Tableau anonymisé — agrégats uniquement, personne n'est identifié. */}
      <div className="hf-card hf-card--icy stack">
        <div className="row between">
          <strong className="h4">{t("ch.boardTitle")}</strong>
          <span className="hf-pill hf-pill--soft hf-pill--sm">{t("ch.members", { n: b.members })}</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          {b.distribution.map((n, i) => (
            <div key={i} className="row" style={{ gap: 10, alignItems: "center" }}>
              <span className="meta" style={{ width: 110, flexShrink: 0 }}>{stageLabel(i)}</span>
              <div style={{ flex: 1, background: "var(--line)", borderRadius: 6, height: 10, overflow: "hidden" }}>
                <div style={{ width: `${(n / maxBar) * 100}%`, height: "100%", background: "var(--green-600, #2E9E58)", borderRadius: 6 }} />
              </div>
              <span className="meta" style={{ width: 24, textAlign: "right" }}>{n}</span>
            </div>
          ))}
        </div>
        <p className="meta" style={{ margin: 0 }}>{t("ch.avg", { pct: b.avgPct })} · {t("ch.certCount", { n: b.certified })}</p>
        <p className="meta" style={{ margin: 0, fontStyle: "italic" }}>{t("ch.anonNote")}</p>
      </div>

      {/* Forum de pratique */}
      <div className="row between">
        <strong className="h4">{t("ch.forumTitle")}</strong>
        <button className="hf-btn hf-btn--sm hf-btn--outline" onClick={() => setDraft(draft ? null : { title: "", body: "" })}>{draft ? t("common.cancel") : t("ch.newThread")}</button>
      </div>

      {draft && (
        <div className="hf-card stack">
          <input className="hf-field" placeholder={t("ch.threadTitlePh")} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <textarea className="hf-field" style={{ minHeight: 80 }} placeholder={t("ch.threadBodyPh")} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <button className="hf-btn hf-btn--primary" disabled={busy || !draft.title.trim() || draft.body.trim().length < 2} onClick={createThread}>{busy ? "…" : t("ch.publish")}</button>
        </div>
      )}

      {(threads ?? []).length === 0 && !draft && <div className="hf-card"><p className="body" style={{ margin: 0 }}>{t("ch.noThreads")}</p></div>}

      {(threads ?? []).map((th) => (
        <div key={th.id} className="hf-card stack" style={{ gap: 8 }}>
          <div className="hf-rowtap row between" style={{ cursor: "pointer" }} onClick={() => (open?.id === th.id ? setOpen(null) : void openThread(th.id))}>
            <span className="row" style={{ gap: 8 }}>
              <span style={{ fontSize: 16 }}>{th.pinned ? "📌" : "💬"}</span>
              <strong className="h4" style={{ fontWeight: 600 }}>{th.title}</strong>
            </span>
            <span className="meta">{t("ch.replies", { n: Math.max(0, (th._count?.posts ?? 1) - 1) })} {open?.id === th.id ? "▴" : "▾"}</span>
          </div>
          {open?.id === th.id && (
            <div className="stack" style={{ gap: 8, marginLeft: 6, borderLeft: "3px solid var(--line)", paddingLeft: 10 }}>
              {open.posts.filter((p) => !p.hidden).map((p) => (
                <div key={p.id}>
                  <div className="meta">{p.author?.name || t("ch.anonymous")} · {new Date(p.createdAt).toLocaleDateString("fr-FR")}</div>
                  <p className="body" style={{ margin: "2px 0 0", whiteSpace: "pre-wrap" }}>{p.body}</p>
                </div>
              ))}
              {open.locked ? (
                <p className="meta" style={{ margin: 0 }}>🔒 {t("ch.locked")}</p>
              ) : (
                <div className="stack" style={{ gap: 6 }}>
                  <textarea className="hf-field" style={{ minHeight: 60 }} placeholder={t("ch.replyPh")} value={reply} onChange={(e) => setReply(e.target.value)} />
                  <button className="hf-btn hf-btn--sm hf-btn--primary" style={{ alignSelf: "flex-end" }} disabled={busy || reply.trim().length < 2} onClick={sendReply}>{busy ? "…" : t("ch.reply")}</button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
