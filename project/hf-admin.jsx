// hf-admin.jsx — Hi-fi administrator dashboard (cohort + learner drill-down), desktop.

function HAdminShell({ url, active, sub, children }) {
  const nav = [["Vue cohorte", "cohort"], ["Apprenants", "learners"], ["Projets Bloc 4", "proj"], ["Relances", "reeng"]];
  return (
    <HWin url={url}>
      <div className="hf-appbar" style={{ padding: "14px 24px", borderBottom: "1px solid var(--line)" }}>
        <div className="hf-row g16"><HLogo /><span className="hf-pill hf-pill--soft hf-pill--sm">Tableau de bord administrateur</span></div>
        <span className="hf-pill"><span className="dot" />Client : Orange CI · lecture seule</span>
      </div>
      <div style={{ display: "flex", minHeight: 500 }}>
        <div style={{ width: 184, flex: "0 0 184px", borderRight: "1px solid var(--line)", padding: 16 }}>
          <div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 12 }}>Navigation</div>
          <div className="hf-col g4">{nav.map(([n, id]) => <div key={id} style={{ padding: "9px 12px", borderRadius: 10, fontFamily: "var(--font-display)", fontSize: 13, fontWeight: id === active ? 800 : 600, color: id === active ? "var(--orange-600)" : "var(--fg-2)", background: id === active ? "var(--orange-50)" : "transparent" }}>{n}</div>)}</div>
        </div>
        <div style={{ flex: 1, padding: 24 }}>{children}</div>
      </div>
    </HWin>
  );
}
const HKpi = ({ v, l, c }) => (<div className="hf-card hf-card--tight" style={{ flex: 1 }}><div className="hf-num" style={{ fontSize: 30, color: c || "var(--navy-600)" }}>{v}</div><div className="hf-meta mt4">{l}</div></div>);

function buildHfAdmin() {
  const funnel = [["Bloc 0", 100], ["Bloc 1", 82], ["Bloc 2", 61], ["Bloc 3", 44], ["Bloc 4", 31]];
  const rows = [["Aminata D.", "B1 · 1.2", "38%", "Compréhension", "—", "J+7 envoyée"], ["Ibrahima S.", "B3 · quiz final", "71%", "Pratique", "—", "—"], ["Mariam T.", "B0 · ancrage", "8%", "—", "—", "J+3 envoyée"], ["Fatou S.", "B4 · projet", "96%", "Ancrage", "soumis", "—"]];

  const Cohort = (
    <div className="hf">
      <HAdminShell url="app.declick.kompetences.net/admin/cohorte" active="cohort">
        <div className="hf-row hf-between" style={{ alignItems: "flex-start" }}>
          <div><div className="hf-eyebrow">Vue cohorte · Gestion du temps · Niveau 1</div><div className="hf-h1 mt6">Promo Orange CI — Mars 2026</div></div>
          <div className="hf-row g8"><span className="hf-pill hf-pill--soft hf-pill--sm">Cohorte ▾</span><span className="hf-pill hf-pill--soft hf-pill--sm">Niveau ▾</span><span className="hf-pill hf-pill--soft hf-pill--sm">Période ▾</span></div>
        </div>
        <div className="hf-row g12 mt16"><HKpi v="248" l="Inscrits" /><HKpi v="31%" l="Complétion Bloc 4" c="var(--brand-declick)" /><HKpi v="46%" l="Relances → reprise 24 h" c="var(--orange-500)" /><HKpi v="38%" l="Prévision atteinte Bloc 4" c="var(--navy-500)" /></div>
        <div className="hf-row g16 mt16" style={{ alignItems: "flex-start" }}>
          <div className="hf-card" style={{ flex: "0 0 320px" }}>
            <div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 12 }}>Entonnoir de complétion par bloc</div>
            <div className="hf-col g10">{funnel.map(([b, p]) => <div key={b}><div className="hf-row hf-between"><span className="hf-meta" style={{ fontWeight: 700 }}>{b}</span><span className="hf-num" style={{ fontSize: 13, color: "var(--orange-500)" }}>{p}%</span></div><div className="mt4"><HProg pct={p} /></div></div>)}</div>
          </div>
          <div className="hf-card" style={{ flex: 1, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr .5fr 1fr .7fr .9fr", padding: "12px 16px", borderBottom: "1px solid var(--line)", background: "var(--bg-soft)", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 800, letterSpacing: ".04em", color: "var(--fg-3)" }}><span>APPRENANT</span><span>POSITION</span><span>%</span><span>DERNIER BADGE</span><span>PROJET</span><span>RELANCE</span></div>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr .5fr 1fr .7fr .9fr", padding: "12px 16px", borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : "none", alignItems: "center", fontSize: 12.5, color: "var(--fg-2)" }}>
                <span className="hf-h4" style={{ fontSize: 13 }}>{r[0]}</span><span className="hf-meta">{r[1]}</span><span className="hf-num" style={{ fontSize: 13, color: "var(--orange-500)" }}>{r[2]}</span><span>{r[3]}</span><span>{r[4]}</span><span style={{ color: r[5] !== "—" ? "var(--orange-600)" : "var(--fg-mute)", fontWeight: r[5] !== "—" ? 700 : 400 }}>{r[5]}</span>
              </div>
            ))}
          </div>
        </div>
      </HAdminShell>
      <div className="hf-notes"><div className="hf-notes__h">Reporting client</div><HNote n={1} t="Complétion par bloc, position, scores, badges — temps réel, cohorte & apprenant." /><HNote n={2} t="Prévision de complétion Bloc 4 — pour investisseurs & revues client." /><HNote n={3} t="Filtres cohorte/niveau/période ; vue lecture seule pour le client entreprise." /></div>
    </div>
  );

  const tl = [["Bloc 0", "Terminé", "done", "Badge Entrée · Moment d'Ancrage saisi · pair M. Diallo"], ["Bloc 1", "En cours", "now", "2/6 sessions · quiz diagnostique fait · profil Réactif conscient"], ["Bloc 2", "Verrouillé", "lock", "Application terrain —"], ["Bloc 3", "Verrouillé", "lock", "Quiz final noté —"], ["Bloc 4", "Verrouillé", "lock", "Mini-projet + journal —"]];
  const Learner = (
    <div className="hf">
      <HAdminShell url="app.declick.kompetences.net/admin/apprenant/aminata-d" active="learners">
        <div className="hf-row hf-between" style={{ alignItems: "center" }}>
          <div className="hf-row g14" style={{ alignItems: "center" }}><div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--bg-tint)", display: "grid", placeItems: "center", color: "var(--navy-500)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 }}>A</div><div><div className="hf-h2">Aminata D.</div><div className="hf-meta mt2">Inscrite le 02/03/2026 · Gestion du temps · Niveau 1</div></div></div>
          <div className="hf-row g6"><HMedal kind="earned" label="E" /><HMedal kind="earned" label="C" /><HMedal label="P" /><HMedal label="A" /><HMedal kind="cert" label="N1" /></div>
        </div>
        <div className="mt16"><HPam>« Mardi : 11 h au bureau à répondre au WhatsApp et aux urgences de mon manager — et <em>mon dossier prioritaire n'a pas avancé</em>. » <span className="hf-meta" style={{ color: "var(--orange-700)" }}>· saisi le 02/03</span></HPam></div>
        <div className="hf-row g16 mt16" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 10 }}>Progression par bloc</div>
            <div className="hf-col g8">{tl.map(([b, st, s, d]) => (
              <div key={b} className="hf-card hf-card--tight hf-row g12" style={{ alignItems: "center", opacity: s === "lock" ? .62 : 1 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", flex: "0 0 28px", display: "grid", placeItems: "center", background: s === "done" ? "var(--brand-declick)" : s === "now" ? "var(--orange-500)" : "var(--bg-soft)", color: s === "lock" ? "var(--fg-3)" : "#fff" }}>{s === "done" ? <HIco.check style={{ width: 14, height: 14 }} /> : s === "lock" ? <HIco.lock style={{ width: 13, height: 13 }} /> : "•"}</span>
                <div className="hf-grow"><div className="hf-row hf-between" style={{ alignItems: "center" }}><span className="hf-h4" style={{ fontSize: 13 }}>{b}</span><span className="hf-meta">{st}</span></div><div className="hf-meta mt2">{d}</div></div>
              </div>
            ))}</div>
          </div>
          <div style={{ flex: "0 0 260px" }}>
            <div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 10 }}>Historique des relances</div>
            <div className="hf-col g8">
              <div className="hf-card hf-card--tight" style={{ borderLeft: "4px solid var(--brand-declick)" }}><div className="hf-h4" style={{ fontSize: 12.5 }}>J+3 · positionnelle</div><div className="hf-meta mt2">09/03 · email+push · reprise ✓</div></div>
              <div className="hf-card hf-card--tight" style={{ borderLeft: "4px solid var(--orange-500)" }}><div className="hf-h4" style={{ fontSize: 12.5 }}>J+7 · reconnexion Ancrage</div><div className="hf-meta mt2">13/03 · SMS · pas de reprise</div></div>
              <div className="hf-card hf-card--tight" style={{ borderLeft: "4px solid var(--line-strong)" }}><div className="hf-h4" style={{ fontSize: 12.5 }}>J+14 · escalade</div><div className="hf-meta mt2">En attente</div></div>
            </div>
          </div>
        </div>
      </HAdminShell>
      <div className="hf-notes"><div className="hf-notes__h">Fiche apprenant</div><HNote n={1} t="Le Moment d'Ancrage est stocké, requêtable par cours/apprenant/date." /><HNote n={2} t="Historique des relances : envoi, canal, reprise 24 h — pour mesurer l'efficacité." /><HNote n={3} t="Tout est journalisé en xAPI et requêtable via le LRS / l'API REST." /></div>
    </div>
  );

  return (
    <DCSection id="hf-admin" title="⑦ Tableau de bord administrateur — hi-fi" subtitle="Outil desktop · client entreprise : vue cohorte (KPI, entonnoir, prévision) + fiche apprenant (Moment d'Ancrage, blocs, relances) · design system Declick">
      <DCArtboard id="cohort" label="Vue cohorte (client entreprise)" width={1228} height={688}>{Cohort}</DCArtboard>
      <DCArtboard id="learner" label="Fiche apprenant (drill-down)" width={1228} height={776}>{Learner}</DCArtboard>
    </DCSection>
  );
}
window.buildHfAdmin = buildHfAdmin;
