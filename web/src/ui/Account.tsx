import { useEffect, useState } from "react";
import { api, getIdentity, logout } from "../lib/app";
import { routes } from "../lib/router";
import type { ConsentState } from "../lib/api";
import { useT, useI18n } from "../lib/i18n";

/** Learner self-service: consents, data export, account deletion (RGPD). */
export function Account() {
  const t = useT();
  const { lang } = useI18n();
  const me = getIdentity();
  const [consents, setConsents] = useState<ConsentState[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => api.consents().then(setConsents).catch((e) => setErr(e?.message || t("common.error")));
  useEffect(() => { void load(); }, []);

  async function toggle(type: string, granted: boolean) {
    setErr(null); setMsg(null);
    try { await api.setConsent(type, granted); void load(); } catch (e: any) { setErr(e?.message || t("common.error")); }
  }

  async function exportData() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const text = await api.exportMyData();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      a.download = "mes-donnees.json"; a.click(); URL.revokeObjectURL(a.href);
      setMsg(t("acc.exported"));
    } catch (e: any) { setErr(e?.message || t("common.error")); } finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (!confirm(t("acc.deleteConfirm"))) return;
    setBusy(true); setErr(null);
    try {
      await api.deleteAccount("anonymize");
      logout();
      alert(t("acc.deleteScheduled"));
      location.hash = "#/"; location.reload();
    } catch (e: any) { setErr(e?.message || t("common.error")); setBusy(false); }
  }

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR") : "");

  return (
    <div style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
      <a href={routes.enrollments()} style={{ fontSize: 14 }}>← {t("common.back")}</a>
      <h1 style={{ marginTop: 8 }}>{t("acc.title")}</h1>
      {me && <p className="muted">{me.name} · {me.email}</p>}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t("acc.consents")}</h3>
        {!consents ? <p className="muted">{t("common.loading")}</p> : consents.map((c) => (
          <div key={c.type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--line, #eee)" }}>
            <div>
              <strong style={{ fontSize: 14 }}>{c.label}{c.required && <span className="muted">{t("acc.required")}</span>}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{c.granted ? `${t("acc.accepted")}${c.grantedAt ? t("acc.acceptedOn", { date: fmt(c.grantedAt) }) : ""} · v${c.acceptedVersion}` : t("acc.notAccepted")}</div>
            </div>
            {c.required
              ? <span style={{ fontSize: 16 }}>{c.granted ? "✓" : "—"}</span>
              : <input type="checkbox" checked={c.granted} onChange={(e) => toggle(c.type, e.target.checked)} style={{ width: 20, height: 20 }} />}
          </div>
        ))}
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{t("acc.consentsNote")}</p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t("acc.myData")}</h3>
        <p className="muted" style={{ fontSize: 13 }}>{t("acc.myDataDesc")}</p>
        <button disabled={busy} onClick={exportData}>{busy ? "…" : t("acc.export")}</button>
      </div>

      <div className="card" style={{ marginTop: 16, borderColor: "var(--ko, #c0392b)" }}>
        <h3>{t("acc.deleteTitle")}</h3>
        <p className="muted" style={{ fontSize: 13 }}>{t("acc.deleteDesc")}</p>
        <button disabled={busy} onClick={deleteAccount} style={{ color: "var(--ko, #c0392b)", borderColor: "var(--ko, #c0392b)" }}>{t("acc.deleteTitle")}</button>
      </div>

      {msg && <p className="ok" style={{ marginTop: 12 }}>{msg}</p>}
      {err && <p className="ko" style={{ marginTop: 12 }}>{err}</p>}
    </div>
  );
}
