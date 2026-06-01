// wf-dashboard.jsx — Course home / dashboard. DIRECTION RETENUE : A (reprise d'abord) + desktop.
// Approach A = resume-led minimal mobile home; D = 3-column desktop adaptation.

function DashTop() {
  return (
    <div className="wf-topbar">
      <Logo small />
      <div className="row gap10">
        <Ico.bell style={{ width: 17, height: 17, color: "var(--wf-ink-3)" }} />
        <div style={{ width: 24, height: 24, borderRadius: "50%", border: "1.5px solid var(--wf-line-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ico.user style={{ width: 13, height: 13, color: "var(--wf-ink-3)" }} /></div>
      </div>
    </div>
  );
}
const BadgeRow = () => (
  <div className="row gap8" style={{ justifyContent: "space-between" }}>
    <Medal kind="earned" label="ENTR." /><Medal kind="earned" label="COMPR." /><Medal label="PRAT." /><Medal label="ANCR." /><Medal kind="cert" label="CERT." />
  </div>
);

function buildDashboard() {
  const O = "var(--wf-orange)", G = "var(--wf-green)";

  // ---------- A · reprise d'abord (direction retenue) ----------
  const A = (
    <Annotated notesTitle="Direction retenue">
      <Phone tab={0}>
        <DashTop />
        <div style={{ padding: "12px 0 6px" }}>
          <div className="wf-ey">Gestion du temps & productivité · Niveau 1</div>
          <div className="wf-h lg mt6">Bonjour Aminata</div>
        </div>
        <div className="wf-card tint-o rel" style={{ background: "#fff8f2" }}>
          <Pin n={1} style={{ top: -8, right: -8 }} />
          <div className="wf-ey" style={{ color: O }}>Reprendre</div>
          <div className="wf-h md mt6">Bloc 1 · 1.1 — Le temps africain & le temps organisationnel</div>
          <div className="wf-meta mt6">⤺ position exacte · vidéo 03:48</div>
          <div className="mt10"><Btn kind="primary" block arrow>Reprendre</Btn></div>
          <div className="wf-meta mt8" style={{ color: "var(--wf-ink-2)" }}>Dernière terminée : « Quiz diagnostique » · profil : Réactif conscient</div>
        </div>
        <div className="wf-card mt12 rel">
          <Pin n={2} style={{ top: -8, right: -8 }} />
          <div className="row between center"><span className="wf-h md">Progression</span><span className="wf-meta" style={{ color: O }}>38 %</span></div>
          <div className="mt8"><Prog pct={38} orange /></div>
          <div className="row between mt8"><span className="wf-meta">2 / 5 blocs</span><span className="wf-meta">⏱ ≈ 2 h 10 restantes</span></div>
        </div>
        <div className="mt12 rel">
          <Pin n={3} style={{ top: -4, right: -4 }} />
          <div className="wf-ey" style={{ marginBottom: 8 }}>Votre parcours</div>
          <Rail state={["done", "now", "lock", "lock", "lock"]} />
        </div>
        <div className="wf-card mt12 row gap10 center rel" style={{ padding: "10px 12px" }}>
          <Pin n={4} style={{ top: -8, right: -8 }} />
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--wf-green-t)", border: "1.5px solid " + G, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 28px" }}><Ico.user style={{ width: 14, height: 14, color: G }} /></div>
          <div style={{ flex: 1 }}><div className="wf-meta">Pair de progression</div><div className="wf-h md" style={{ fontSize: 13 }}>M. Diallo</div></div>
          <span className="wf-chip" style={{ background: "var(--wf-green-t)", color: G, borderColor: "#b5e3c2", fontSize: 9.5 }}>Notifié · Bloc 1 ✓</span>
        </div>
        <div className="mt14"><div className="wf-ey" style={{ marginBottom: 8 }}>Badges</div><BadgeRow /></div>
      </Phone>
      {[
        { n: 1, lvl: "non", cite: "§7.2", text: "Reprise en 1 tap → position exacte, jamais l'accueil du bloc." },
        { n: 2, lvl: "non", cite: "§7.1", text: "% complété ET temps restant, toujours visibles." },
        { n: 3, lvl: "non", cite: "§7.6", text: "Blocs verrouillés tant que le précédent n'est pas validé." },
        { n: 4, lvl: "non", cite: "§7.3", text: "Statut du pair sur l'accueil : notifié automatiquement à chaque badge." },
      ].map((x) => <Note key={x.n} {...x} />)}
    </Annotated>
  );

  // ---------- Desktop adaptation ----------
  const D = (
    <div className="wf" style={{ background: "#f4f6f9" }}>
      <Win url="app.declick.kompetences.net/cours/gestion-du-temps-n1">
        <div className="wf-topbar" style={{ padding: "12px 20px" }}>
          <div className="row gap14"><Logo /><span className="wf-chip member" style={{ fontSize: 9.5 }}><span className="dot" />Membre de KOMPETENCES AFRICA</span></div>
          <div className="row gap12"><Ico.bell style={{ width: 18, height: 18, color: "var(--wf-ink-3)" }} /><div style={{ width: 26, height: 26, borderRadius: "50%", border: "1.5px solid var(--wf-line-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ico.user style={{ width: 14, height: 14, color: "var(--wf-ink-3)" }} /></div></div>
        </div>
        <div style={{ display: "flex", minHeight: 470 }}>
          {/* left nav */}
          <div style={{ width: 178, borderRight: "1px solid var(--wf-line)", padding: 16, flex: "0 0 178px" }}>
            <div className="wf-ey" style={{ marginBottom: 10 }}>Parcours</div>
            <div className="col gap6">
              {[["0", "Onboarding", "done"], ["1", "Comprendre", "now"], ["2", "Pratiquer", "lock"], ["3", "Habitudes", "lock"], ["4", "Mini-projet", "lock"]].map(([i, n, s]) => (
                <div key={i} className="row gap8 center" style={{ padding: "7px 9px", borderRadius: 8, background: s === "now" ? "#fff3e9" : "transparent", opacity: s === "lock" ? .55 : 1 }}>
                  <span className={"node " + (s === "todo" ? "" : s)} style={{ width: 22, height: 22, fontSize: 9, border: "1.5px solid " + (s === "now" ? O : "var(--wf-line-2)"), borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: s === "done" ? G : "#fff", color: s === "done" ? "#fff" : (s === "now" ? O : "var(--wf-ink-3)"), fontFamily: "var(--wf-mono)" }}>{s === "done" ? "✓" : (s === "lock" ? <Ico.lock style={{ width: 10, height: 10 }} /> : i)}</span>
                  <span style={{ fontSize: 12, fontWeight: s === "now" ? 700 : 500, color: "var(--wf-ink-2)" }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
          {/* center */}
          <div style={{ flex: 1, padding: 20 }}>
            <div className="wf-ey">Gestion du temps & productivité · Niveau 1</div>
            <div className="wf-h xl mt6">Bloc 1 — Comprendre les dynamiques du temps</div>
            <div className="wf-card tint-o mt12" style={{ background: "#fff8f2" }}>
              <div className="row between center">
                <div><div className="wf-ey" style={{ color: O }}>Reprendre où vous en étiez</div><div className="wf-h md mt6">1.1 — Le temps africain & le temps organisationnel · ⤺ 03:48</div></div>
                <Btn kind="primary" arrow>Reprendre</Btn>
              </div>
            </div>
            <div className="wf-ey mt16" style={{ marginBottom: 8 }}>Micro-sessions du bloc</div>
            <div className="col gap8">
              {[["1.0", "Quiz diagnostique (10 Q)", "15 min", "done"], ["1.1", "Le temps africain & organisationnel", "6 min", "now"], ["1.2", "La matrice des priorités africaine", "6 min", "todo"], ["1.3", "La culture de l'urgence", "6 min", "todo"]].map(([i, t, d, s]) => (
                <div key={i} className="wf-card row between center" style={{ padding: "9px 12px" }}>
                  <div className="row gap10 center"><div className="wf-img cross" style={{ width: 52, height: 32, borderRadius: 5 }} /><div><div className="wf-meta">Micro-session {i}</div><div className="wf-h md" style={{ fontSize: 13 }}>{t}</div></div></div>
                  <div className="row gap10 center"><span className="wf-meta" style={{ color: O }}>◷ {d}</span>{s === "done" ? <Ico.check style={{ width: 16, height: 16, color: G }} /> : <Btn sm>{s === "now" ? "Reprendre" : "Démarrer"}</Btn>}</div>
                </div>
              ))}
            </div>
          </div>
          {/* right rail */}
          <div style={{ width: 196, borderLeft: "1px solid var(--wf-line)", padding: 16, flex: "0 0 196px" }}>
            <div className="wf-card soft tc" style={{ padding: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", border: "3px solid " + G, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--wf-mono)", fontWeight: 600, fontSize: 15, color: G }}>64</div>
              <div className="wf-meta mt6">Score productivité africaine</div>
            </div>
            <div className="wf-card mt10"><div className="row between"><span className="wf-meta">Progression</span><span className="wf-meta" style={{ color: O }}>38%</span></div><div className="mt6"><Prog pct={38} orange /></div><div className="wf-meta mt6">⏱ ≈ 2 h 10</div></div>
            <div className="wf-card mt10 row gap8 center"><div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--wf-green-t)", border: "1.5px solid " + G, flex: "0 0 26px" }} /><div><div className="wf-meta">Pair</div><div style={{ fontSize: 11, fontWeight: 700 }}>M. Diallo ✓</div></div></div>
            <div className="wf-ey mt14" style={{ marginBottom: 8 }}>Badges</div>
            <div className="row wrap gap6"><Medal kind="earned" label="E" /><Medal kind="earned" label="C" /><Medal label="P" /><Medal label="A" /><Medal kind="cert" label="★" /></div>
          </div>
        </div>
      </Win>
      <div className="wf-notes">
        <div className="wf-notes__h">Desktop = secondaire</div>
        <Note n={1} lvl="non" cite="§4.4" text="Le mobile est le cas primaire ; le desktop reprend la même logique en 3 colonnes." />
        <Note n={2} lvl="non" cite="§7.2" text="« Reprendre » reste l'action n°1, en haut, partout." />
        <Note n={3} lvl="non" cite="Failure 8" text="Durée affichée sur chaque carte session, avant le lancement." />
      </div>
    </div>
  );

  return (
    <DCSection id="dashboard" title="② Tableau de bord / accueil du cours" subtitle="Direction retenue : « reprise d'abord » (minimal) · mobile + adaptation desktop 3 colonnes">
      <DCArtboard id="a" label="Mobile · accueil (reprise d'abord)" width={616} height={812}>{A}</DCArtboard>
      <DCArtboard id="d" label="Desktop · adaptation 3 colonnes" width={1160} height={620}>{D}</DCArtboard>
    </DCSection>
  );
}
window.buildDashboard = buildDashboard;
