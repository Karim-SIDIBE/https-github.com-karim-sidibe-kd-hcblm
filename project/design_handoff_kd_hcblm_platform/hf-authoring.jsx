// hf-authoring.jsx — Hi-fi Learning Designer authoring back-office (desktop).
// Two artboards: micro-session/exercise editor (with live preview) + Bloc 4 rubric builder.

function AField({ label, val, ph, hint }) {
  return (
    <div>
      <div className="hf-meta" style={{ fontWeight: 700, marginBottom: 5, color: "var(--navy-600)" }}>{label}{hint && <span style={{ fontWeight: 500, color: "var(--fg-3)" }}> · {hint}</span>}</div>
      <div className="hf-field" style={{ fontSize: 13, padding: "10px 12px", minHeight: 0 }}>{val ? <span style={{ color: "var(--fg-1)" }}>{val}</span> : <span className="ph">{ph}</span>}</div>
    </div>
  );
}
function AToken() { return <span className="hf-pill hf-pill--orange hf-pill--sm" style={{ cursor: "pointer" }}>+ {"{{moment_ancrage}}"}</span>; }

function AuthShell({ active, children, right }) {
  const blocks = [["0", "Onboarding & déclencheur", "ok"], ["1", "Comprendre le temps", "edit"], ["2", "Pratiquer & progresser", "ok"], ["3", "Installer des habitudes", "todo"], ["4", "Mini-projet certifiant", "todo"]];
  return (
    <HWin url="admin.declick.kompetences.net/designer/parcours/gestion-du-temps-n1">
      <div className="hf-appbar" style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)" }}>
        <div className="hf-row g14"><HLogo /><span className="hf-pill hf-pill--soft hf-pill--sm">Learning Designer · Éditeur de parcours</span></div>
        <div className="hf-row g10"><span className="hf-pill hf-pill--orange hf-pill--sm">Brouillon</span><HBtn kind="outline" sm>Aperçu apprenant</HBtn><HBtn kind="primary" sm>Publier</HBtn></div>
      </div>
      <div style={{ display: "flex", minHeight: 560 }}>
        {/* left: course meta + block stepper */}
        <div style={{ width: 250, flex: "0 0 250px", borderRight: "1px solid var(--line)", padding: 18 }}>
          <div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 8 }}>Parcours</div>
          <div className="hf-h4">Gestion du temps & productivité</div>
          <div className="hf-row g6 mt8 hf-wrap"><span className="hf-pill hf-pill--sm"><span className="dot" />Niveau 1</span><span className="hf-pill hf-pill--soft hf-pill--sm">Domaine D4</span></div>
          <div className="hf-divider mt16" />
          <div className="hf-eyebrow mt16" style={{ color: "var(--navy-400)", marginBottom: 10 }}>Blocs · 5 requis</div>
          <div className="hf-col g6">
            {blocks.map(([i, n, st]) => (
              <div key={i} className="hf-navitem hf-row g10" style={{ padding: "9px 11px", borderRadius: 10, alignItems: "center", background: st === "edit" ? "var(--orange-50)" : "transparent" }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", flex: "0 0 24px", display: "grid", placeItems: "center", background: st === "ok" ? "var(--brand-declick)" : st === "edit" ? "var(--orange-500)" : "var(--bg-soft)", color: st === "todo" ? "var(--fg-3)" : "#fff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12 }}>{st === "ok" ? <HIco.check style={{ width: 13, height: 13 }} /> : i}</span>
                <span style={{ fontSize: 12.5, fontWeight: st === "edit" ? 800 : 600, color: st === "edit" ? "var(--orange-700)" : "var(--fg-1)", fontFamily: "var(--font-display)", lineHeight: 1.15 }}>Bloc {i} · {n}</span>
              </div>
            ))}
          </div>
          <div className="hf-divider mt16" />
          <div className="hf-meta mt12" style={{ lineHeight: 1.5 }}>Le visuel apprenant est figé. Vous remplissez le contenu ; la plateforme l'agence et applique le modèle KD-HCBLM.</div>
        </div>
        {/* center: form */}
        <div style={{ flex: 1, padding: 22, overflow: "hidden" }}>{children}</div>
        {/* right: live preview */}
        {right}
      </div>
    </HWin>
  );
}

function buildHfAuthoring() {
  // ---------- A · micro-session / exercise editor ----------
  const editor = (
    <AuthShell active="1" right={
      <div style={{ width: 300, flex: "0 0 300px", borderLeft: "1px solid var(--line)", padding: 18, background: "var(--bg-soft)" }}>
        <div className="hf-row hf-between" style={{ alignItems: "center", marginBottom: 12 }}><span className="hf-eyebrow" style={{ color: "var(--navy-400)" }}>Aperçu apprenant</span><span className="hf-pill hf-pill--soft hf-pill--sm">live</span></div>
        <div style={{ border: "7px solid #0b1830", borderRadius: 28, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: 12 }}>
            <div className="hf-row hf-between" style={{ alignItems: "center" }}><span className="hf-pill hf-pill--soft hf-pill--sm">Bloc 1 · 1.1</span><span className="hf-meta" style={{ fontWeight: 700 }}>◷ 20 min</span></div>
            <div className="hf-h4 mt8" style={{ fontSize: 13 }}>Le temps africain & le temps organisationnel</div>
            <div className="hf-media mt8" style={{ height: 92, borderRadius: 10 }}><div className="play" style={{ width: 40, height: 40 }} /><div className="chips"><span className="chip">ST</span></div><div className="scrub"><i style={{ width: "38%" }} /></div></div>
            <div className="hf-card hf-card--stripe-orange hf-card--tight mt10" style={{ boxShadow: "none" }}>
              <div className="hf-eyebrow" style={{ fontSize: 9 }}>Micro-exercice</div>
              <div className="mt6"><HPam>« D'après <em>votre journée décrite au Bloc 0</em>, classez vos activités… »</HPam></div>
            </div>
          </div>
        </div>
        <div className="hf-meta mt12" style={{ lineHeight: 1.5 }}>Reflète en direct les champs de gauche, avec le <b style={{ color: "var(--navy-600)" }}>Moment d'Ancrage</b> injecté.</div>
      </div>
    }>
      <div className="hf-row hf-between" style={{ alignItems: "center" }}>
        <div><div className="hf-eyebrow">Bloc 1 · Composante</div><div className="hf-h2 mt4">Micro-session 1.1</div></div>
        <HBtn kind="outline" sm>+ Ajouter une micro-session</HBtn>
      </div>
      <div className="hf-card mt16">
        <div className="hf-row g12"><div style={{ flex: 2 }}><AField label="Titre de la session" val="Le temps africain & le temps organisationnel" /></div><div style={{ flex: 1 }}><AField label="Durée" val="20 min" /></div><div style={{ width: 90 }}><AField label="N°" val="1.1" /></div></div>
        <div className="mt12"><AField label="3 points clés (résumé d'entrée)" val="Polychronique vs monochronique · zones de temps · −60 % de frustration" hint="affichés à la reprise" /></div>
      </div>
      <div className="hf-card mt12">
        <div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 12 }}>Vidéo</div>
        <div className="hf-row g12"><div style={{ flex: 2 }}><AField label="Titre vidéo" val="Le temps africain & le temps organisationnel" /></div><div style={{ flex: 1 }}><AField label="Fichier / URL" ph="Téléverser ou coller une URL" /></div></div>
        <div className="hf-row g12 mt12"><div style={{ flex: 1 }}><AField label="Message clé" val="Deux conceptions du temps coexistent…" /></div><div style={{ flex: 1 }}><AField label="Exemple africain" val="Aïssatou, ONG santé, Dakar" /></div></div>
      </div>
      <div className="hf-card hf-card--stripe-orange mt12">
        <div className="hf-row hf-between" style={{ alignItems: "center", marginBottom: 12 }}><div className="hf-eyebrow">Exercice associé</div>
          <div className="hf-row g6"><span className="hf-pill hf-pill--orange hf-pill--sm">Choix multiple</span><span className="hf-pill hf-pill--soft hf-pill--sm">Production écrite</span><span className="hf-pill hf-pill--soft hf-pill--sm">Formulaire guidé</span></div>
        </div>
        <div className="hf-row hf-between" style={{ alignItems: "center", marginBottom: 5 }}><div className="hf-meta" style={{ fontWeight: 700, color: "var(--navy-600)" }}>Consigne</div><AToken /></div>
        <div className="hf-field" style={{ fontSize: 13, padding: "10px 12px" }}>« D'après <span style={{ background: "var(--orange-100)", color: "var(--orange-700)", borderRadius: 3, padding: "0 3px", fontStyle: "italic" }}>{"{{moment_ancrage}}"}</span>, classez vos activités entre temps polychronique et monochronique. »</div>
        <div className="hf-row g10 mt12" style={{ alignItems: "stretch" }}>
          <div style={{ flex: 1 }}><AField label="Option A" val="Activité polychronique" /></div>
          <div style={{ flex: 1 }}><AField label="Option B" val="Activité monochronique" /></div>
        </div>
        <div className="hf-row g10 mt12">
          <div style={{ flex: 1 }}><div className="hf-meta" style={{ fontWeight: 700, marginBottom: 5, color: "var(--navy-600)" }}>Réponse correcte</div><div className="hf-row g8"><span className="hf-pill hf-pill--mint hf-pill--sm"><HIco.check style={{ width: 12, height: 12 }} />Les deux valides</span></div></div>
        </div>
        <div className="mt12"><AField label="Feedback (affiché en entier avant de continuer)" val="Analyse de votre répartition + recommandations selon votre profil." /></div>
      </div>
      <div className="hf-card hf-card--mint hf-card--tight mt12 hf-row g10" style={{ alignItems: "center", boxShadow: "none" }}>
        <span className="hf-check"><HIco.check style={{ width: 18, height: 18 }} /></span>
        <div className="hf-body" style={{ fontSize: 12.5 }}><b style={{ color: "#1c7a39" }}>Validation</b> · Moment d'Ancrage réutilisé ✓ · feedback rempli ✓ · durée affichée ✓</div>
      </div>
    </AuthShell>
  );

  // ---------- B · Bloc 4 rubric builder ----------
  const crit = [["Organisation personnelle", "D4.C1", 20], ["Gestion des priorités", "D4.C2", 20], ["Gestion du temps & interruptions", "D4.C3", 20], ["Performance durable + journal", "D4.C4", 15], ["Ancrage culturel africain", "transversal", 10], ["Profondeur de l'apprentissage", "transversal", 15]];
  const rubric = (
    <AuthShell active="4" right={
      <div style={{ width: 300, flex: "0 0 300px", borderLeft: "1px solid var(--line)", padding: 18, background: "var(--bg-soft)" }}>
        <div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 12 }}>Aperçu · grille apprenant</div>
        <div className="hf-card">
          <div className="hf-eyebrow" style={{ color: "var(--navy-400)" }}>Grille · réf. D4 · /100 · seuil 70</div>
          <div className="hf-col g8 mt10">{crit.map(([c, , w]) => <div key={c} className="hf-row hf-between" style={{ alignItems: "baseline", gap: 8 }}><span className="hf-body" style={{ fontSize: 11.5 }}>{c}</span><span className="hf-num" style={{ fontSize: 12, color: "var(--orange-500)" }}>{w}</span></div>)}</div>
        </div>
        <div className="hf-meta mt12" style={{ lineHeight: 1.5 }}>Visible par l'apprenant <b style={{ color: "var(--navy-600)" }}>avant</b> le dépôt, et par l'évaluateur à la notation.</div>
      </div>
    }>
      <div className="hf-row hf-between" style={{ alignItems: "center" }}>
        <div><div className="hf-eyebrow">Bloc 4 · Mini-projet certifiant</div><div className="hf-h2 mt4">Grille d'évaluation</div></div>
        <span className="hf-pill hf-pill--mint hf-pill--sm">Adossée au référentiel D4</span>
      </div>
      <div className="mt16"><AField label="Sujet du projet" val="Identifier le principal problème de gestion du temps dans votre environnement africain réel…" hint="{{moment_ancrage}} injecté" /></div>
      <div className="hf-card mt16">
        <div className="hf-row hf-between" style={{ alignItems: "center", marginBottom: 12 }}><div className="hf-eyebrow" style={{ color: "var(--navy-400)" }}>Critères pondérés</div><HBtn kind="outline" sm>+ Critère</HBtn></div>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr .8fr .5fr", gap: 8, padding: "0 4px 8px", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 800, color: "var(--fg-3)", letterSpacing: ".04em" }}><span>CRITÈRE</span><span>COMPÉTENCE</span><span>POINTS</span></div>
        <div className="hf-col g8">
          {crit.map(([c, code, w]) => (
            <div key={c} style={{ display: "grid", gridTemplateColumns: "1.6fr .8fr .5fr", gap: 8, alignItems: "center" }}>
              <div className="hf-field" style={{ fontSize: 12.5, padding: "9px 11px" }}>{c}</div>
              <div className="hf-field" style={{ fontSize: 12, padding: "9px 11px", color: code === "transversal" ? "var(--fg-3)" : "var(--navy-600)", fontWeight: 700 }}>{code}</div>
              <div className="hf-field" style={{ fontSize: 13, padding: "9px 11px", textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 800 }}>{w}</div>
            </div>
          ))}
        </div>
        <div className="hf-card hf-card--mint hf-card--tight mt12 hf-row hf-between" style={{ alignItems: "center", boxShadow: "none" }}>
          <span className="hf-h4" style={{ fontSize: 13 }}>Total · doit faire 100</span>
          <span className="hf-row g8" style={{ alignItems: "center" }}><span className="hf-num" style={{ fontSize: 20, color: "#1c7a39" }}>100</span><HIco.check style={{ width: 18, height: 18, color: "var(--brand-declick)" }} /></span>
        </div>
      </div>
      <div className="hf-row g12 mt12">
        <div className="hf-card hf-card--tight" style={{ flex: 1 }}><div className="hf-meta" style={{ fontWeight: 700, color: "var(--navy-600)" }}>Seuil de certification</div><div className="hf-h3 mt6">70 / 100 <span className="hf-meta" style={{ fontWeight: 600 }}>(auto · Niveau 1)</span></div></div>
        <div className="hf-card hf-card--tight" style={{ flex: 1 }}><div className="hf-meta" style={{ fontWeight: 700, color: "var(--navy-600)" }}>Évaluation</div><div className="hf-body mt6" style={{ fontSize: 12.5 }}>Humaine · retour 5 j ouvrables</div></div>
      </div>
    </AuthShell>
  );

  return (
    <DCSection id="hf-authoring" title="⑧ Authoring — Learning Designer (hi-fi)" subtitle="Back-office desktop : le designer remplit des champs dédiés par composante ; aperçu live + validation des règles KD-HCBLM · design system Declick">
      <DCArtboard id="editor" label="Éditeur de bloc · micro-session + exercice" width={1320} height={1072}>{editor}</DCArtboard>
      <DCArtboard id="rubric" label="Constructeur de grille · Bloc 4 (réf. D4)" width={1320} height={848}>{rubric}</DCArtboard>
    </DCSection>
  );
}
window.buildHfAuthoring = buildHfAuthoring;
