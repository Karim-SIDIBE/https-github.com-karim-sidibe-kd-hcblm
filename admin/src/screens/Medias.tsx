import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api, type MediaAsset, type MediaFolder, ApiError } from "../lib/api";
import { ago } from "../lib/ui";

const STATUS: Record<string, { cls: string; label: string }> = {
  READY: { cls: "pill--green", label: "Prêt" },
  PROCESSING: { cls: "pill--warn", label: "Traitement…" },
  UPLOADED: { cls: "pill--info", label: "Reçu" },
  FAILED: { cls: "pill--red", label: "Échec" },
};
const KIND: Record<string, string> = { VIDEO: "🎬 Vidéo", AUDIO: "🎵 Audio", IMAGE: "🖼️ Image", CAPTIONS: "💬 Sous-titres" };
const QLABEL: Record<string, string> = { source: "Source (max)", "720p": "720p (HD)", "480p": "480p", "240p-lite": "240p (éco)", audio: "Audio seul" };
const qlabel = (l: string) => QLABEL[l] ?? l;
type Rend = { label: string; kind: string; url: string | null; bitrateKbps?: number | null };

function size(n: number | null) { if (!n) return "—"; const u = ["o", "Ko", "Mo", "Go"]; let i = 0, v = n; while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; } return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`; }
function dur(s: number | null) { if (!s) return "—"; const m = Math.floor(s / 60), x = Math.round(s % 60); return `${m}:${String(x).padStart(2, "0")}`; }

export function Medias() {
  const [rows, setRows] = useState<MediaAsset[] | null>(null);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  // Library filter: "all" | "root" (sans dossier) | a folder id.
  const [sel, setSel] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const [assets, fold] = await Promise.all([api.media(), api.mediaFolders()]);
      setRows(assets); setFolders(fold);
    } catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); setRows([]); }
  }
  useEffect(() => { void load(); }, []);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true); setNote(null);
    // Uploads land in the folder currently open (root if "Tous" / "Racine").
    const target = sel !== "all" && sel !== "root" ? sel : null;
    let ok = 0;
    for (const f of Array.from(files)) {
      try {
        const a = await api.uploadMedia(f);
        if (target) await api.updateMedia(a.id, { folderId: target });
        ok++; setNote(`✅ « ${a.filename ?? f.name} » téléversé (${a.status})${target ? ` dans « ${folders.find((x) => x.id === target)?.name} »` : ""}.`);
      }
      catch (e) { setNote(`✗ ${f.name} : ${e instanceof ApiError ? e.message : "échec"}`); }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (ok) load();
  }

  // --- dossiers ---
  async function createFolder() {
    const name = window.prompt("Nom du nouveau dossier (ex. le nom du parcours) :");
    if (!name?.trim()) return;
    try { const f = await api.createMediaFolder(name); setNote(`📁 Dossier « ${f.name} » créé.`); setSel(f.id); load(); }
    catch (e) { setNote(e instanceof ApiError ? e.message : "Création impossible"); }
  }
  async function renameFolder(f: MediaFolder) {
    const name = window.prompt("Nouveau nom du dossier :", f.name);
    if (!name?.trim() || name.trim() === f.name) return;
    try { const r = await api.renameMediaFolder(f.id, name); setNote(`📁 Dossier renommé en « ${r.name} ».`); load(); }
    catch (e) { setNote(e instanceof ApiError ? e.message : "Renommage impossible"); }
  }
  async function removeFolder(f: MediaFolder) {
    if (!window.confirm(`Supprimer le dossier vide « ${f.name} » ?`)) return;
    try { await api.deleteMediaFolder(f.id); setNote(`🗑️ Dossier « ${f.name} » supprimé.`); if (sel === f.id) setSel("all"); load(); }
    catch (e) { setNote(e instanceof ApiError ? e.message : "Suppression impossible"); }
  }

  // --- médias : renommer / déplacer ---
  async function renameAsset(m: MediaAsset) {
    const name = window.prompt("Nouveau nom du média :", m.filename ?? "");
    if (!name?.trim() || name.trim() === m.filename) return;
    try { const a = await api.updateMedia(m.id, { filename: name }); setNote(`✏️ Renommé en « ${a.filename} ».`); load(); }
    catch (e) { setNote(e instanceof ApiError ? e.message : "Renommage impossible"); }
  }
  async function moveAsset(m: MediaAsset, folderId: string | null) {
    try {
      await api.updateMedia(m.id, { folderId });
      setNote(`📁 « ${m.filename ?? m.id} » déplacé vers ${folderId ? `« ${folders.find((f) => f.id === folderId)?.name} »` : "la racine"}.`);
      load();
    } catch (e) { setNote(e instanceof ApiError ? e.message : "Déplacement impossible"); }
  }

  function copyId(id: string) { navigator.clipboard?.writeText(id).then(() => setNote(`Identifiant copié : ${id}`)).catch(() => {}); }

  async function remove(m: MediaAsset) {
    if (!window.confirm(`Supprimer définitivement « ${m.filename ?? m.id} » ?\nLes fichiers vidéo (source + tous les débits) seront effacés. Action irréversible.`)) return;
    try { const r = await api.deleteMedia(m.id); setNote(`🗑️ « ${m.filename ?? m.id} » supprimé (${r.removedObjects} fichier(s) effacé(s)).`); load(); }
    catch (e) { setNote(e instanceof ApiError ? e.message : "Suppression impossible"); }
  }

  const [preview, setPreview] = useState<{ asset: MediaAsset; renditions: Rend[]; sel: string } | null>(null);
  async function openPreview(m: MediaAsset) {
    setNote(null); setPreview({ asset: m, renditions: [], sel: "" });
    try {
      const pb = await api.mediaPlayback(m.id);
      const rends = (pb.renditions ?? []) as Rend[];
      // Default to the best VIDEO rendition (admins want to SEE the picture, not
      // land on audio-only because it sorts first); fall back to whatever exists.
      const def = [...rends].filter((r) => r.kind === "VIDEO").sort((a, b) => (b.bitrateKbps ?? 0) - (a.bitrateKbps ?? 0))[0] ?? rends[0];
      setPreview({ asset: m, renditions: rends, sel: def?.label ?? "" });
    } catch (e) { setPreview({ asset: m, renditions: [], sel: "" }); setNote(e instanceof Error ? e.message : "Aperçu indisponible"); }
  }

  const all = rows ?? [];
  const rootCount = all.filter((m) => !m.folderId).length;
  const visible = sel === "all" ? all : sel === "root" ? all.filter((m) => !m.folderId) : all.filter((m) => m.folderId === sel);
  const selFolder = folders.find((f) => f.id === sel) ?? null;
  const chip = (active: boolean): CSSProperties => ({
    padding: "5px 12px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${active ? "var(--accent, #F36F21)" : "var(--border, #d8dce4)"}`,
    background: active ? "var(--accent-tint, #FFF3E8)" : "transparent",
    fontWeight: active ? 600 : 400,
  });

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{rows ? `${visible.length} média${visible.length > 1 ? "s" : ""}${sel !== "all" ? ` · ${selFolder ? selFolder.name : "racine"}` : ""}` : "…"}</div>
          <h1>Médiathèque</h1>
          <div className="sub">Téléversez vos vidéos et ressources, organisées en dossiers (un dossier ≈ un parcours). Le téléversement va dans le dossier ouvert.</div>
        </div>
        <div>
          <input ref={fileRef} type="file" accept="video/*,audio/*,image/*,text/vtt" multiple style={{ display: "none" }} onChange={(e) => upload(e.target.files)} />
          <button className="btn btn--primary" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Téléversement…" : "⤴ Téléverser un média"}</button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={chip(sel === "all")} onClick={() => setSel("all")}>Tous ({all.length})</span>
        <span style={chip(sel === "root")} onClick={() => setSel("root")}>Racine ({rootCount})</span>
        {folders.map((f) => (
          <span key={f.id} style={chip(sel === f.id)} onClick={() => setSel(f.id)}>📁 {f.name} ({f.assetCount})</span>
        ))}
        <button className="btn btn--sm" onClick={createFolder} title="Créer un dossier (ex. un par parcours)">＋ Dossier</button>
        {selFolder && (
          <>
            <button className="btn btn--sm" onClick={() => renameFolder(selFolder)} title="Renommer ce dossier">✏️ Renommer</button>
            {selFolder.assetCount === 0 && (
              <button className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => removeFolder(selFolder)} title="Supprimer ce dossier vide">🗑️</button>
            )}
          </>
        )}
      </div>

      {note && <div className="card" style={{ background: note.startsWith("✅") || note.startsWith("Identifiant") ? "var(--success-tint)" : "var(--warning-tint)", border: "none", padding: "11px 14px", marginBottom: 14, fontSize: 13 }} onClick={() => setNote(null)}>{note}</div>}

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Fichier</th><th>Dossier</th><th>Type</th><th>Durée</th><th>Taille</th><th>Qualités</th><th>État</th><th>Ajouté</th><th>Identifiant</th></tr></thead>
            <tbody>
              {visible.map((m) => {
                const st = STATUS[m.status] ?? { cls: "pill--soft", label: m.status };
                return (
                  <tr key={m.id}>
                    <td><b style={{ fontSize: 13 }}>{m.filename ?? "(sans nom)"}</b><div style={{ fontSize: 11, color: "var(--fg-3)" }}>{m.mime}</div></td>
                    <td>
                      <select value={m.folderId ?? ""} title="Déplacer vers un dossier" style={{ fontSize: 12, maxWidth: 140 }}
                        onChange={(e) => moveAsset(m, e.target.value || null)}>
                        <option value="">(racine)</option>
                        {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </td>
                    <td>{KIND[m.kind] ?? m.kind}</td>
                    <td>{dur(m.durationSec)}</td>
                    <td>{size(m.sizeBytes)}</td>
                    <td><span className="muted" style={{ fontSize: 12 }}>{m.renditions.length ? m.renditions.join(", ") : "—"}</span></td>
                    <td><span className={`pill ${st.cls}`} title={m.error ?? undefined}>{st.label}</span></td>
                    <td><span className="muted" style={{ fontSize: 12.5 }}>{ago(m.createdAt)}</span></td>
                    <td><div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn--sm" onClick={() => openPreview(m)} title="Prévisualiser le média">▶ Aperçu</button>
                      <button className="btn btn--sm" onClick={() => renameAsset(m)} title="Renommer ce média">✏️</button>
                      <button className="btn btn--sm" onClick={() => copyId(m.id)} title="Copier l'identifiant du média">⧉ Copier</button>
                      <button className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => remove(m)} title="Supprimer ce média">🗑️</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows && <div className="empty">Chargement…</div>}
          {rows && visible.length === 0 && <div className="empty"><div className="big">🎬</div>{sel === "all" ? "Aucun média. Téléversez votre première vidéo." : "Dossier vide. Téléversez ici ou déplacez des médias via la colonne Dossier."}</div>}
        </div>
      </div>

      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 18, maxWidth: 760, width: "100%", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <b>{preview.asset.filename ?? "Aperçu"}</b>
              <button className="btn btn--sm" onClick={() => setPreview(null)}>✕ Fermer</button>
            </div>
            {preview.asset.status === "FAILED" ? (
              <div style={{ color: "var(--danger)", fontSize: 13 }}>❌ Le traitement a échoué. {preview.asset.error}</div>
            ) : (() => {
              const active = preview.renditions.find((r) => r.label === preview.sel) ?? null;
              if (!active?.url) {
                return preview.asset.status !== "READY"
                  ? <div className="muted" style={{ fontSize: 13 }}>⏳ Média en cours de traitement ({preview.asset.status})… réessayez dans un instant.</div>
                  : <div className="muted" style={{ fontSize: 13 }}>Aperçu indisponible pour ce type de média (aucune piste lisible).</div>;
              }
              return (
                <>
                  {preview.renditions.length > 1 && (
                    <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <label className="muted" style={{ fontSize: 12 }}>Qualité</label>
                      <select value={preview.sel} onChange={(e) => setPreview((p) => p && ({ ...p, sel: e.target.value }))}>
                        {preview.renditions.map((r) => <option key={r.label} value={r.label}>{qlabel(r.label)}{r.bitrateKbps ? ` · ${r.bitrateKbps}k` : ""}</option>)}
                      </select>
                    </div>
                  )}
                  {active.kind === "AUDIO"
                    ? <audio key={active.url} controls src={active.url} style={{ width: "100%" }} />
                    : <video key={active.url} controls src={active.url} style={{ width: "100%", maxHeight: "60vh", borderRadius: 8, background: "#000" }} />}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
