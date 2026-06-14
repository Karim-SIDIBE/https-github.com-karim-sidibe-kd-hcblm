import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { twofa } from "../lib/api";

type Phase = "loading" | "off" | "setup" | "backup" | "on";

export function Security() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState<string[]>([]);

  useEffect(() => { twofa.status().then((s) => setPhase(s.enabled ? "on" : "off")).catch(() => setPhase("off")); }, []);

  async function startSetup() {
    setBusy(true); setErr(null);
    try {
      const { secret, otpauthUrl } = await twofa.setup();
      setSecret(secret);
      setQr(await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 }));
      setPhase("setup");
    } catch (e: any) { setErr(e?.message || "Erreur"); } finally { setBusy(false); }
  }

  async function confirmEnable() {
    setBusy(true); setErr(null);
    try { const r = await twofa.enable(code.trim()); setBackup(r.backupCodes); setCode(""); setPhase("backup"); }
    catch (e: any) { setErr(e?.message || "Code invalide"); } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setErr(null);
    try { await twofa.disable(code.trim()); setCode(""); setPhase("off"); }
    catch (e: any) { setErr(e?.message || "Code invalide"); } finally { setBusy(false); }
  }

  const card: React.CSSProperties = { maxWidth: 560 };
  const codeInput: React.CSSProperties = { width: 160, padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 10, fontFamily: "inherit", fontSize: 16, letterSpacing: "0.2em" };

  return (
    <div className="content">
      <div className="card" style={card}>
        <div className="card-h"><h3>Vérification en deux étapes (2FA)</h3>{phase === "on" && <span className="hf-pill hf-pill--mint">Activée</span>}</div>
        <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {phase === "loading" && <p className="muted">Chargement…</p>}

          {phase === "off" && (
            <>
              <p className="muted" style={{ margin: 0 }}>Protégez votre compte avec une application d'authentification (Google Authenticator, Microsoft Authenticator, FreeOTP…). Un code à 6 chiffres sera demandé à chaque connexion.</p>
              <button className="btn btn--primary" disabled={busy} style={{ alignSelf: "flex-start" }} onClick={startSetup}>{busy ? "…" : "Activer la 2FA"}</button>
            </>
          )}

          {phase === "setup" && (
            <>
              <p className="muted" style={{ margin: 0 }}>1. Scannez ce QR code avec votre application d'authentification.</p>
              {qr && <img src={qr} alt="QR 2FA" width={220} height={220} style={{ borderRadius: 12, border: "1px solid var(--line)" }} />}
              <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Ou saisissez la clé manuellement : <code style={{ userSelect: "all", fontWeight: 700 }}>{secret}</code></p>
              <p className="muted" style={{ margin: "6px 0 0" }}>2. Entrez le code généré pour confirmer.</p>
              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" style={codeInput} />
                <button className="btn btn--primary" disabled={busy || code.trim().length < 6} onClick={confirmEnable}>{busy ? "…" : "Confirmer"}</button>
                <button className="btn btn--ghost" disabled={busy} onClick={() => { setPhase("off"); setCode(""); setErr(null); }}>Annuler</button>
              </div>
            </>
          )}

          {phase === "backup" && (
            <>
              <span className="hf-pill hf-pill--mint" style={{ alignSelf: "flex-start" }}>✓ 2FA activée</span>
              <p style={{ margin: 0, fontWeight: 700 }}>Conservez vos codes de secours en lieu sûr.</p>
              <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Chacun ne fonctionne qu'une fois, en cas de perte de votre téléphone. Ils ne seront plus affichés.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontFamily: "monospace", fontSize: 14, background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: 10, padding: 14, maxWidth: 360 }}>
                {backup.map((c) => <span key={c} style={{ userSelect: "all" }}>{c}</span>)}
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn--sm" onClick={() => navigator.clipboard?.writeText(backup.join("\n"))}>Copier</button>
                <button className="btn btn--sm" onClick={() => { const b = new Blob([backup.join("\n")], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "codes-secours-2fa.txt"; a.click(); }}>Télécharger</button>
                <button className="btn btn--primary btn--sm" onClick={() => setPhase("on")}>J'ai sauvegardé mes codes</button>
              </div>
            </>
          )}

          {phase === "on" && (
            <>
              <p className="muted" style={{ margin: 0 }}>La 2FA est active sur votre compte. Pour la désactiver, saisissez un code actuel (ou un code de secours).</p>
              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" style={codeInput} />
                <button className="btn" disabled={busy || code.trim().length < 6} style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={disable}>{busy ? "…" : "Désactiver la 2FA"}</button>
              </div>
            </>
          )}

          {err && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0, fontWeight: 600 }}>{err}</p>}
        </div>
      </div>
    </div>
  );
}
