import { useEffect, useState } from "react";
import { engine, store } from "../lib/app";
import { rememberEnrollment } from "../lib/autosync";
import { navigate, routes } from "../lib/router";

type Bundle = { bundleVersion: string; course: { title: string }; content: { blocks: any[] } };

/** Phase-0 course shell: loads + caches the bundle and lists blocks. The rich
 *  dashboard (session cards, resume, progress) arrives in Phase 1. */
export function Course({ eid }: { eid: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    rememberEnrollment(eid);
    (async () => {
      const cached = await store.getBundle<Bundle>(eid);
      if (alive && cached) setBundle(cached);
      const b = await engine.cacheBundle(eid);
      if (alive && b) { setBundle(b); setMsg(null); }
      else if (alive && !cached) setMsg("Parcours indisponible (hors-ligne et non téléchargé).");
    })();
    return () => { alive = false; };
  }, [eid]);

  async function complete(blockIndex: number, itemKey: string) {
    const r = await engine.commit(eid, "complete_item", { blockIndex, itemType: "MICRO_SESSION", itemKey });
    setMsg((r as any).offline ? "Enregistré hors-ligne — synchronisation à la reconnexion." : "Progression enregistrée ✓");
  }

  if (!bundle) {
    return (
      <div>
        <button className="ghost" onClick={() => navigate(routes.enrollments())}>← Mes parcours</button>
        {msg ? <p className="banner offline">{msg}</p> : <><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" /></>}
      </div>
    );
  }

  return (
    <div>
      <button className="ghost" onClick={() => navigate(routes.enrollments())}>← Mes parcours</button>
      <h1>{bundle.course.title}</h1>
      {msg && <p className="muted">{msg}</p>}
      {bundle.content.blocks.map((b: any) => (
        <section key={b.index} className="card">
          <h2>{b.index}. {b.title}</h2>
          <div className="stack">
            {(b.payload?.microSessions ?? []).map((m: any) => (
              <div key={m.id} className="row between">
                <span>🎬 {m.id} — {m.title}</span>
                <button className="secondary" onClick={() => complete(b.index, m.id)}>Terminé</button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
