// hf-onboarding.jsx — Hi-fi Block 0 Moment d'Ancrage (mobile + desktop).

function buildHfOnboarding() {
  const steps = [["1", "Moment d'Ancrage", "now"], ["2", "Vidéo + quiz déclencheur", "todo"], ["3", "Profil de gestion du temps", "todo"], ["4", "Pair de progression", "todo"]];

  const M = (
    <HAnnotated notes={[
      "1re interaction du parcours, dans les 5 premières minutes — avant toute vidéo.",
      "Champ ample, compteur, gros bouton : pensé mobile / Android d'entrée de gamme.",
      "Gate obligatoire : impossible d'avancer sans remplir le Moment d'Ancrage.",
    ]}>
      <HPhone>
        <div className="hf-appbar" style={{ padding: "10px 2px" }}><HLogo /><span className="hf-pill hf-pill--soft hf-pill--sm">Étape 1 / 4</span></div>
        <div style={{ padding: "2px 2px 0" }}><HRail state={["now", "todo", "todo", "todo", "todo"]} /></div>
        <div style={{ padding: "16px 2px 0" }}>
          <div className="hf-eyebrow">Bloc 0 · 0.1 — Moment d'Ancrage</div>
          <div className="hf-h1 mt8" style={{ fontSize: 26 }}>En une phrase, décrivez <span className="hf-accent">votre situation</span></div>
          <div className="hf-body mt10">Une journée récente où vous avez travaillé dur mais terminé sans avoir accompli ce qui comptait vraiment. Tout le parcours s'appuiera dessus.</div>
        </div>
        <div className="hf-textwrap mt16">
          <div className="hf-field" style={{ minHeight: 150, lineHeight: 1.5 }}><span className="ph">Ex. : « Mardi : 11 h au bureau à répondre au WhatsApp et aux urgences de mon manager — et mon dossier prioritaire n'a pas avancé. »</span></div>
          <span className="hf-count">min. 50 car.</span>
        </div>
        <div className="mt16"><HBtn kind="primary" block arrow>Continuer</HBtn></div>
        <div className="hf-meta hf-tc mt10">Obligatoire — vous ne pouvez pas passer cette étape.</div>
      </HPhone>
    </HAnnotated>
  );

  const D = (
    <div className="hf">
      <HWin url="app.declick.kompetences.net/cours/gestion-du-temps-n1/bloc-0">
        <div className="hf-appbar" style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
          <div className="hf-row g16"><HLogo /><HMember /></div>
          <span className="hf-pill hf-pill--soft hf-pill--sm">Bloc 0 · Étape 1 / 4</span>
        </div>
        <div style={{ padding: "22px 28px 28px" }}>
          <div style={{ maxWidth: 360 }}><HRail state={["now", "todo", "todo", "todo", "todo"]} /></div>
          <div style={{ display: "flex", gap: 32, marginTop: 24, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div className="hf-eyebrow">Bloc 0 · 0.1 — Moment d'Ancrage</div>
              <div className="hf-h1 mt8" style={{ maxWidth: 540 }}>En une phrase, décrivez <span className="hf-accent">votre situation</span></div>
              <div className="hf-body mt10" style={{ maxWidth: 540, fontSize: 15 }}>Une journée récente où vous avez travaillé dur mais terminé sans avoir accompli ce qui comptait vraiment. Tout le parcours s'appuiera dessus.</div>
              <div className="hf-textwrap mt16" style={{ maxWidth: 540 }}>
                <div className="hf-field" style={{ minHeight: 140, lineHeight: 1.5 }}><span className="ph">Ex. : « Mardi : 11 h au bureau à répondre au WhatsApp et aux urgences de mon manager — et mon dossier prioritaire n'a pas avancé. »</span></div>
                <span className="hf-count">min. 50 car.</span>
              </div>
              <div className="hf-row g16 mt16" style={{ alignItems: "center" }}><HBtn kind="primary" arrow>Continuer</HBtn><span className="hf-meta">Obligatoire — impossible de passer cette étape</span></div>
            </div>
            <div style={{ flex: "0 0 280px" }}>
              <div className="hf-card hf-card--icy">
                <div className="hf-eyebrow" style={{ color: "var(--navy-500)" }}>Ce que vous allez débloquer</div>
                <div className="hf-col g10 mt12">
                  {steps.map(([i, t, s]) => (
                    <div key={i} className="hf-row g10" style={{ alignItems: "center" }}>
                      <span style={{ width: 26, height: 26, borderRadius: "50%", flex: "0 0 26px", display: "grid", placeItems: "center", background: s === "now" ? "var(--orange-500)" : "#fff", color: s === "now" ? "#fff" : "var(--navy-400)", border: s === "now" ? "none" : "1.5px solid var(--line-strong)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12 }}>{i}</span>
                      <span style={{ fontSize: 13, fontWeight: s === "now" ? 800 : 600, color: "var(--navy-700)", fontFamily: "var(--font-display)" }}>{t}</span>
                    </div>
                  ))}
                </div>
                <div className="hf-card hf-tc mt14" style={{ padding: 14, border: "1.5px dashed var(--line-strong)", boxShadow: "none" }}>
                  <div style={{ display: "grid", placeItems: "center" }}><HMedal label="Entrée" /></div>
                  <div className="hf-h4 mt8" style={{ fontSize: 13 }}>Badge Entrée</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </HWin>
      <div className="hf-notes">
        <div className="hf-notes__h">Desktop = secondaire</div>
        <HNote n={1} t="Même gate qu'en mobile : le Moment d'Ancrage est la 1re interaction, obligatoire." />
        <HNote n={2} t="Le mobile reste le cas primaire ; le desktop n'ajoute aucune étape." />
        <HNote n={3} t="Le panneau latéral montre les 4 étapes du Bloc 0 → Badge Entrée." />
      </div>
    </div>
  );

  return (
    <DCSection id="hf-onboarding" title="③ Block 0 — Moment d'Ancrage — hi-fi" subtitle="Wizard linéaire · design system Declick · mobile + desktop">
      <DCArtboard id="m" label="Mobile · Moment d'Ancrage" width={644} height={760}>{M}</DCArtboard>
      <DCArtboard id="d" label="Desktop · Moment d'Ancrage" width={1228} height={640}>{D}</DCArtboard>
    </DCSection>
  );
}
window.buildHfOnboarding = buildHfOnboarding;
