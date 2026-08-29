import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatTimestamp, parseVtt, serializeVtt, shiftCues, type VttCue } from "@kd/shared/vtt";
import { api, type CaptionTrack, type MediaAsset, type MediaFolder, ApiError } from "../lib/api";
import { ago } from "../lib/ui";
import { Pager } from "../lib/widgets";
import { modal } from "../lib/modal";

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

const PAGE_SIZE = 30;

export function Medias() {
  const [rows, setRows] = useState<MediaAsset[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  // Library filter: "all" | "root" (sans dossier) | a folder id.
  const [sel, setSel] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const [assets, fold] = await Promise.all([
        api.mediaPaged({ q, folder: sel === "all" ? undefined : sel, page, pageSize: PAGE_SIZE }),
        api.mediaFolders(),
      ]);
      setRows(assets.data); setTotal(assets.total); setFolders(fold);
    } catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); setRows([]); }
  }
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q, sel, page]);
  useEffect(() => { setPage(1); }, [q, sel]);

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
    const name = await modal.prompt({ title: "Nouveau dossier", label: "Nom (ex. le nom du parcours)", placeholder: "Gestion du temps — Niveau 1" });
    if (!name?.trim()) return;
    try { const f = await api.createMediaFolder(name); setNote(`📁 Dossier « ${f.name} » créé.`); setSel(f.id); load(); }
    catch (e) { setNote(e instanceof ApiError ? e.message : "Création impossible"); }
  }
  async function renameFolder(f: MediaFolder) {
    const name = await modal.prompt({ title: "Renommer le dossier", label: "Nouveau nom", initial: f.name });
    if (!name?.trim() || name.trim() === f.name) return;
    try { const r = await api.renameMediaFolder(f.id, name); setNote(`📁 Dossier renommé en « ${r.name} ».`); load(); }
    catch (e) { setNote(e instanceof ApiError ? e.message : "Renommage impossible"); }
  }
  async function removeFolder(f: MediaFolder) {
    if (!(await modal.confirm({ title: `Supprimer le dossier vide « ${f.name} » ?`, danger: true, okLabel: "Supprimer" }))) return;
    try { await api.deleteMediaFolder(f.id); setNote(`🗑️ Dossier « ${f.name} » supprimé.`); if (sel === f.id) setSel("all"); load(); }
    catch (e) { setNote(e instanceof ApiError ? e.message : "Suppression impossible"); }
  }

  // --- médias : renommer / déplacer ---
  async function renameAsset(m: MediaAsset) {
    const name = await modal.prompt({ title: "Renommer le média", label: "Nouveau nom", initial: m.filename ?? "" });
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
    if (!(await modal.confirm({ title: `Supprimer définitivement « ${m.filename ?? m.id} » ?`, body: "Les fichiers vidéo (source + tous les débits) seront effacés. Action irréversible.", danger: true, okLabel: "Supprimer" }))) return;
    try { const r = await api.deleteMedia(m.id); setNote(`🗑️ « ${m.filename ?? m.id} » supprimé (${r.removedObjects} fichier(s) effacé(s)).`); load(); }
    catch (e) { setNote(e instanceof ApiError ? e.message : "Suppression impossible"); }
  }

  const [preview, setPreview] = useState<{ asset: MediaAsset; renditions: Rend[]; sel: string; captions: CaptionTrack[] } | null>(null);
  const [capBusy, setCapBusy] = useState(false);
  const capFileRef = useRef<HTMLInputElement>(null);
  const capLangRef = useRef<"fr" | "en">("fr");
  async function openPreview(m: MediaAsset) {
    setNote(null); setCapEdit(null); setPreview({ asset: m, renditions: [], sel: "", captions: [] });
    try {
      const pb = await api.mediaPlayback(m.id);
      const rends = (pb.renditions ?? []) as Rend[];
      // Default to the best VIDEO rendition (admins want to SEE the picture, not
      // land on audio-only because it sorts first); fall back to whatever exists.
      const def = [...rends].filter((r) => r.kind === "VIDEO").sort((a, b) => (b.bitrateKbps ?? 0) - (a.bitrateKbps ?? 0))[0] ?? rends[0];
      setPreview({ asset: m, renditions: rends, sel: def?.label ?? "", captions: pb.captions ?? [] });
    } catch (e) { setPreview({ asset: m, renditions: [], sel: "", captions: [] }); setNote(e instanceof Error ? e.message : "Aperçu indisponible"); }
  }

  // --- sous-titres (générés une fois pour toutes, puis servis statiquement) ---
  const capPollRef = useRef<number | null>(null);
  useEffect(() => () => { if (capPollRef.current) window.clearInterval(capPollRef.current); }, []);
  const doneNote = (r?: { fr: { label: string }; en: { label: string } | null; enError: string | null }) =>
    `💬 Sous-titres générés : ${r?.fr.label ?? "Français"}${r?.en ? ` + ${r.en.label}` : ""}.${r?.enError ? ` ⚠️ Anglais : ${r.enError}` : ""}`;
  /// Whisper local : la génération tourne côté serveur (plusieurs minutes) —
  /// on interroge le statut jusqu'à done/error puis on rafraîchit l'aperçu.
  function startCapPoll(m: MediaAsset) {
    if (capPollRef.current) window.clearInterval(capPollRef.current);
    capPollRef.current = window.setInterval(async () => {
      try {
        const s = await api.captionsStatus(m.id);
        if (s.state === "done" || s.state === "error") {
          window.clearInterval(capPollRef.current!); capPollRef.current = null; setCapBusy(false);
          setNote(s.state === "done" ? doneNote(s.result) : `✗ Génération échouée : ${s.error ?? "erreur inconnue"}`);
          if (s.state === "done") openPreview(m);
        }
      } catch { /* réseau transitoire — on réessaie au tick suivant */ }
    }, 8000);
  }
  async function generateCaps(m: MediaAsset) {
    setCapBusy(true);
    try {
      const r = await api.generateCaptions(m.id);
      if ("started" in r) {
        setNote("⏳ Génération lancée en arrière-plan (Whisper local) — comptez plusieurs minutes par vidéo, les pistes s'ajouteront toutes seules.");
        startCapPoll(m); // capBusy reste actif jusqu'à la fin
        return;
      }
      setNote(doneNote(r));
      openPreview(m);
      setCapBusy(false);
    } catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Génération impossible"}`); setCapBusy(false); }
  }
  async function importCaps(m: MediaAsset, file: File | null) {
    if (!file) return;
    setCapBusy(true);
    try {
      const content = await file.text();
      const format = file.name.toLowerCase().endsWith(".srt") ? "srt" as const : "vtt" as const;
      await api.attachCaptions(m.id, { language: capLangRef.current, content, format });
      setNote(`💬 Piste ${capLangRef.current.toUpperCase()} importée (${file.name}).`);
      openPreview(m);
    } catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Import impossible"}`); }
    finally { setCapBusy(false); if (capFileRef.current) capFileRef.current.value = ""; }
  }
  // --- éditeur de piste (lot STED) : corriger les textes, décaler la synchro ---
  const [capEdit, setCapEdit] = useState<{ language: string; label: string; cues: VttCue[]; offset: string } | null>(null);
  // L'éditeur s'ouvre SOUS le lecteur (souvent hors écran avec une vidéo 720p) :
  // on l'amène en vue, sinon le clic sur ✏️ semble ne rien faire.
  const capEditRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (capEdit) capEditRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [capEdit !== null]);
  async function editCaps(c: CaptionTrack) {
    if (!c.language) return;
    setCapBusy(true); setNote(null); setCapEdit(null);
    try {
      const res = await fetch(c.url); // URL absolue et tokenisée (?t=) — pas d'en-tête requis
      if (!res.ok) throw new Error(`Piste illisible (HTTP ${res.status})`);
      const cues = parseVtt(await res.text());
      if (cues.length === 0) throw new Error("Aucune cue lisible dans cette piste");
      setCapEdit({ language: c.language, label: c.label, cues, offset: "0" });
    } catch (e) {
      // Le bandeau de note est masqué derrière le panneau d'aperçu — une
      // erreur de chargement doit être VISIBLE, donc modale.
      await modal.alert({ title: "Édition impossible", body: e instanceof Error ? e.message : "Chargement de la piste impossible" });
    }
    finally { setCapBusy(false); }
  }
  function setCueText(i: number, text: string) {
    setCapEdit((p) => p && ({ ...p, cues: p.cues.map((c, j) => (j === i ? { ...c, text } : c)) }));
  }
  const capOffset = () => { const n = Number((capEdit?.offset ?? "0").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  async function saveCapEdit(m: MediaAsset) {
    if (!capEdit) return;
    setCapBusy(true); setNote(null);
    try {
      const off = capOffset();
      const cues = off !== 0 ? shiftCues(capEdit.cues, off) : capEdit.cues;
      await api.attachCaptions(m.id, { language: capEdit.language, content: serializeVtt(cues), format: "vtt", label: capEdit.label });
      setNote(`💬 Piste « ${capEdit.label} » enregistrée${off !== 0 ? ` — décalée de ${off > 0 ? "+" : ""}${off} s` : ""}. Répercutée chez tous les apprenants.`);
      setCapEdit(null);
      openPreview(m);
    } catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Enregistrement impossible"}`); }
    finally { setCapBusy(false); }
  }

  async function removeCaps(m: MediaAsset, c: CaptionTrack) {
    if (!c.language || !(await modal.confirm({ title: `Supprimer la piste « ${c.label} » ?`, danger: true, okLabel: "Supprimer" }))) return;
    try { await api.deleteCaptions(m.id, c.language); setNote(`🗑️ Piste « ${c.label} » supprimée.`); openPreview(m); }
    catch (e) { setNote(e instanceof ApiError ? e.message : "Suppression impossible"); }
  }

  const visible = rows ?? []; // server-filtered (folder + search) and paged
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
          <div className="eyebrow">{rows ? `${total} média${total > 1 ? "s" : ""}${sel !== "all" ? ` · ${selFolder ? selFolder.name : "racine"}` : ""}${q ? " · recherche" : ""}` : "…"}</div>
          <h1>Médiathèque</h1>
          <div className="sub">Téléversez vos vidéos et ressources, organisées en dossiers (un dossier ≈ un parcours). Le téléversement va dans le dossier ouvert.</div>
        </div>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <label className="search" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-pill)", padding: "8px 14px", width: 220 }}>
            <input style={{ border: 0, background: "none", outline: "none", fontFamily: "inherit", fontSize: 13, width: "100%" }} placeholder="Rechercher un fichier…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <input ref={fileRef} type="file" accept="video/*,audio/*,image/*,text/vtt" multiple style={{ display: "none" }} onChange={(e) => upload(e.target.files)} />
          <button className="btn btn--primary" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Téléversement…" : "⤴ Téléverser un média"}</button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={chip(sel === "all")} onClick={() => setSel("all")}>Tous</span>
        <span style={chip(sel === "root")} onClick={() => setSel("root")}>Racine</span>
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
          {rows && visible.length === 0 && <div className="empty"><div className="big">🎬</div>{q ? "Aucun média ne correspond à cette recherche." : sel === "all" ? "Aucun média. Téléversez votre première vidéo." : "Dossier vide. Téléversez ici ou déplacez des médias via la colonne Dossier."}</div>}
          {rows && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}
        </div>
      </div>

      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}>
          {/* Hauteur bornée + défilement : avec l'éditeur de sous-titres ouvert
              (80+ cues), le contenu dépasse l'écran — sans ceci, le bas de la
              fenêtre serait simplement coupé et inatteignable. */}
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 18, maxWidth: 760, width: "100%", boxShadow: "var(--shadow-lg)", maxHeight: "calc(100vh - 40px)", overflowY: "auto" }}>
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
                    : <video key={active.url} controls src={active.url} crossOrigin="anonymous" style={{ width: "100%", maxHeight: "60vh", borderRadius: 8, background: "#000" }}>
                        {preview.captions.map((c) => <track key={c.url} kind="subtitles" srcLang={c.language ?? "fr"} label={c.label} src={c.url} />)}
                      </video>}
                </>
              );
            })()}
            {preview.asset.kind === "VIDEO" && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border, #e3e6ec)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <b style={{ fontSize: 13 }}>💬 Sous-titres</b>
                  {preview.captions.length === 0 && <span className="muted" style={{ fontSize: 12 }}>aucune piste</span>}
                  {preview.captions.map((c) => (
                    <span key={c.url} className="pill pill--info" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {c.label}
                      <button className="btn btn--sm" style={{ padding: "0 4px", border: "none" }} title={`Éditer la piste ${c.label} (textes + synchronisation)`} disabled={capBusy} onClick={() => editCaps(c)}>✏️</button>
                      <button className="btn btn--sm" style={{ padding: "0 4px", border: "none" }} title={`Supprimer la piste ${c.label}`} onClick={() => removeCaps(preview.asset, c)}>✕</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button className="btn btn--sm btn--primary" disabled={capBusy} title="Transcription Whisper (FR) puis traduction (EN) — une seule fois, puis servies statiquement"
                    onClick={() => generateCaps(preview.asset)}>{capBusy ? "Génération…" : "⚡ Générer FR + EN (IA)"}</button>
                  <button className="btn btn--sm" disabled={capBusy} onClick={() => { capLangRef.current = "fr"; capFileRef.current?.click(); }}>⤴ Importer FR (.vtt/.srt)</button>
                  <button className="btn btn--sm" disabled={capBusy} onClick={() => { capLangRef.current = "en"; capFileRef.current?.click(); }}>⤴ Importer EN (.vtt/.srt)</button>
                  <input ref={capFileRef} type="file" accept=".vtt,.srt,text/vtt" hidden onChange={(e) => importCaps(preview.asset, e.target.files?.[0] ?? null)} />
                </div>
                <p className="muted" style={{ fontSize: 11.5, margin: "6px 0 0" }}>
                  Générés une fois pour toutes, réutilisés par tous les apprenants (et hors ligne). Un fichier importé remplace la piste de la même langue. ✏️ pour corriger les textes ou recaler la synchronisation.
                </p>

                {capEdit && (
                  <div ref={capEditRef} style={{ marginTop: 12, border: "1px solid var(--border, #e3e6ec)", borderRadius: 10, padding: 12 }}>
                    <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
                      <b style={{ fontSize: 13 }}>✏️ Édition — {capEdit.label} ({capEdit.cues.length} cues)</b>
                      <label className="row" style={{ gap: 6, alignItems: "center", fontSize: 12.5 }} title="Sous-titres « trop tôt » → décalage positif (ils s'afficheront plus tard)">
                        <span className="muted">Décaler toute la piste de</span>
                        <input type="number" step="0.5" value={capEdit.offset} style={{ width: 70, padding: "4px 6px", border: "1px solid var(--border, #d7dbe3)", borderRadius: 6 }}
                          onChange={(e) => setCapEdit((p) => p && ({ ...p, offset: e.target.value }))} />
                        <span className="muted">s{capOffset() !== 0 && capEdit.cues[0] ? ` — 1re cue à ${formatTimestamp(Math.max(0, capEdit.cues[0].start + capOffset()))}` : ""}</span>
                      </label>
                    </div>
                    {/* Pas de mini-défilement interne : toutes les cues coulent
                        dans le défilement naturel de la fenêtre d'aperçu. */}
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      {capEdit.cues.map((cue, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <span className="muted" style={{ fontSize: 11, fontFamily: "monospace", whiteSpace: "nowrap", paddingTop: 6 }}>
                            {formatTimestamp(cue.start).slice(3)} → {formatTimestamp(cue.end).slice(3)}
                          </span>
                          <textarea value={cue.text} rows={Math.max(1, cue.text.split("\n").length)}
                            style={{ flex: 1, padding: "5px 8px", border: "1px solid var(--border, #d7dbe3)", borderRadius: 6, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                            onChange={(e) => setCueText(i, e.target.value)} />
                        </div>
                      ))}
                    </div>
                    <div className="row" style={{ gap: 8, marginTop: 10 }}>
                      <button className="btn btn--sm btn--primary" disabled={capBusy} onClick={() => saveCapEdit(preview.asset)}>💾 Enregistrer la piste</button>
                      <button className="btn btn--sm" disabled={capBusy} onClick={() => setCapEdit(null)}>Annuler</button>
                      <span className="muted" style={{ fontSize: 11.5 }}>Une cue vidée de son texte est retirée. L'enregistrement remplace la piste pour tous les apprenants.</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
