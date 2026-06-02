import { useEffect, useState } from "react";
import { engine, store } from "../lib/app";

type Bundle = { bundleVersion: string; course: { title: string }; content: { blocks: any[] } };

export function Course() {
  const [eid, setEid] = useState(localStorage.getItem("klms_eid") || "");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  async function refreshPending(id: string) { setPending(await engine.pendingCount(id)); }

  async function load() {
    if (!eid) return;
    localStorage.setItem("klms_eid", eid);
    setMsg("Téléchargement du parcours pour le mode hors-ligne…");
    const cached = await store.getBundle<Bundle>(eid);
    if (cached) setBundle(cached);
    const b = await engine.cacheBundle(eid);
    if (b) { setBundle(b); setMsg("Parcours disponible hors-ligne ✓"); }
    else setMsg("Indisponible (hors-ligne et pas de cache)");
    await refreshPending(eid);
  }

  async function complete(blockIndex: number, itemKey: string) {
    await engine.record(eid, "complete_item", { blockIndex, itemType: "MICRO_SESSION", itemKey });
    await refreshPending(eid);
    const r = await engine.flush(eid);
    await refreshPending(eid);
    setMsg((r as any).offline ? "Action enregistrée hors-ligne — sera synchronisée à la reconnexion." : `Synchronisé (${r.synced}).`);
  }

  async function syncNow() {
    const r = await engine.flush(eid);
    await refreshPending(eid);
    setMsg((r as any).offline ? "Toujours hors-ligne." : `Synchronisé (${r.synced}).`);
  }

  return (
    <div>
      <div className="row">
        <input placeholder="Identifiant d'inscription (enrollmentId)" value={eid} onChange={(e) => setEid(e.target.value)} />
        <button onClick={load}>Charger</button>
        <span className={online ? "badge ok" : "badge ko"}>{online ? "en ligne" : "hors-ligne"}</span>
        {pending > 0 && <span className="badge">{pending} en attente <button onClick={syncNow}>synchroniser</button></span>}
      </div>
      {msg && <p className="muted">{msg}</p>}

      {bundle && (
        <>
          <h1>{bundle.course.title}</h1>
          {bundle.content.blocks.map((b: any) => (
            <section key={b.index} className="card">
              <h2>{b.index}. {b.title}</h2>
              {(b.payload?.microSessions ?? []).map((m: any) => (
                <div key={m.id} className="row">
                  <span>🎬 {m.id} — {m.title}</span>
                  <button onClick={() => complete(b.index, m.id)}>Marquer terminé</button>
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
