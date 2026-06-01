// hf-dashboard.jsx — Hi-fi dashboard (mobile + desktop), Declick DS.

function HDashAppbar() {
  return (
    <div className="hf-appbar">
      <HLogo />
      <div className="hf-row g14">
        <HIco.bell style={{ width: 20, height: 20, color: "var(--fg-2)" }} />
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-tint)", display: "grid", placeItems: "center", color: "var(--navy-500)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13 }}>A</div>
      </div>
    </div>
  );
}
const HBadgeRow = () => (
  <div className="hf-row hf-between">
    <HMedal kind="earned" label="Entrée" /><HMedal kind="earned" label="Compr." /><HMedal label="Prat." /><HMedal label="Ancr." /><HMedal kind="cert" label="Niv. 1" />
  </div>
);

function buildHfDashboard() {
  // ---------- mobile ----------
  const M = (
    <HAnnotated title="Design system appliqué" notes={[
      "Palette navy + orange CTA + mint Declick ; Plus Jakarta Sans display, DM Sans corps.",
      "Carte « Reprendre » à liseré orange, bouton pill + glow — l'action n°1, en haut.",
      "Médailles de badges en mint/orange ; pair en carte mint.",
    ]}>
      <HPhone tab="home">
        <HDashAppbar />
        <div style={{ padding: "8px 2px 4px" }}>
          <div className="hf-eyebrow">Gestion du temps & productivité · Niveau 1</div>
          <div className="hf-h1 mt6">Bonjour Aminata</div>
        </div>
        <div className="hf-card hf-card--peach hf-card--stripe-orange mt16">
          <div className="hf-eyebrow">Reprendre</div>
          <div className="hf-h3 mt8">Bloc 1 · 1.1 — Le temps africain & le temps organisationnel</div>
          <div className="hf-meta mt8" style={{ color: "var(--orange-700)" }}>↺ Reprise exacte · vidéo 03:48</div>
          <div className="mt14"><HBtn kind="primary" block arrow>Reprendre</HBtn></div>
          <div className="hf-meta mt10">Dernière terminée : « Quiz diagnostique » · profil <b style={{ color: "var(--navy-600)" }}>Réactif conscient</b></div>
        </div>
        <div className="hf-card mt14">
          <div className="hf-row hf-between" style={{ alignItems: "baseline" }}><span className="hf-h4">Progression</span><span className="hf-num" style={{ fontSize: 20, color: "var(--orange-500)" }}>38%</span></div>
          <div className="mt10"><HProg pct={38} /></div>
          <div className="hf-row hf-between mt10"><span className="hf-meta">2 / 5 blocs</span><span className="hf-meta">⏱ ≈ 2 h 10 restantes</span></div>
        </div>
        <div className="mt16">
          <div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 10 }}>Votre parcours</div>
          <HRail state={["done", "now", "lock", "lock", "lock"]} />
        </div>
        <div className="hf-card hf-card--mint mt16 hf-row g12" style={{ alignItems: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", color: "var(--brand-declick)", flex: "0 0 38px" }}><HIco.users style={{ width: 19, height: 19 }} /></div>
          <div className="hf-grow"><div className="hf-meta">Pair de progression</div><div className="hf-h4">M. Diallo</div></div>
          <span className="hf-pill hf-pill--mint hf-pill--sm"><HIco.check style={{ width: 12, height: 12 }} />Notifié · Bloc 1</span>
        </div>
        <div className="mt16"><div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 10 }}>Badges</div><HBadgeRow /></div>
      </HPhone>
    </HAnnotated>
  );

  // ---------- desktop ----------
  const navItems = [["0", "Onboarding & déclencheur", "done", HIco.home], ["1", "Comprendre le temps", "now", HIco.book], ["2", "Pratiquer & progresser", "lock", HIco.book], ["3", "Installer des habitudes", "lock", HIco.book], ["4", "Mini-projet certifiant", "lock", HIco.award]];
  const sess = [["1.0", "Quiz diagnostique (10 Q)", "15 min", "done"], ["1.1", "Le temps africain & le temps organisationnel", "20 min", "now"], ["1.2", "La matrice des priorités africaine", "20 min", "todo"], ["1.3", "La culture de l'urgence africaine", "20 min", "todo"]];
  const D = (
    <div className="hf">
      <HWin url="app.declick.kompetences.net/cours/gestion-du-temps-n1">
        <div className="hf-appbar" style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
          <div className="hf-row g16"><HLogo /><HMember /></div>
          <div className="hf-row g16"><HIco.bell style={{ width: 20, height: 20, color: "var(--fg-2)" }} /><div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg-tint)", display: "grid", placeItems: "center", color: "var(--navy-500)", fontFamily: "var(--font-display)", fontWeight: 800 }}>A</div></div>
        </div>
        <div style={{ display: "flex", minHeight: 520 }}>
          {/* nav */}
          <div style={{ width: 232, flex: "0 0 232px", borderRight: "1px solid var(--line)", padding: 18 }}>
            <div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 12 }}>Parcours</div>
            <div className="hf-col g6">
              {navItems.map(([i, n, s, Ic]) => (
                <div key={i} className="hf-row g10" style={{ padding: "10px 12px", borderRadius: 12, background: s === "now" ? "var(--orange-50)" : "transparent", opacity: s === "lock" ? .5 : 1, alignItems: "center" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: s === "done" ? "var(--brand-declick)" : s === "now" ? "var(--orange-500)" : "var(--bg-soft)", color: s === "lock" ? "var(--fg-3)" : "#fff", flex: "0 0 28px" }}>{s === "done" ? <HIco.check style={{ width: 15, height: 15 }} /> : s === "lock" ? <HIco.lock style={{ width: 14, height: 14 }} /> : <Ic style={{ width: 15, height: 15 }} />}</span>
                  <span style={{ fontSize: 13, fontWeight: s === "now" ? 800 : 600, color: "var(--fg-1)", fontFamily: "var(--font-display)" }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
          {/* center */}
          <div style={{ flex: 1, padding: 24 }}>
            <div className="hf-eyebrow">Gestion du temps & productivité · Niveau 1</div>
            <div className="hf-h1 mt6">Bloc 1 — Comprendre les dynamiques du temps</div>
            <div className="hf-card hf-card--peach hf-card--stripe-orange mt16">
              <div className="hf-row hf-between" style={{ alignItems: "center" }}>
                <div><div className="hf-eyebrow">Reprendre où vous en étiez</div><div className="hf-h3 mt6">1.1 — Le temps africain & le temps organisationnel</div><div className="hf-meta mt6" style={{ color: "var(--orange-700)" }}>↺ vidéo 03:48</div></div>
                <HBtn kind="primary" arrow>Reprendre</HBtn>
              </div>
            </div>
            <div className="hf-eyebrow mt24" style={{ color: "var(--navy-400)", marginBottom: 12 }}>Micro-sessions du bloc</div>
            <div className="hf-col g10">
              {sess.map(([i, t, d, s]) => (
                <div key={i} className="hf-card hf-card--tight hf-row hf-between" style={{ alignItems: "center" }}>
                  <div className="hf-row g14" style={{ alignItems: "center" }}>
                    <div style={{ width: 64, height: 40, borderRadius: 8, background: s === "done" ? "var(--brand-declick-tint)" : "var(--navy-50)", display: "grid", placeItems: "center", color: s === "done" ? "var(--brand-declick)" : "var(--navy-300)" }}>{s === "done" ? <HIco.check style={{ width: 18, height: 18 }} /> : <HIco.book style={{ width: 16, height: 16 }} />}</div>
                    <div><div className="hf-meta">Micro-session {i}</div><div className="hf-h4" style={{ fontSize: 14 }}>{t}</div></div>
                  </div>
                  <div className="hf-row g12" style={{ alignItems: "center" }}><span className="hf-pill hf-pill--orange hf-pill--sm">◷ {d}</span>{s === "done" ? <span className="hf-check"><HIco.check style={{ width: 18, height: 18 }} /></span> : <HBtn sm kind={s === "now" ? "primary" : "outline"}>{s === "now" ? "Reprendre" : "Démarrer"}</HBtn>}</div>
                </div>
              ))}
            </div>
          </div>
          {/* right rail */}
          <div style={{ width: 240, flex: "0 0 240px", borderLeft: "1px solid var(--line)", padding: 18 }}>
            <div className="hf-card hf-tc">
              <div style={{ display: "grid", placeItems: "center" }}><HRing pct={64} size={80} /></div>
              <div className="hf-h4 mt10">Score productivité</div>
              <div className="hf-meta mt4">africaine · temps réel</div>
            </div>
            <div className="hf-card hf-card--tight mt12">
              <div className="hf-row hf-between"><span className="hf-meta">Progression</span><span className="hf-num" style={{ fontSize: 15, color: "var(--orange-500)" }}>38%</span></div>
              <div className="mt8"><HProg pct={38} /></div>
              <div className="hf-meta mt8">⏱ ≈ 2 h 10 restantes</div>
            </div>
            <div className="hf-card hf-card--mint hf-card--tight mt12 hf-row g10" style={{ alignItems: "center" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", color: "var(--brand-declick)", flex: "0 0 30px" }}><HIco.users style={{ width: 15, height: 15 }} /></div>
              <div className="hf-grow"><div className="hf-meta">Pair</div><div className="hf-h4" style={{ fontSize: 13 }}>M. Diallo ✓</div></div>
            </div>
            <div className="hf-eyebrow mt16" style={{ color: "var(--navy-400)", marginBottom: 10 }}>Badges</div>
            <div className="hf-row hf-wrap g8"><HMedal kind="earned" label="E" /><HMedal kind="earned" label="C" /><HMedal label="P" /><HMedal label="A" /><HMedal kind="cert" label="N1" /></div>
          </div>
        </div>
      </HWin>
      <div className="hf-notes">
        <div className="hf-notes__h">Desktop = secondaire</div>
        <HNote n={1} t="Même logique en 3 colonnes : nav parcours, contenu, rail de progression." />
        <HNote n={2} t="« Reprendre » garde le liseré orange et reste l'action n°1." />
        <HNote n={3} t="Durée sur chaque carte session, badge « Membre de KOMPETENCES AFRICA »." />
      </div>
    </div>
  );

  return (
    <DCSection id="hf-dashboard" title="② Tableau de bord — hi-fi" subtitle="Direction « reprise d'abord » · design system Declick appliqué · mobile + desktop">
      <DCArtboard id="m" label="Mobile · accueil" width={644} height={1032}>{M}</DCArtboard>
      <DCArtboard id="d" label="Desktop · accueil 3 colonnes" width={1228} height={884}>{D}</DCArtboard>
    </DCSection>
  );
}
window.buildHfDashboard = buildHfDashboard;
