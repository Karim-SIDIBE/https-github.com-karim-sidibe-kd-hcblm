import { Fragment, useEffect, useState } from "react";
import { api, type Webhook, type WebhookDelivery } from "../lib/api";
import { ago } from "../lib/ui";
import { modal } from "../lib/modal";

const EVENTS: { key: string; label: string }[] = [
  { key: "BADGE_ISSUED", label: "Badge délivré" },
  { key: "BLOCK_COMPLETED", label: "Bloc terminé" },
  { key: "PROJECT_SUBMITTED", label: "Projet Bloc 4 soumis" },
  { key: "EXERCISE_SUBMITTED", label: "Exercice soumis" },
  { key: "REENGAGEMENT_DAY14", label: "Relance J+14 (décrochage)" },
  { key: "CERTIFICATE_ISSUED", label: "Certificat délivré" },
];
const EVENT_LABEL = Object.fromEntries(EVENTS.map((e) => [e.key, e.label]));

const ST: Record<string, string> = { SENT: "pill--green", FAILED: "pill--red", PENDING: "pill--warn" };

function HookForm({ hook, onDone, onClose }: { hook: Webhook | null; onDone: (msg: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState(hook?.url ?? "");
  const [events, setEvents] = useState<Set<string>>(new Set(hook?.events ?? ["BADGE_ISSUED", "CERTIFICATE_ISSUED"]));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null); // shown ONCE after creation

  const toggle = (k: string) => setEvents((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  async function save() {
    if (!/^https:\/\//.test(url.trim())) { setErr("URL invalide — https:// requis."); return; }
    if (events.size === 0) { setErr("Choisissez au moins un événement."); return; }
    setBusy(true); setErr(null);
    try {
      if (hook) {
        await api.updateWebhook(hook.id, { url: url.trim(), events: [...events] });
        onDone("✏️ Webhook mis à jour.");
      } else {
        const created = await api.createWebhook({ url: url.trim(), events: [...events] });
        if (created.secret) { setSecret(created.secret); return; } // keep the panel open to show it
        onDone("✅ Webhook créé.");
      }
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  }

  const inp = { width: "100%", border: "1px solid var(--line-strong)", borderRadius: 8, padding: "9px 11px", fontFamily: "inherit", fontSize: 13.5 } as const;
  const lbl = { display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" as const, letterSpacing: 0.4, margin: "10px 0 4px" };

  if (secret) {
    return (
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-b">
          <b>✅ Webhook créé.</b>
          <p style={{ fontSize: 13, margin: "8px 0 4px" }}>Voici le <b>secret de signature</b> — il n'est affiché qu'une seule fois. Votre intégration vérifie l'en-tête <code>x-kd-signature</code> (HMAC-SHA256 du corps).</p>
          <code style={{ display: "block", padding: "10px 12px", background: "var(--bg)", borderRadius: 8, fontSize: 12.5, wordBreak: "break-all" }}>{secret}</code>
          <div className="row" style={{ gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            <button className="btn btn--sm" onClick={() => navigator.clipboard?.writeText(secret)}>⧉ Copier</button>
            <button className="btn btn--sm btn--primary" onClick={() => onDone("✅ Webhook créé — secret copié ?")}>J'ai enregistré le secret</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-b">
        <div className="row between" style={{ marginBottom: 6 }}>
          <b style={{ fontSize: 14 }}>{hook ? "Modifier le webhook" : "Nouveau webhook"}</b>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <span style={lbl}>URL de réception (https)</span>
        <input style={inp} value={url} placeholder="https://votre-si.example.com/hooks/kd" onChange={(e) => setUrl(e.target.value)} />
        <span style={lbl}>Événements envoyés</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {EVENTS.map((e) => (
            <label key={e.key} className="row" style={{ gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={events.has(e.key)} onChange={() => toggle(e.key)} /> {e.label}
            </label>
          ))}
        </div>
        {err && <p style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: "var(--danger)" }}>{err}</p>}
        <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--primary" disabled={busy} onClick={save}>{busy ? "…" : hook ? "Enregistrer" : "Créer le webhook"}</button>
        </div>
      </div>
    </div>
  );
}

export function Webhooks() {
  const [rows, setRows] = useState<Webhook[] | null>(null);
  const [form, setForm] = useState<{ hook: Webhook | null } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({});

  async function load() {
    try { setRows(await api.webhooks()); } catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); setRows([]); }
  }
  useEffect(() => { void load(); }, []);

  async function toggleDeliveries(h: Webhook) {
    if (openId === h.id) { setOpenId(null); return; }
    setOpenId(h.id);
    try { setDeliveries((d) => ({ ...d, [h.id]: [] })); const list = await api.webhookDeliveries(h.id); setDeliveries((d) => ({ ...d, [h.id]: list })); }
    catch { /* keep empty */ }
  }

  async function test(h: Webhook) {
    setBusy(`t:${h.id}`); setNote(null);
    try {
      const r = await api.testWebhook(h.id);
      setNote(r.ok ? `✅ Test envoyé à ${h.url} — HTTP ${r.responseCode}.` : `⚠️ Test en échec : ${r.error ?? `HTTP ${r.responseCode}`}.`);
      if (openId === h.id) setDeliveries((d) => ({ ...d, [h.id]: [] })), void api.webhookDeliveries(h.id).then((l) => setDeliveries((d) => ({ ...d, [h.id]: l })));
    } catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(null); }
  }

  async function setActive(h: Webhook, active: boolean) {
    setBusy(h.id);
    try { await api.updateWebhook(h.id, { active }); load(); }
    catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(null); }
  }

  async function remove(h: Webhook) {
    if (!(await modal.confirm({ title: "Supprimer ce webhook ?", body: `${h.url}\nL'intégration ne recevra plus aucun événement.`, danger: true, okLabel: "Supprimer" }))) return;
    setBusy(h.id);
    try { await api.deleteWebhook(h.id); setNote("🗑️ Webhook supprimé."); load(); }
    catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(null); }
  }

  async function retry(h: Webhook, d: WebhookDelivery) {
    try {
      await api.retryWebhookDelivery(h.id, d.id);
      setNote("↻ Livraison re-mise en file — retentée dans la minute.");
      const list = await api.webhookDeliveries(h.id);
      setDeliveries((x) => ({ ...x, [h.id]: list }));
    } catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{rows ? `${rows.length} intégration${rows.length > 1 ? "s" : ""}` : "…"}</div>
          <h1>Webhooks</h1>
          <div className="sub">Notifiez vos systèmes (SIRH, CRM…) en temps réel : événements signés HMAC-SHA256, livrés par la file de la plateforme.</div>
        </div>
        <button className="btn btn--primary" onClick={() => setForm({ hook: null })}>+ Nouveau webhook</button>
      </div>

      {note && <div className="card" style={{ background: note.startsWith("✅") || note.startsWith("↻") || note.startsWith("🗑️") ? "var(--success-tint)" : "var(--warning-tint)", border: "none", padding: "11px 14px", marginBottom: 14, fontSize: 13 }} onClick={() => setNote(null)}>{note}</div>}

      {form && <HookForm hook={form.hook} onDone={(msg) => { setForm(null); setNote(msg); load(); }} onClose={() => setForm(null)} />}

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>URL</th><th>Événements</th><th>Créé</th><th>Actif</th><th></th></tr></thead>
            <tbody>
              {(rows ?? []).map((h) => (
                <Fragment key={h.id}>
                <tr>
                  <td onClick={() => void toggleDeliveries(h)} style={{ cursor: "pointer" }} title="Voir les dernières livraisons">
                    <b style={{ fontSize: 13 }}>{openId === h.id ? "▾ " : "▸ "}{h.url}</b>
                  </td>
                  <td><div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 320 }}>{(h.events ?? []).map((e) => <span key={e} className="pill pill--soft" style={{ fontSize: 10.5 }}>{EVENT_LABEL[e] ?? e}</span>)}</div></td>
                  <td><span className="muted" style={{ fontSize: 12.5 }}>{h.createdAt ? ago(h.createdAt) : "—"}</span></td>
                  <td>
                    <label className="row" style={{ gap: 6, fontSize: 12.5 }}>
                      <input type="checkbox" checked={h.active !== false} disabled={busy === h.id} onChange={(e) => void setActive(h, e.target.checked)} />
                      {h.active !== false ? "Actif" : "Suspendu"}
                    </label>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn--sm" disabled={busy === `t:${h.id}`} onClick={() => void test(h)} title="Envoyer un événement de test signé">{busy === `t:${h.id}` ? "…" : "⚡ Tester"}</button>
                    <button className="btn btn--sm" style={{ marginLeft: 6 }} onClick={() => setForm({ hook: h })}>✎ Modifier</button>
                    <button className="btn btn--sm" style={{ marginLeft: 6, color: "var(--danger)", borderColor: "var(--danger)" }} disabled={busy === h.id} onClick={() => void remove(h)}>🗑️</button>
                  </td>
                </tr>
                {openId === h.id && (
                  <tr key={`${h.id}-d`}><td colSpan={5} style={{ background: "var(--bg-soft)" }}>
                    {(deliveries[h.id] ?? []).length === 0 ? <span className="muted" style={{ fontSize: 12.5 }}>Aucune livraison enregistrée (ou chargement…).</span> : (
                      <table className="table" style={{ margin: "4px 0" }}>
                        <thead><tr><th>Quand</th><th>Événement</th><th>Statut</th><th>HTTP</th><th>Tentatives</th><th>Erreur</th><th></th></tr></thead>
                        <tbody>
                          {(deliveries[h.id] ?? []).map((d) => (
                            <tr key={d.id} style={{ cursor: "default" }}>
                              <td><span style={{ fontSize: 12 }}>{ago(d.createdAt)}</span></td>
                              <td><span className="pill pill--soft" style={{ fontSize: 10.5 }}>{EVENT_LABEL[d.event] ?? d.event}</span></td>
                              <td><span className={`pill ${ST[d.status] ?? "pill--soft"}`} style={{ fontSize: 10.5 }}>{d.status}</span></td>
                              <td><span className="muted" style={{ fontSize: 12 }}>{d.responseCode ?? "—"}</span></td>
                              <td><span className="muted" style={{ fontSize: 12 }}>{d.attempts}</span></td>
                              <td><span className="muted" style={{ fontSize: 11.5, maxWidth: 220, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.error ?? ""}>{d.error ?? "—"}</span></td>
                              <td>{d.status === "FAILED" && <button className="btn btn--sm" onClick={() => void retry(h, d)} title="Re-mettre en file (retentée dans la minute)">↻ Réessayer</button>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td></tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!rows && <div className="empty">Chargement…</div>}
          {rows && rows.length === 0 && <div className="empty"><div className="big">🔗</div>Aucun webhook. Créez-en un pour brancher votre SIRH/CRM sur les événements de formation.</div>}
        </div>
      </div>
    </div>
  );
}
