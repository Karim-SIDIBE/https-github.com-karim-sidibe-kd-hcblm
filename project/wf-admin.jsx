// wf-admin.jsx — Administrator / enterprise analytics dashboard (desktop).
// Cohort overview + individual learner drill-down.

function AdminShell({ url, active, children }) {
  const O = "var(--wf-orange)";
  const nav = [["Vue cohorte", "cohort"], ["Apprenants", "learners"], ["Projets Bloc 4", "proj"], ["Relances", "reeng"]];
  return (
    <Win url={url}>
      <div className="wf-topbar" style={{ padding: "12px 20px" }}>
        <div className="row gap12 center"><Logo /><span className="wf-chip" style={{ fontSize: 9.5 }}>Tableau de bord administrateur</span></div>
        <span className="wf-chip member" style={{ fontSize: 9.5 }}><span className="dot" />Client : Orange CI · lecture seule</span>
      </div>
      <div style={{ display: "flex", minHeight: 460 }}>
        <div style={{ width: 150, borderRight: "1px solid var(--wf-line)", padding: 14, flex: "0 0 150px" }}>
          <div className="wf-ey" style={{ marginBottom: 10 }}>Navigation</div>
          <div className="col gap4">
            {nav.map(([n, id]) => <div key={id} style={{ padding: "7px 9px", borderRadius: 7, fontSize: 11.5, fontWeight: id === active ? 700 : 500, color: id === active ? O : "var(--wf-ink-2)", background: id === active ? "#fff3e9" : "transparent" }}>{n}</div>)}
          </div>
        </div>
        <div style={{ flex: 1, padding: 20 }}>{children}</div>
      </div>
    </Win>
  );
}
const Kpi = ({ v, l, c, pin }) => (
  <div className="wf-card rel" style={{ flex: 1, padding: "12px 14px" }}>
    {pin && <span className="wf-pin abs" style={{ top: -8, right: -8 }}>{pin}</span>}
    <div style={{ fontFamily: "var(--wf-mono)", fontSize: 24, fontWeight: 600, color: c || "var(--wf-ink)" }}>{v}</div>
    <div className="wf-meta mt4">{l}</div>
  </div>
);

function buildAdmin() {
  const O = "var(--wf-orange)", G = "var(--wf-green)", A = "var(--wf-anno)";

  // ---------- A · cohort overview ----------
  const funnel = [["Bloc 0", 100], ["Bloc 1", 82], ["Bloc 2", 61], ["Bloc 3", 44], ["Bloc 4", 31]];
  const rows = [
    ["Aminata D.", "B1 · 1.2", 38, "Compréhension", "—", "J+7 envoyée"],
    ["Ibrahima S.", "B3 · quiz final", 71, "Pratique", "—", "—"],
    ["Mariam T.", "B0 · ancrage", 8, "—", "—", "J+3 envoyée"],
    ["Fatou S.", "B4 · projet", 96, "Ancrage", "soumis", "—"],
  ];
  const A_ = (
    <div className="wf" style={{ background: "#f4f6f9" }}>
      <AdminShell url="app.declick.kompetences.net/admin/cohorte" active="cohort">
        <div className="row between center">
          <div><div className="wf-ey">Vue cohorte · Gestion du temps · Niveau 1</div><div className="wf-h lg mt4">Promo Orange CI — Mars 2026</div></div>
          <div className="row gap6">
            <span className="wf-chip">Cohorte ▾</span><span className="wf-chip">Niveau ▾</span><span className="wf-chip">Période ▾</span>
          </div>
        </div>
        <div className="row gap10 mt14">
          <Kpi v="248" l="Inscrits" />
          <Kpi v="31%" l="Complétion Bloc 4" c={G} pin={1} />
          <Kpi v="46%" l="Relances → reprise 24 h" c={O} />
          <Kpi v="38%" l="Prévision atteinte Bloc 4" c="var(--wf-navy)" pin={2} />
        </div>
        <div className="row gap14 mt14" style={{ alignItems: "flex-start" }}>
          <div className="wf-card" style={{ flex: "0 0 300px", padding: 14 }}>
            <div className="wf-ey" style={{ marginBottom: 10 }}>Entonnoir de complétion par bloc</div>
            <div className="col gap8">
              {funnel.map(([b, p]) => (
                <div key={b}><div className="row between"><span className="wf-meta">{b}</span><span className="wf-meta" style={{ color: O }}>{p}%</span></div><div className="mt4"><Prog pct={p} orange /></div></div>
              ))}
            </div>
          </div>
          <div className="wf-card rel" style={{ flex: 1, padding: 0, overflow: "hidden" }}>
            <span className="wf-pin abs" style={{ top: -8, left: -8 }}>3</span>
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr 0.5fr 0.9fr 0.8fr 0.9fr", fontFamily: "var(--wf-mono)", fontSize: 9, color: "var(--wf-ink-3)", padding: "9px 12px", borderBottom: "1px solid var(--wf-line)", background: "var(--wf-fill)" }}>
              <span>APPRENANT</span><span>POSITION</span><span>%</span><span>DERNIER BADGE</span><span>PROJET B4</span><span>RELANCE</span>
            </div>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr 0.5fr 0.9fr 0.8fr 0.9fr", fontSize: 10.5, color: "var(--wf-ink-2)", padding: "9px 12px", borderBottom: i < rows.length - 1 ? "1px solid var(--wf-line)" : "none", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "var(--wf-ink)" }}>{r[0]}</span><span className="wf-meta">{r[1]}</span><span style={{ fontFamily: "var(--wf-mono)", color: O }}>{r[2]}</span><span>{r[3]}</span><span>{r[4]}</span><span style={{ color: r[5] !== "—" ? A : "var(--wf-mute)" }}>{r[5]}</span>
              </div>
            ))}
          </div>
        </div>
      </AdminShell>
      <div className="wf-notes">
        <div className="wf-notes__h">Reporting client</div>
        <Note n={1} lvl="non" cite="§8.2" text="Statut de complétion par bloc, position, scores, badges — temps réel, niveau cohorte & apprenant." />
        <Note n={2} lvl="req" cite="§8.2" text="Prévision de complétion Bloc 4 — pour reporting investisseurs & revues client." />
        <Note n={3} lvl="crit" cite="§8.2" text="Filtres cohorte/niveau/période ; vue lecture seule pour le client entreprise." />
      </div>
    </div>
  );

  // ---------- B · learner drill-down ----------
  const tl = [
    ["Bloc 0", "Terminé", "done", "Badge Entrée · Moment d'Ancrage saisi · pair M. Diallo"],
    ["Bloc 1", "En cours", "now", "2/6 sessions · quiz diagnostique fait · profil Réactif conscient"],
    ["Bloc 2", "Verrouillé", "lock", "Application terrain —"],
    ["Bloc 3", "Verrouillé", "lock", "Quiz final noté —"],
    ["Bloc 4", "Verrouillé", "lock", "Mini-projet + journal —"],
  ];
  const B_ = (
    <div className="wf" style={{ background: "#f4f6f9" }}>
      <AdminShell url="app.declick.kompetences.net/admin/apprenant/aminata-d" active="learners">
        <div className="row between center">
          <div className="row gap12 center">
            <div style={{ width: 40, height: 40, borderRadius: "50%", border: "1.5px solid var(--wf-line-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ico.user style={{ width: 19, height: 19, color: "var(--wf-ink-3)" }} /></div>
            <div><div className="wf-h lg">Aminata D.</div><div className="wf-meta mt2">Inscrite le 02/03/2026 · Gestion du temps · Niveau 1</div></div>
          </div>
          <div className="row gap6"><Medal kind="earned" label="E" /><Medal kind="earned" label="C" /><Medal label="P" /><Medal label="A" /><Medal kind="cert" label="★" /></div>
        </div>
        <div className="pam-box mt12 rel" style={{ fontSize: 11 }}>
          <span className="wf-pin abs" style={{ top: -8, left: -8 }}>1</span>
          <span className="pam-tag">PAM</span> « Mardi : 11 h au bureau à répondre au WhatsApp et aux urgences de mon manager — et mon dossier prioritaire n'a pas avancé. » <span className="wf-meta" style={{ color: "var(--wf-pam)" }}>· saisi le 02/03</span>
        </div>
        <div className="row gap14 mt14" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div className="wf-ey" style={{ marginBottom: 8 }}>Progression par bloc</div>
            <div className="col gap8">
              {tl.map(([b, st, s, d]) => (
                <div key={b} className="wf-card row gap10 center" style={{ padding: "9px 11px", opacity: s === "lock" ? .6 : 1 }}>
                  <span className={"node " + (s === "todo" ? "" : s)} style={{ width: 22, height: 22, flex: "0 0 22px" }}>{s === "done" ? <Ico.check style={{ width: 11, height: 11 }} /> : (s === "lock" ? <Ico.lock style={{ width: 10, height: 10 }} /> : "•")}</span>
                  <div style={{ flex: 1 }}><div className="row between center"><span style={{ fontSize: 12, fontWeight: 700 }}>{b}</span><span className="wf-meta">{st}</span></div><div className="wf-meta mt2">{d}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: "0 0 230px" }} className="rel">
            <span className="wf-pin abs" style={{ top: 18, left: -10 }}>2</span>
            <div className="wf-ey" style={{ marginBottom: 8 }}>Historique des relances</div>
            <div className="col gap8">
              <div className="wf-card" style={{ padding: 10, borderLeft: "3px solid " + G }}><div style={{ fontSize: 11, fontWeight: 700 }}>J+3 · positionnelle</div><div className="wf-meta mt2">Envoyée 09/03 · email+push · reprise ✓</div></div>
              <div className="wf-card" style={{ padding: 10, borderLeft: "3px solid " + O }}><div style={{ fontSize: 11, fontWeight: 700 }}>J+7 · reconnexion Ancrage</div><div className="wf-meta mt2">Envoyée 13/03 · SMS · pas de reprise</div></div>
              <div className="wf-card" style={{ padding: 10, borderLeft: "3px solid var(--wf-line-2)" }}><div style={{ fontSize: 11, fontWeight: 700 }}>J+14 · escalade</div><div className="wf-meta mt2">En attente</div></div>
            </div>
          </div>
        </div>
      </AdminShell>
      <div className="wf-notes">
        <div className="wf-notes__h">Fiche apprenant</div>
        <Note n={1} lvl="non" cite="§2.2" text="Le Moment d'Ancrage est stocké, requêtable par cours/apprenant/date — pas un simple champ de profil." />
        <Note n={2} lvl="req" cite="§7.4" text="Historique des relances : envoi, canal, et reprise dans les 24 h — pour mesurer l'efficacité." />
        <Note n={3} lvl="non" cite="§8.1" text="Tout est journalisé en xAPI et requêtable via le LRS / l'API REST." />
      </div>
    </div>
  );

  return (
    <DCSection id="admin" title="⑦ Tableau de bord administrateur" subtitle="Outil desktop pour Kompetences Declick & clients entreprise : vue cohorte (KPI, entonnoir, prévision) + fiche apprenant détaillée (PAM, blocs, relances, xAPI)">
      <DCArtboard id="cohort" label="Vue cohorte (client entreprise)" width={1180} height={588}>{A_}</DCArtboard>
      <DCArtboard id="learner" label="Fiche apprenant (drill-down)" width={1180} height={588}>{B_}</DCArtboard>
    </DCSection>
  );
}
window.buildAdmin = buildAdmin;
