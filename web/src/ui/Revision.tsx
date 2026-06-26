import { useEffect, useState } from "react";
import { api } from "../lib/app";
import { navigate, routes } from "../lib/router";
import { useT } from "../lib/i18n";

type Wrong = { id: string; subArea: string | null; prompt: string; options: { key: string; label: string }[]; correctKey: string; yourKey: string; feedback: string };
type Review = { taken: boolean; total?: number; wrong: Wrong[] };

/** Adaptive remediation — review the diagnostic questions the learner got wrong. */
export function Revision({ eid }: { eid: string }) {
  const t = useT();
  const [data, setData] = useState<Review | null>(null);
  useEffect(() => {
    let alive = true;
    api.get<Review>(`/enrollments/${eid}/diagnostic/review`)
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData({ taken: false, wrong: [] }); });
    return () => { alive = false; };
  }, [eid]);

  return (
    <div className="stack">
      <button className="ghost" onClick={() => navigate(routes.course(eid))}>← {t("nav.home")}</button>
      <div><div className="eyebrow">{t("rev.eyebrow")}</div><h1 style={{ marginTop: 6 }}>{t("rev.title")}</h1></div>
      {!data ? <div className="skeleton card" style={{ height: 160 }} />
        : !data.taken ? <div className="hf-card"><p className="body" style={{ margin: 0 }}>{t("rev.noQuiz")}</p></div>
        : data.wrong.length === 0 ? <div className="hf-card hf-card--mint"><p className="body" style={{ margin: 0 }}>{t("rev.noErrors")}</p></div>
        : <>
            <p className="body">{t("rev.intro")}</p>
            {data.wrong.map((q, i) => (
              <div key={q.id} className="hf-card stack">
                {q.subArea && <div className="eyebrow">{q.subArea}</div>}
                <strong className="h4" style={{ margin: 0 }}>{i + 1}. {q.prompt}</strong>
                <div className="stack" style={{ gap: 6 }}>
                  {q.options.map((o) => {
                    const correct = o.key === q.correctKey, yours = o.key === q.yourKey;
                    return (
                      <div key={o.key} style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", background: correct ? "var(--brand-declick-tint)" : yours ? "#fdecea" : "var(--bg)", fontSize: 13.5, color: "var(--fg-1)" }}>
                        {correct ? "✅ " : yours ? "❌ " : ""}{o.label}{correct ? t("rev.goodAnswer") : yours ? t("rev.yourAnswer") : ""}
                      </div>
                    );
                  })}
                </div>
                {q.feedback && <div className="hf-card hf-card--icy" style={{ marginTop: 2 }}><div className="eyebrow">{t("rev.why")}</div><p className="body" style={{ margin: "4px 0 0" }}>{q.feedback}</p></div>}
              </div>
            ))}
            <button className="hf-btn hf-btn--primary hf-btn--block" onClick={() => navigate(routes.cours(eid))}>{t("rev.resume")}</button>
          </>}
    </div>
  );
}
