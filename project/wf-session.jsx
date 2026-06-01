// wf-session.jsx — Micro-session delivery. DIRECTION RETENUE : liste + lecteur→exercice, mobile + desktop.
// Two screens of the chosen micro-session experience (browse → learn) + desktop loop.

function VideoBox({ h = 130 }) {
  return (
    <div className="wf-img cross rel" style={{ height: h, borderRadius: 8 }}>
      <div className="wf-img__play" />
      <span style={{ position: "absolute", top: 7, right: 7 }} className="wf-chip"><span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--wf-green)" }} />auto 480p</span>
      <div style={{ position: "absolute", left: 8, bottom: 7, display: "flex", gap: 6 }}>
        <span className="wf-chip" style={{ fontSize: 9 }}>ST · ON</span>
        <span className="wf-chip" style={{ fontSize: 9 }}>1× ▾</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "var(--wf-fill-2)" }}><div style={{ width: "38%", height: "100%", background: "var(--wf-orange)" }} /></div>
    </div>
  );
}

function buildSession() {
  const O = "var(--wf-orange)", G = "var(--wf-green)";

  // ---------- Mobile · session list ----------
  const sessions = [
    ["1.0", "Quiz diagnostique (10 Q · avant les vidéos)", "15 min", "done"],
    ["1.1", "Le temps africain & le temps organisationnel", "20 min", "done"],
    ["1.2", "La matrice des priorités africaine", "20 min", "now"],
    ["1.3", "La culture de l'urgence africaine", "20 min", "todo"],
    ["1.4", "Gérer les interruptions", "20 min", "todo"],
  ];
  const A = (
    <Annotated notesTitle="Direction retenue">
      <Phone tab={1}>
        <div className="wf-topbar" style={{ margin: "-14px -14px 0", padding: "10px 14px" }}><Logo small /><span className="wf-meta">Bloc 1 / 5</span></div>
        <div style={{ padding: "12px 0 4px" }} className="rel">
          <div className="wf-ey">Bloc 1 — Comprendre les dynamiques du temps</div>
          <div className="wf-h lg mt4">6 micro-sessions</div>
          <div className="wf-meta mt4">Faites-les dans l'ordre que vous voulez.<Pin n={1} style={{ marginLeft: 4 }} /></div>
        </div>
        <div className="wf-card soft mt10 rel" style={{ borderLeft: "3px solid " + G }}>
          <Pin n={2} style={{ top: -8, right: -8 }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: G }}>3 points clés de votre dernière session</div>
          <div className="mt6"><Bars n={3} cls="x" /></div>
        </div>
        <div className="col gap8 mt10">
          {sessions.map(([i, t, d, s]) => (
            <div key={i} className="wf-card row gap10 center rel" style={{ padding: "9px 10px", opacity: 1 }}>
              {i === "1.2" && <Pin n={3} style={{ top: -8, left: -8 }} />}
              <div className="wf-img cross" style={{ width: 46, height: 32, borderRadius: 5, flex: "0 0 46px" }}>{s === "done" && <Ico.check style={{ width: 14, height: 14, color: G, position: "relative", zIndex: 2 }} />}</div>
              <div style={{ flex: 1 }}><div className="wf-h md" style={{ fontSize: 12.5, lineHeight: 1.15 }}>{t}</div><div className="row gap8 mt4 center"><span className="wf-meta" style={{ color: O, fontWeight: 600 }}>◷ {d}</span>{s === "done" && <span className="wf-meta" style={{ color: G }}>Terminée</span>}</div></div>
              {s === "now" ? <Btn kind="primary" sm>Reprendre</Btn> : (s === "todo" ? <Btn sm>Démarrer</Btn> : null)}
            </div>
          ))}
        </div>
      </Phone>
      {[
        { n: 1, lvl: "non", cite: "§4.1", text: "Sessions autonomes : pas d'ordre imposé dans le bloc (gating au niveau bloc seulement)." },
        { n: 2, lvl: "crit", cite: "§4.1", text: "Résumé « 3 points clés » à l'entrée de chaque session après la 1re." },
        { n: 3, lvl: "non", cite: "Failure 8", text: "Durée affichée sur chaque carte, avant le lancement — moteur de démarrage." },
      ].map((x) => <Note key={x.n} {...x} />)}
    </Annotated>
  );

  // ---------- Mobile · player → exercise (the core loop) ----------
  const B = (
    <Annotated notesTitle="Direction retenue">
      <Phone tab={1}>
        <div className="rel" style={{ paddingTop: 2 }}>
          <div className="row between center"><span className="wf-ey">Bloc 1 · Micro-session 1.1</span><span className="wf-meta">◷ 20 min</span></div>
          <div className="wf-h md mt4">Le temps africain & le temps organisationnel</div>
          <div className="wf-card soft mt8" style={{ padding: "7px 9px", borderLeft: "3px solid " + G }}><div style={{ fontSize: 10, fontWeight: 700, color: G }}>Résumé · 3 points clés précédents</div><div className="mt4"><Bars n={2} cls="x" gap={4} /></div></div>
          <div className="mt10 rel"><Pin n={1} style={{ top: -8, right: -8 }} /><VideoBox /></div>
          <div className="wf-meta mt6" style={{ color: O }}>⤺ Reprise auto à 03:48 · sync multi-appareils · ↓ hors-ligne</div>
          <div className="wf-card mt10 rel" style={{ borderTop: "3px solid " + O }}>
            <Pin n={2} style={{ top: -8, left: -8 }} />
            <div className="wf-ey" style={{ color: O }}>Micro-exercice — obligatoire</div>
            <div className="wf-h md mt4" style={{ fontSize: 12.5 }}>Cartographier mes deux types de temps</div>
            <div className="pam-box mt8"><span className="pam-tag">PAM</span> « D'après <span style={{ textDecoration: "underline dashed" }}>la journée que vous avez décrite au Bloc 0</span>, classez vos activités entre temps polychronique et monochronique. »</div>
            <div className="col gap6 mt8">
              {[["Activité polychronique", "WhatsApp, visites, sollicitations"], ["Activité monochronique", "votre dossier prioritaire"]].map(([l, ex]) => <div key={l} style={{ border: "1.5px solid var(--wf-line)", borderRadius: 7, padding: "7px 10px" }}><div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--wf-ink-2)" }}>{l}</div><div className="wf-meta mt2">{ex}</div></div>)}
            </div>
            <div className="wf-card mt8 rel" style={{ borderLeft: "3px solid " + G, background: "var(--wf-green-t)", padding: 9 }}>
              <Pin n={3} style={{ top: -8, right: -8 }} />
              <div style={{ fontSize: 10.5, fontWeight: 700, color: G }}>Feedback immédiat</div>
              <div className="wf-meta mt4" style={{ fontFamily: "var(--wf-ui)", fontSize: 10, lineHeight: 1.45, color: "var(--wf-ink-2)" }}>Analyse de votre répartition + recommandations selon votre profil de gestion du temps — affichée avant de continuer.</div>
            </div>
          </div>
          <div className="mt10"><Btn kind="primary" block arrow>Session suivante</Btn></div>
          <div className="wf-meta tc mt6" style={{ color: "var(--wf-ink-3)" }}>Verrouillé tant que l'exercice n'est pas complété.</div>
        </div>
      </Phone>
      {[
        { n: 1, lvl: "non", cite: "§4.2 · §4.3", text: "Auto-resume à la position exacte (±5 s), serveur, multi-appareils. Débit adaptatif + sous-titres + hors-ligne." },
        { n: 2, lvl: "non", cite: "§5.1 · §2.3", text: "Chaque vidéo est suivie d'un exercice — avec le PAM injecté dans la consigne." },
        { n: 3, lvl: "non", cite: "§5.1", text: "Feedback explicatif complet, affiché avant de pouvoir avancer." },
      ].map((x) => <Note key={x.n} {...x} />)}
    </Annotated>
  );

  // ---------- Desktop adaptation (lecteur → exercice) ----------
  const D = (
    <div className="wf" style={{ background: "#f4f6f9" }}>
      <Win url="app.declick.kompetences.net/cours/gestion-du-temps-n1/1.1">
        <div className="wf-topbar" style={{ padding: "12px 20px" }}>
          <div className="row gap12 center"><Logo /><span className="wf-chip" style={{ fontSize: 9.5 }}>Bloc 1 · Micro-session 1.1</span></div>
          <span className="wf-meta">◷ 20 min · ⤺ reprise auto 03:48</span>
        </div>
        <div style={{ display: "flex", gap: 0, minHeight: 430 }}>
          {/* lecteur */}
          <div style={{ flex: "1 1 0", padding: 20, borderRight: "1px solid var(--wf-line)" }}>
            <div className="wf-ey">Vidéo 2</div>
            <div className="wf-h lg mt4">Le temps africain & le temps organisationnel</div>
            <div className="mt12"><VideoBox h={250} /></div>
            <div className="row between mt8"><span className="wf-meta" style={{ color: O }}>⤺ reprise auto · sync multi-appareils</span><span className="wf-chip" style={{ fontSize: 9 }}>↓ hors-ligne</span></div>
            <div className="wf-card soft mt12" style={{ borderLeft: "3px solid " + G }}><div style={{ fontSize: 11, fontWeight: 700, color: G }}>3 points clés de la session précédente</div><div className="mt6"><Bars n={2} cls="x" /></div></div>
          </div>
          {/* exercice */}
          <div style={{ flex: "0 0 360px", padding: 20 }}>
            <div className="wf-ey" style={{ color: O }}>Micro-exercice — obligatoire</div>
            <div className="wf-h md mt4">Cartographier mes deux types de temps</div>
            <div className="pam-box mt10"><span className="pam-tag">PAM</span> « D'après <span style={{ textDecoration: "underline dashed" }}>la journée décrite au Bloc 0</span>, classez vos activités entre temps polychronique et monochronique. »</div>
            <div className="col gap8 mt10">
              {[["Activité polychronique", "WhatsApp, visites, sollicitations"], ["Activité monochronique", "votre dossier prioritaire"]].map(([l, ex]) => <div key={l} style={{ border: "1.5px solid var(--wf-line)", borderRadius: 8, padding: "9px 11px" }}><div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--wf-ink-2)" }}>{l}</div><div className="wf-meta mt2">{ex}</div></div>)}
            </div>
            <div className="wf-card mt10" style={{ borderLeft: "3px solid " + G, background: "var(--wf-green-t)", padding: 11 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: G }}>Feedback immédiat</div>
              <div className="wf-meta mt4" style={{ fontFamily: "var(--wf-ui)", fontSize: 10.5, lineHeight: 1.45, color: "var(--wf-ink-2)" }}>Analyse de votre répartition + recommandations selon votre profil — affichée avant de continuer.</div>
            </div>
            <div className="row gap10 center mt12"><Btn kind="primary" arrow>Session suivante</Btn><span className="wf-meta">Verrouillé tant que l'exercice n'est pas fait</span></div>
          </div>
        </div>
      </Win>
      <div className="wf-notes">
        <div className="wf-notes__h">Desktop = secondaire</div>
        <Note n={1} lvl="non" cite="§5.1" text="Lecteur à gauche, exercice à droite : la boucle vidéo→exercice reste indissociable." />
        <Note n={2} lvl="non" cite="§4.2" text="Auto-resume + sync multi-appareils : on reprend exactement où on s'était arrêté, même appareil changé." />
        <Note n={3} lvl="non" cite="§9" text="Téléchargement hors-ligne disponible aussi sur desktop." />
      </div>
    </div>
  );

  return (
    <DCSection id="session" title="④ Micro-session : vidéo → exercice → feedback" subtitle="Direction retenue : les deux écrans de la micro-session — liste (autonomie + durée + résumé) puis lecteur→exercice→feedback (auto-resume, PAM) · mobile + desktop">
      <DCArtboard id="a" label="Mobile · liste des sessions" width={616} height={706}>{A}</DCArtboard>
      <DCArtboard id="b" label="Mobile · lecteur → exercice" width={616} height={868}>{B}</DCArtboard>
      <DCArtboard id="d" label="Desktop · lecteur → exercice" width={1160} height={576}>{D}</DCArtboard>
    </DCSection>
  );
}
window.buildSession = buildSession;
