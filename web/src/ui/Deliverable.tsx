import { useEffect, useMemo, useState } from "react";
import { api, engine, store } from "../lib/app";
import { getCachedProgress, setCachedProgress } from "../lib/cache";
import { goNext, nextTarget } from "../lib/nav";
import { navigate, routes } from "../lib/router";
import { assessText, assessmentReason, fieldExpectsNumber } from "../lib/textcheck";
import { answerOf, useAnswers } from "../lib/answers";
import { Breadcrumb } from "./Breadcrumb";
import { useT, useI18n } from "../lib/i18n";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

type FieldSpec = { label: string; placeholder?: string };
type StepSpec = { title: string; intro?: string; fields: FieldSpec[] };
type JournalState = { day: number; done: boolean; unlocksAt: string | null; unlocked: boolean };

/**
 * Deliverable — PAM-context written submissions: the Block 2 field application
 * (guided 3-étape form) and Block 4 journal entries. Free text goes through the
 * plausibility gate (3e point), journal entries respect their J+n unlock dates
 * (progressive Bloc 4), and a personalised ✨ feedback follows the submission.
 */
export function Deliverable({ eid, block, itemKey }: { eid: string; block: number; itemKey: string }) {
  const t = useT();
  const { lang } = useI18n();
  const [bundle, setBundle] = useState<any>(null);
  const [text, setText] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [journal, setJournal] = useState<JournalState[] | null>(null);
  const [after, setAfter] = useState<null | { progress: any; ai: string | null; aiLoading: boolean }>(null);

  const isJournal = /^J\+\d+$/.test(itemKey);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid));
      if (alive) setBundle(b);
      if (isJournal) {
        try { const st = await api.get<{ journal: JournalState[] }>(`/enrollments/${eid}/project/state`); if (alive) setJournal(st?.journal ?? []); }
        catch { if (alive) setJournal([]); }
      }
    })();
    return () => { alive = false; };
  }, [eid, isJournal]);

  const blk = useMemo(() => bundle?.content?.blocks?.find((x: any) => x.index === block), [bundle, block]);

  const spec = useMemo(() => {
    if (!blk) return null;
    if (itemKey === "field") {
      const fa = blk?.payload?.fieldApplication;
      return fa ? {
        kind: "field" as const, eyebrow: t("dl.fieldEyebrow"), title: fa.title || t("dl.fieldTitle"), brief: fa.brief,
        steps: (fa.steps ?? []) as StepSpec[], min: fa.minChars ?? 200, unit: "caractères", itemType: "FIELD_APPLICATION",
      } : null;
    }
    const entry = (blk?.payload?.journal?.entries ?? []).find((e: any) => `J+${e.day}` === itemKey);
    return entry ? { kind: "journal" as const, eyebrow: t("jr.eyebrow"), title: t("dl.journalTitle", { key: itemKey }), brief: entry.prompt, steps: [] as StepSpec[], min: entry.minWords ?? 50, unit: "mots", itemType: "JOURNAL_ENTRY", placeholder: (entry.placeholder as string) || "" } : null;
  }, [blk, itemKey, t]);

  // Frozen results: a submitted deliverable is consultable, not re-editable.
  const answersMap = useAnswers(eid);
  const doneRow = answerOf(answersMap, block, itemKey);

  const structured = (spec?.steps?.length ?? 0) > 0;
  const count = spec?.unit === "mots" ? words(text) : text.trim().length;
  // Plausibility gate (3e point) — the button is blocked WITH the reason shown.
  const quality: string | null = (() => {
    if (!spec) return null;
    if (structured) {
      for (const s of spec.steps) for (const f of s.fields) {
        const v = (values[f.label] ?? "").trim();
        if (!v) continue;
        const r = assessmentReason(assessText(v, { requireNumber: fieldExpectsNumber(f.label, f.placeholder) }), t);
        if (r) return `${f.label} — ${r}`;
      }
      return null;
    }
    if (count < spec.min) return null; // the counter already explains
    return assessmentReason(assessText(text, { minWords: 5 }), t);
  })();
  const ok = spec ? quality == null && (structured
    ? spec.steps.every((s) => s.fields.every((f) => (values[f.label] ?? "").trim().length > 0))
    : count >= spec.min) : false;

  // Progressive Bloc 4: an entry not yet unlocked shows its opening date.
  const lockedEntry = isJournal && journal ? journal.find((j) => `J+${j.day}` === itemKey && !j.unlocked && !j.done) : undefined;

  async function submit() {
    if (!ok || !spec) return;
    setBusy(true);
    try {
      const data = structured
        ? { fields: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])), text: Object.entries(values).map(([k, v]) => `${k} : ${v.trim()}`).join("\n") }
        : { text: text.trim() };
      const r = await engine.commit(eid, "complete_item", { blockIndex: block, itemType: spec.itemType, itemKey, data });
      if ((r as any).progress) setCachedProgress(eid, (r as any).progress);
      // Personalised feedback on the saved submission (AI when configured,
      // context-aware heuristic otherwise). Offline → chain straight on.
      if (navigator.onLine) {
        setAfter({ progress: (r as any).progress ?? null, ai: null, aiLoading: true });
        try {
          const f = await api.post<{ feedback?: string }>(`/enrollments/${eid}/feedback`, { blockIndex: block, itemKey });
          setAfter({ progress: (r as any).progress ?? null, ai: f?.feedback ?? null, aiLoading: false });
        } catch { setAfter({ progress: (r as any).progress ?? null, ai: null, aiLoading: false }); }
      } else {
        goNext(eid, nextTarget(bundle?.content, (r as any).progress ?? getCachedProgress(eid), block, itemKey, t));
      }
    } finally { setBusy(false); }
  }

  const Back = () => <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ paddingLeft: 0 }} onClick={() => navigate(routes.cours(eid))}>{t("nav.backCourse")}</button>;
  if (!bundle || answersMap === null || (isJournal && journal === null)) return <div className="stack"><Back /><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" /></div>;
  if (!spec) return <div className="stack"><Back /><p className="banner offline">{t("dl.notFound")}</p></div>;

  if (doneRow && !after) {
    const d = (doneRow.data ?? {}) as { fields?: Record<string, string>; text?: string };
    return (
      <div className="stack">
        <Breadcrumb eid={eid} block={blk} itemKey={itemKey} />
        <div><div className="eyebrow">{spec.eyebrow}</div><h1 style={{ marginTop: 6 }}>{spec.title}</h1></div>
        <div className="hf-card hf-card--icy"><p className="body" style={{ margin: 0 }}>🔒 {t("frz.note")}</p></div>
        <div className="hf-card stack" style={{ gap: 8 }}>
          <div className="eyebrow">{t("frz.yourAnswer")}</div>
          {d.fields && Object.keys(d.fields).length > 0
            ? Object.entries(d.fields).map(([label, v]) => (
                <div key={label}><span className="meta">{label}</span><p className="body" style={{ margin: "2px 0 0", whiteSpace: "pre-wrap" }}>{v || "—"}</p></div>
              ))
            : <p className="body" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{d.text || "—"}</p>}
        </div>
        <button className="hf-btn hf-btn--primary hf-btn--block" onClick={() => goNext(eid, nextTarget(bundle?.content, getCachedProgress(eid), block, itemKey, t))}>{t("common.continue")}</button>
      </div>
    );
  }

  if (lockedEntry) {
    const when = lockedEntry.unlocksAt ? new Date(lockedEntry.unlocksAt).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR") : null;
    return (
      <div className="stack">
        <Breadcrumb eid={eid} block={blk} itemKey={itemKey} />
        <div className="hf-card center stack">
          <p style={{ fontSize: 40, margin: 0 }}>🔒</p>
          <h2 style={{ margin: 0 }}>{spec.title}</h2>
          <p className="body">{when ? t("dl.journalLockedAt", { date: when, day: lockedEntry.day }) : t("dl.journalLockedAfter43")}</p>
        </div>
      </div>
    );
  }

  if (after) {
    return (
      <div className="stack">
        <Breadcrumb eid={eid} block={blk} itemKey={itemKey} />
        <div className="hf-card center stack pt-reveal">
          <p style={{ fontSize: 40, margin: 0 }}>✅</p>
          <h2 style={{ margin: 0 }}>{t("dl.submitted")}</h2>
        </div>
        {after.aiLoading && <p className="meta">✨ {t("ex.aiLoading")}</p>}
        {after.ai && (
          <div className="hf-card hf-card--icy">
            <div className="eyebrow">✨ {t("ex.aiTitle")}</div>
            <p className="body" style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{after.ai}</p>
          </div>
        )}
        <button className="hf-btn hf-btn--primary hf-btn--block" onClick={() => goNext(eid, nextTarget(bundle?.content, after.progress ?? getCachedProgress(eid), block, itemKey, t))}>{t("common.continue")}</button>
      </div>
    );
  }

  return (
    <div className="stack">
      <Breadcrumb eid={eid} block={blk} itemKey={itemKey} />
      <div><div className="eyebrow">{spec.eyebrow}</div><h1 style={{ marginTop: 6 }}>{spec.title}</h1></div>

      <div className="hf-card hf-card--stripe-orange stack">
        <div className="hf-pam"><span className="tag">{t("mission")}</span><div className="quote" style={{ whiteSpace: "pre-wrap" }}>{spec.brief}</div></div>

        {structured ? (
          <>
            {spec.steps.map((s) => (
              <div key={s.title} className="stack" style={{ gap: 8 }}>
                <strong className="h4">{s.title}</strong>
                {s.intro && <p className="meta" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{s.intro}</p>}
                {s.fields.map((f) => (
                  <label key={f.label}>{f.label}
                    <input className="hf-field" spellCheck lang="fr" value={values[f.label] ?? ""} placeholder={f.placeholder || "…"}
                      onChange={(e) => setValues((v) => ({ ...v, [f.label]: e.target.value }))}
                      onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
                  </label>
                ))}
              </div>
            ))}
          </>
        ) : (
          <div className="hf-textwrap">
            <textarea className="hf-field" spellCheck lang="fr" value={text} onChange={(e) => setText(e.target.value)} placeholder={("placeholder" in spec && spec.placeholder) || t("answerPlaceholder")} style={{ minHeight: 180 }}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
            <span className="hf-count" style={{ color: ok ? "var(--brand-declick)" : undefined }}>{count} / {spec.min} {spec.unit === "mots" ? t("dl.unitWords") : t("dl.unitChars")}</span>
          </div>
        )}
        {quality && <p className="meta" style={{ margin: 0, color: "var(--danger, #b45309)" }}>{quality}</p>}
        <button className="hf-btn hf-btn--primary hf-btn--block" disabled={busy || !ok} onClick={submit}>{busy ? "…" : t("dl.submit")}</button>
      </div>
    </div>
  );
}
