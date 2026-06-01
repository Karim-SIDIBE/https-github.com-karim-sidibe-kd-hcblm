// hf-session.jsx — Hi-fi micro-session: list + player→exercise loop (mobile + desktop).

function HExerciseCard({ compact }) {
  return (
    <div className="hf-card hf-card--stripe-orange">
      <div className="hf-eyebrow">Micro-exercice — obligatoire</div>
      <div className="hf-h3 mt6" style={{ fontSize: 16 }}>Cartographier mes deux types de temps</div>
      <div className="mt10"><HPam>« D'après <em>la journée que vous avez décrite au Bloc 0</em>, classez vos activités entre temps polychronique et monochronique. »</HPam></div>
      <div className="hf-col g8 mt12">
        {[["Activité polychronique", "WhatsApp, visites, sollicitations"], ["Activité monochronique", "votre dossier prioritaire"]].map(([l, ex]) => (
          <div key={l} className="hf-card hf-card--tight" style={{ boxShadow: "none", padding: "11px 13px" }}><div className="hf-h4" style={{ fontSize: 12.5 }}>{l}</div><div className="hf-meta mt2">{ex}</div></div>
        ))}
      </div>
      <div className="hf-card hf-card--mint hf-card--tight mt12" style={{ boxShadow: "none" }}>
        <div className="hf-h4" style={{ fontSize: 12.5, color: "#1c7a39" }}>Feedback immédiat</div>
        <div className="hf-body mt4" style={{ fontSize: 12.5 }}>Analyse de votre répartition + recommandations selon votre profil de gestion du temps — affichée avant de continuer.</div>
      </div>
    </div>
  );
}

function buildHfSession() {
  const sessions = [
    ["1.0", "Quiz diagnostique (10 Q · avant les vidéos)", "15 min", "done"],
    ["1.1", "Le temps africain & le temps organisationnel", "20 min", "now"],
    ["1.2", "La matrice des priorités africaine", "20 min", "todo"],
    ["1.3", "La culture de l'urgence africaine", "20 min", "todo"],
    ["1.4", "Gérer les interruptions", "20 min", "todo"],
  ];

  // ---- mobile list ----
  const List = (
    <HAnnotated notes={[
      "Sessions autonomes : pas d'ordre imposé dans le bloc (gating au niveau bloc).",
      "Résumé « 3 points clés » à l'entrée de chaque session après la 1re.",
      "Durée affichée sur chaque carte, avant le lancement — moteur de démarrage.",
    ]}>
      <HPhone tab="book">
        <div className="hf-appbar" style={{ padding: "10px 2px" }}><HLogo /><span className="hf-pill hf-pill--soft hf-pill--sm">Bloc 1 / 5</span></div>
        <div style={{ padding: "8px 2px 0" }}>
          <div className="hf-eyebrow">Bloc 1 — Comprendre les dynamiques du temps</div>
          <div className="hf-h1 mt6" style={{ fontSize: 24 }}>6 micro-sessions</div>
          <div className="hf-meta mt6">Faites-les dans l'ordre que vous voulez.</div>
        </div>
        <div className="hf-card hf-card--mint mt14" style={{ borderLeft: "4px solid var(--brand-declick)" }}>
          <div className="hf-h4" style={{ fontSize: 12.5, color: "#1c7a39" }}>3 points clés de votre dernière session</div>
          <div className="hf-body mt6" style={{ fontSize: 12.5 }}>Polychronique vs monochronique · zones de temps · 60 % de frustration en moins.</div>
        </div>
        <div className="hf-col g10 mt14">
          {sessions.map(([i, t, d, s]) => (
            <div key={i} className="hf-card hf-card--tight hf-row g12" style={{ alignItems: "center" }}>
              <div style={{ width: 52, height: 40, borderRadius: 10, flex: "0 0 52px", display: "grid", placeItems: "center", background: s === "done" ? "var(--brand-declick-tint)" : "var(--navy-50)", color: s === "done" ? "var(--brand-declick)" : "var(--navy-300)" }}>{s === "done" ? <HIco.check style={{ width: 18, height: 18 }} /> : <HIco.book style={{ width: 16, height: 16 }} />}</div>
              <div className="hf-grow"><div className="hf-h4" style={{ fontSize: 13, lineHeight: 1.2 }}>{t}</div><div className="hf-row g8 mt6" style={{ alignItems: "center" }}><span className="hf-pill hf-pill--orange hf-pill--sm">◷ {d}</span>{s === "done" && <span className="hf-meta hf-check" style={{ fontWeight: 700 }}>Terminée</span>}</div></div>
              {s === "now" ? <HBtn sm kind="primary">Reprendre</HBtn> : (s === "todo" ? <HBtn sm kind="outline">Démarrer</HBtn> : null)}
            </div>
          ))}
        </div>
      </HPhone>
    </HAnnotated>
  );

  // ---- mobile loop ----
  const Loop = (
    <HAnnotated notes={[
      "Auto-resume à la position exacte (±5 s), serveur, multi-appareils + hors-ligne.",
      "Chaque vidéo est suivie d'un exercice — Moment d'Ancrage injecté dans la consigne.",
      "Feedback explicatif complet, affiché avant de pouvoir avancer.",
    ]}>
      <HPhone tab="book">
        <div className="hf-row hf-between mt4" style={{ alignItems: "center" }}><span className="hf-pill hf-pill--soft hf-pill--sm">Bloc 1 · 1.1</span><span className="hf-meta" style={{ fontWeight: 700 }}>◷ 20 min</span></div>
        <div className="hf-h3 mt8">Le temps africain & le temps organisationnel</div>
        <div className="hf-card hf-card--mint hf-card--tight mt10" style={{ boxShadow: "none", borderLeft: "4px solid var(--brand-declick)" }}><div className="hf-h4" style={{ fontSize: 12, color: "#1c7a39" }}>Résumé · 3 points clés précédents</div></div>
        <div className="mt12"><HMedia h={172} /></div>
        <div className="hf-meta mt8" style={{ color: "var(--orange-700)" }}>↺ Reprise auto à 03:48 · sync multi-appareils · ↓ hors-ligne</div>
        <div className="mt14"><HExerciseCard /></div>
        <div className="mt14"><HBtn kind="primary" block arrow>Session suivante</HBtn></div>
        <div className="hf-meta hf-tc mt8">Verrouillé tant que l'exercice n'est pas complété.</div>
      </HPhone>
    </HAnnotated>
  );

  // ---- desktop loop ----
  const D = (
    <div className="hf">
      <HWin url="app.declick.kompetences.net/cours/gestion-du-temps-n1/1.1">
        <div className="hf-appbar" style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
          <div className="hf-row g16"><HLogo /><span className="hf-pill hf-pill--soft hf-pill--sm">Bloc 1 · Micro-session 1.1</span></div>
          <span className="hf-meta" style={{ fontWeight: 700 }}>◷ 20 min · ↺ reprise auto 03:48</span>
        </div>
        <div style={{ display: "flex", minHeight: 500 }}>
          <div style={{ flex: "1 1 0", padding: 24, borderRight: "1px solid var(--line)" }}>
            <div className="hf-eyebrow">Vidéo 2</div>
            <div className="hf-h2 mt6">Le temps africain & le temps organisationnel</div>
            <div className="mt16"><HMedia h={280} /></div>
            <div className="hf-row hf-between mt10"><span className="hf-meta" style={{ color: "var(--orange-700)" }}>↺ reprise auto · sync multi-appareils</span><span className="hf-pill hf-pill--soft hf-pill--sm"><HIco.download style={{ width: 13, height: 13 }} />hors-ligne</span></div>
            <div className="hf-card hf-card--mint hf-card--tight mt16" style={{ boxShadow: "none", borderLeft: "4px solid var(--brand-declick)" }}><div className="hf-h4" style={{ fontSize: 12.5, color: "#1c7a39" }}>3 points clés de la session précédente</div><div className="hf-body mt4" style={{ fontSize: 12.5 }}>Zones différenciées · porte fermée 8h–10h30 · disponibilité l'après-midi.</div></div>
          </div>
          <div style={{ flex: "0 0 384px", padding: 24 }}><HExerciseCard /><div className="hf-row g14 mt14" style={{ alignItems: "center" }}><HBtn kind="primary" arrow>Session suivante</HBtn><span className="hf-meta">Verrouillé tant que l'exercice n'est pas fait</span></div></div>
        </div>
      </HWin>
      <div className="hf-notes">
        <div className="hf-notes__h">Desktop = secondaire</div>
        <HNote n={1} t="Lecteur à gauche, exercice à droite : la boucle vidéo→exercice reste indissociable." />
        <HNote n={2} t="Auto-resume + sync multi-appareils : on reprend exactement où on s'était arrêté." />
        <HNote n={3} t="Téléchargement hors-ligne disponible aussi sur desktop." />
      </div>
    </div>
  );

  return (
    <DCSection id="hf-session" title="④ Micro-session — hi-fi" subtitle="Les deux écrans de la micro-session (liste + lecteur→exercice→feedback) · design system Declick · mobile + desktop">
      <DCArtboard id="list" label="Mobile · liste des sessions" width={644} height={1060}>{List}</DCArtboard>
      <DCArtboard id="loop" label="Mobile · lecteur → exercice" width={644} height={1192}>{Loop}</DCArtboard>
      <DCArtboard id="d" label="Desktop · lecteur → exercice" width={1228} height={760}>{D}</DCArtboard>
    </DCSection>
  );
}
window.buildHfSession = buildHfSession;
