/**
 * Paiements.tsx — console paiements (spec paiement, lot PAY-4).
 * Le poste de pilotage du réel : fournisseur actif (bascule Super Admin sans
 * redéploiement), conversion sur période, commandes avec les deux overrides
 * (« Constater » un virement, « Re-vérifier » auprès de l'agrégateur quand un
 * webhook s'est perdu), réconciliation des écarts, mentions légales du reçu.
 * La création des produits/prix reste dans « Tarifs & accès ».
 */
import { useEffect, useState } from "react";
import { api, auth, ApiError, type PayOrderRow, type PayReconciliation, type PayStats } from "../lib/api";
import { modal } from "../lib/modal";

const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--border, #d7dbe3)", borderRadius: 8, fontSize: 13.5 };
const statCell: React.CSSProperties = { flex: 1, minWidth: 110, background: "var(--bg-soft, #f5f7fb)", borderRadius: 10, padding: "10px 12px" };

const PROVIDER_LABEL: Record<string, string> = { manual: "Virement (constat manuel)", cinetpay: "CinetPay", flutterwave: "Flutterwave" };
const STATUS_PILL: Record<string, string> = { PAID: "pill--green", PENDING: "pill--warn", FAILED: "pill--red", CANCELLED: "pill--red", REFUNDED: "pill--info" };

export function Paiements() {
  const isSuper = auth.user()?.role === "SUPER_ADMIN";
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // --- fournisseur actif ---
  const [providers, setProviders] = useState<{ key: string; available: boolean; active: boolean }[]>([]);
  async function loadProviders() { try { setProviders(await api.payProviders()); } catch { /* géré via note globale */ } }
  async function switchProvider(key: string) {
    if (!(await modal.confirm({ title: "Basculer le fournisseur actif ?", body: `Les NOUVEAUX checkouts partiront sur « ${PROVIDER_LABEL[key] ?? key} ». Les paiements déjà engagés restent suivis sur leur fournisseur d'origine, et tous les webhooks restent acceptés.`, okLabel: "Basculer" }))) return;
    setBusy(true); setNote(null);
    try { await api.setSetting("payment_provider", key); setNote(`✓ Fournisseur actif : ${PROVIDER_LABEL[key] ?? key}.`); await loadProviders(); }
    catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Bascule impossible"}`); }
    finally { setBusy(false); }
  }

  // --- conversion ---
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<PayStats | null>(null);
  useEffect(() => { api.payStats(days).then(setStats).catch(() => setStats(null)); }, [days]);

  // --- commandes ---
  const [status, setStatus] = useState<string>("PENDING");
  const [orders, setOrders] = useState<PayOrderRow[] | null>(null);
  async function loadOrders() {
    try { setOrders(await api.payOrders(status === "ALL" ? undefined : status)); }
    catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Chargement impossible"}`); setOrders([]); }
  }
  useEffect(() => { void loadOrders(); }, [status]);

  // --- réconciliation ---
  const [reco, setReco] = useState<PayReconciliation | null>(null);
  async function loadReco() { try { setReco(await api.payReconciliation()); } catch { setReco(null); } }
  useEffect(() => { void loadReco(); }, []);

  async function refreshAll() { await Promise.all([loadOrders(), loadReco(), api.payStats(days).then(setStats).catch(() => null)]); }

  async function markPaid(o: { id: string; display?: string; product?: { title: string } }) {
    const reference = await modal.prompt({ title: "Constater le règlement", body: `Commande « ${o.product?.title ?? o.id} »${o.display ? ` — ${o.display}` : ""}. Référence du virement reçue (obligatoire, journalisée) :`, okLabel: "Constater" });
    if (!reference) return;
    setBusy(true); setNote(null);
    try { await api.payMarkPaid(o.id, reference); setNote("✓ Règlement constaté — droit d'accès émis."); await refreshAll(); }
    catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Constat impossible"}`); }
    finally { setBusy(false); }
  }

  async function recheck(orderId: string) {
    setBusy(true); setNote(null);
    try {
      const r = await api.payRecheck(orderId);
      const detail = r.results.map((x) => `${x.provider} → ${x.action}`).join(", ") || "aucun paiement engagé";
      setNote(`✓ Re-vérification : commande ${r.status}. (${detail})`);
      await refreshAll();
    } catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Re-vérification impossible"}`); }
    finally { setBusy(false); }
  }

  // --- mentions légales du reçu ---
  const [legal, setLegal] = useState<string>("");
  const [legalLoaded, setLegalLoaded] = useState(false);
  useEffect(() => {
    api.settings().then((s) => { setLegal(String(s.receipt_legal ?? "")); setLegalLoaded(true); }).catch(() => setLegalLoaded(true));
    void loadProviders();
  }, []);
  async function saveLegal() {
    setBusy(true); setNote(null);
    try { await api.setSetting("receipt_legal", legal); setNote("✓ Mentions légales enregistrées — elles apparaissent en pied de tous les reçus PDF."); }
    catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Enregistrement impossible"}`); }
    finally { setBusy(false); }
  }

  return (
    <div className="content">
      {note && <div className="card"><div className="card-b">{note}</div></div>}

      <div className="card">
        <div className="card-b">
          <h3 style={{ margin: 0 }}>🔀 Fournisseur de paiement actif</h3>
          <p className="muted" style={{ fontSize: 12.5 }}>Les nouveaux checkouts partent sur le fournisseur actif ; les webhooks de TOUS les agrégateurs restent acceptés en permanence (un paiement engagé se confirme sur son fournisseur d'origine).</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {providers.map((p) => (
              <div key={p.key} style={{ ...statCell, border: p.active ? "2px solid var(--accent, #E4620F)" : "1px solid var(--border, #e3e6ec)" }}>
                <div className="row between" style={{ gap: 8 }}>
                  <b>{PROVIDER_LABEL[p.key] ?? p.key}</b>
                  {p.active
                    ? <span className="pill pill--green">actif</span>
                    : isSuper && <button className="btn btn--sm" disabled={busy || !p.available} onClick={() => void switchProvider(p.key)}>Activer</button>}
                </div>
                <span className="muted" style={{ fontSize: 12 }}>{p.available ? "configuré" : "non configuré (clés absentes)"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-b">
          <div className="row between">
            <h3 style={{ margin: 0 }}>📈 Conversion</h3>
            <select style={{ ...inp, width: "auto" }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>7 jours</option><option value={30}>30 jours</option><option value={90}>90 jours</option>
            </select>
          </div>
          {stats ? (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <div style={statCell}><div style={{ fontSize: 22, fontWeight: 800 }}>{stats.created}</div><span className="muted" style={{ fontSize: 12 }}>commandes créées</span></div>
                <div style={statCell}><div style={{ fontSize: 22, fontWeight: 800 }}>{stats.paid}</div><span className="muted" style={{ fontSize: 12 }}>payées</span></div>
                <div style={statCell}><div style={{ fontSize: 22, fontWeight: 800 }}>{stats.conversionPct ?? "—"}{stats.conversionPct != null ? " %" : ""}</div><span className="muted" style={{ fontSize: 12 }}>taux de conversion</span></div>
                <div style={statCell}><div style={{ fontSize: 22, fontWeight: 800 }}>{stats.pending}</div><span className="muted" style={{ fontSize: 12 }}>en attente</span></div>
                <div style={statCell}><div style={{ fontSize: 22, fontWeight: 800 }}>{stats.failed}</div><span className="muted" style={{ fontSize: 12 }}>échouées</span></div>
              </div>
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <b>Revenu encaissé :</b>{" "}
                {stats.revenue.length === 0 ? <span className="muted">aucun sur la période</span>
                  : stats.revenue.map((r) => <span key={r.currency} className="pill pill--info" style={{ marginRight: 6 }}>{r.display} ({r.orders} cmd)</span>)}
                {stats.byProvider.length > 0 && (
                  <span style={{ marginLeft: 10 }} className="muted">
                    Règlements : {stats.byProvider.map((p) => `${PROVIDER_LABEL[p.provider] ?? p.provider} ×${p.payments}`).join(" · ")}
                  </span>
                )}
              </div>
            </>
          ) : <p className="muted">Chargement…</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-b">
          <div className="row between">
            <h3 style={{ margin: 0 }}>🧾 Commandes</h3>
            <select style={{ ...inp, width: "auto" }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PENDING">En attente</option><option value="PAID">Payées</option><option value="FAILED">Échouées</option><option value="ALL">Toutes (100 dernières)</option>
            </select>
          </div>
          <p className="muted" style={{ fontSize: 12.5 }}>« Constater » = virement reçu (fournisseur manual). « Re-vérifier » = interroger l'agrégateur (le filet quand un webhook s'est perdu) — rien n'est accordé sans sa confirmation.</p>
          {!orders ? <p className="muted">Chargement…</p> : orders.length === 0 ? <p className="muted">Aucune commande.</p> : orders.map((o) => (
            <div key={o.id} className="row between" style={{ borderTop: "1px solid var(--border, #e3e6ec)", padding: "8px 0", gap: 8 }}>
              <span style={{ minWidth: 0 }}>
                {o.product?.title} · <b>{o.display}</b> · {o.buyerUser?.email ?? o.buyerOrg?.name ?? "—"}
                <span className="muted"> ({new Date(o.createdAt).toLocaleDateString("fr-FR")})</span>
                <span className={`pill ${STATUS_PILL[o.status] ?? "pill--info"}`} style={{ marginLeft: 6 }}>{o.status}</span>
              </span>
              {o.status === "PENDING" && (
                <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button className="btn btn--sm" disabled={busy} onClick={() => void recheck(o.id)}>↻ Re-vérifier</button>
                  <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => void markPaid(o)}>✓ Constater</button>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-b">
          <div className="row between">
            <h3 style={{ margin: 0 }}>🧮 Réconciliation</h3>
            <button className="btn btn--sm" disabled={busy} onClick={() => void loadReco()}>Actualiser</button>
          </div>
          {!reco ? <p className="muted">Chargement…</p> : (
            <>
              <p style={{ margin: "8px 0 4px" }}><b>Commandes en attente depuis plus de 24 h</b> {reco.staleOrders.length === 0 && <span className="muted">— aucune ✓</span>}</p>
              {reco.staleOrders.map((o) => (
                <div key={o.id} className="row between" style={{ borderTop: "1px solid var(--border, #e3e6ec)", padding: "6px 0", fontSize: 13, gap: 8 }}>
                  <span>{o.product} · <b>{o.display}</b> · {o.buyer} · depuis le {new Date(o.createdAt).toLocaleDateString("fr-FR")} {o.provider && <span className="pill pill--info">{o.provider}</span>}</span>
                  <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="btn btn--sm" disabled={busy} onClick={() => void recheck(o.id)}>↻ Re-vérifier</button>
                    <button className="btn btn--sm" disabled={busy} onClick={() => void markPaid({ id: o.id, display: o.display, product: { title: o.product } })}>✓ Constater</button>
                  </span>
                </div>
              ))}
              <p style={{ margin: "10px 0 4px" }}><b>Écarts anormaux</b> {reco.succeededUnsettled.length === 0 && reco.paidWithoutEntitlement.length === 0 && <span className="muted">— aucun ✓</span>}</p>
              {reco.succeededUnsettled.map((p) => (
                <p key={p.paymentId} className="pill pill--red" style={{ display: "inline-block", margin: "2px 4px 2px 0" }}>Paiement réussi mais commande {p.orderStatus} — {p.orderId} ({p.provider})</p>
              ))}
              {reco.paidWithoutEntitlement.map((o) => (
                <p key={o.id} className="pill pill--red" style={{ display: "inline-block", margin: "2px 4px 2px 0" }}>Commande payée sans droit émis — {o.product} ({o.id})</p>
              ))}
              <p style={{ margin: "10px 0 4px" }}>
                <b>Webhooks à signature invalide</b> : {reco.invalidWebhooks.total}
                {reco.invalidWebhooks.total > 0 && <span className="muted"> — tentatives rejetées et journalisées (fraude possible, ou clé mal configurée chez l'agrégateur)</span>}
              </p>
              {reco.invalidWebhooks.recent.map((e) => (
                <span key={e.id} className="muted" style={{ fontSize: 12, marginRight: 10 }}>{e.provider} · {new Date(e.receivedAt).toLocaleString("fr-FR")}</span>
              ))}
            </>
          )}
        </div>
      </div>

      {isSuper && (
        <div className="card">
          <div className="card-b">
            <h3 style={{ margin: 0 }}>⚖️ Mentions légales du reçu (Super Admin)</h3>
            <p className="muted" style={{ fontSize: 12.5 }}>Imprimées en pied de chaque reçu PDF : n° de contribuable, RCCM, régime de TVA (ex. « TVA non applicable — régime de l'entreprenant »)… Laissez vide pour ne rien imprimer.</p>
            {legalLoaded && (
              <>
                <textarea style={{ ...inp, minHeight: 90, fontFamily: "inherit" }} value={legal} maxLength={2000}
                  onChange={(e) => setLegal(e.target.value)}
                  placeholder={"DECLICK DIGITAL — RCCM …\nN° contribuable … · TVA : …"} />
                <button className="btn btn--sm btn--primary" style={{ marginTop: 8 }} disabled={busy} onClick={() => void saveLegal()}>Enregistrer</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
