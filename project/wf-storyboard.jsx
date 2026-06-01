// wf-storyboard.jsx — full KD-HCBLM v2.0 learner journey as a linear strip.
// Exports buildStoryboard() -> <DCSection> with one wide artboard.

function MiniPhone({ step, block, name, mech, children, accent }) {
  return (
    <div style={{ width: 156, flex: "0 0 156px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        border: "2px solid var(--wf-ink)", borderRadius: 20, background: "#fff",
        overflow: "hidden", height: 280, position: "relative", boxShadow: "0 2px 0 var(--wf-line-2)",
      }}>
        <div style={{ height: 18, borderBottom: "1px dashed var(--wf-line)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 9px" }}>
          <span style={{ fontFamily: "var(--wf-mono)", fontSize: 7, color: "var(--wf-ink-3)" }}>9:41</span>
          <span style={{ fontFamily: "var(--wf-mono)", fontSize: 7, color: "var(--wf-ink-3)" }}>4G</span>
        </div>
        <div style={{ padding: 9, display: "flex", flexDirection: "column", gap: 7 }}>{children}</div>
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontFamily: "var(--wf-mono)", fontSize: 8.5, fontWeight: 600, color: "#fff", background: accent || "var(--wf-ink-2)", borderRadius: 4, padding: "1px 5px" }}>{step}</span>
          <span style={{ fontFamily: "var(--wf-mono)", fontSize: 8.5, color: "var(--wf-ink-3)", letterSpacing: ".04em" }}>{block}</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--wf-ink)", marginTop: 3, lineHeight: 1.15 }}>{name}</div>
        <div style={{ fontFamily: "var(--wf-hand)", fontSize: 13.5, color: "var(--wf-anno)", lineHeight: 1.15, marginTop: 5 }}>{mech}</div>
      </div>
    </div>
  );
}
function Conn() {
  return (
    <div style={{ flex: "0 0 26px", alignSelf: "flex-start", marginTop: 130, color: "var(--wf-line-2)", display: "flex", justifyContent: "center" }}>
      <Ico.arrow style={{ width: 20, height: 20 }} />
    </div>
  );
}
// tiny atoms scaled for the mini frames
const mb = (w) => <div className="wf-bar" style={{ width: w }} />;
const mt = (txt, c) => <div style={{ fontWeight: 700, fontSize: 10.5, lineHeight: 1.15, color: c || "var(--wf-ink)" }}>{txt}</div>;

function buildStoryboard() {
  const G = "var(--wf-green)", O = "var(--wf-orange)", A = "var(--wf-anno)";
  const screens = [
    <MiniPhone step="01" block="BLOC 0 · 0.1" name="Moment d'Ancrage" mech="1er écran. 1 phrase. Gate." accent={O}>
      {mt("En une phrase…")}
      <div className="wf-textarea" style={{ height: 92, fontSize: 8 }}>Décrivez une journée récente où vous avez travaillé dur sans accomplir l'essentiel…</div>
      <Btn kind="primary" sm block>Continuer</Btn>
    </MiniPhone>,
    <MiniPhone step="02" block="BLOC 0 · 0.2" name="Vidéo déclencheur + quiz" mech="« Occupé ou productif ? »" accent={O}>
      <div className="wf-img cross" style={{ height: 44, borderRadius: 6 }}><div className="wf-img__play" style={{ width: 22, height: 22 }} /><span className="wf-img__lab wf-meta" style={{ fontSize: 7 }}>◷ 10 min · ST</span></div>
      <div style={{ fontFamily: "var(--wf-mono)", fontSize: 7, color: O }}>Quiz déclencheur · 5 Q · non noté</div>
      {["A", "B"].map((l) => <div key={l} style={{ border: "1px solid var(--wf-line)", borderRadius: 6, padding: "4px 7px", fontSize: 8, color: "var(--wf-ink-2)" }}>{l}. ____________</div>)}
    </MiniPhone>,
    <MiniPhone step="03" block="BLOC 0 · 0.2" name="Profil de gestion du temps" mech="4 profils, pas un score" accent={O}>
      <div className="wf-card soft" style={{ padding: 7, textAlign: "center" }}><div style={{ fontSize: 11, fontWeight: 800, color: O }}>Réactif conscient</div><div style={{ fontSize: 7.5, color: "var(--wf-ink-3)", marginTop: 2 }}>profil généré · recommandations adaptées</div></div>
      {mb("90%")}{mb("70%")}
    </MiniPhone>,
    <MiniPhone step="04" block="BLOC 0 · 0.1" name="Pair de progression" mech="Désigné au Bloc 0" accent={O}>
      {mt("Qui sera votre pair ?")}
      <div className="wf-input" style={{ fontSize: 8 }}>Nom · collègue, mentor, manager</div>
      <div className="wf-input" style={{ fontSize: 8 }}>Email ou WhatsApp</div>
      <div style={{ fontFamily: "var(--wf-hand)", fontSize: 12, color: A }}>→ notifié à chaque badge</div>
    </MiniPhone>,
    <MiniPhone step="05" block="BADGE" name="Badge Entrée" mech="< 60 s · ancré au Moment d'Ancrage" accent={G}>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}><Medal kind="earned" label="ENTRÉE" /></div>
      <div style={{ textAlign: "center" }}>{mt("Badge débloqué !", G)}</div>
      <Btn kind="ghost" sm block>Partager sur LinkedIn</Btn>
    </MiniPhone>,
    <MiniPhone step="06" block="BLOC 1 · 1.0" name="Quiz diagnostique" mech="10 Q situationnelles · AVANT les vidéos" accent={G}>
      <div className="wf-card soft" style={{ padding: 7 }}><div style={{ fontSize: 8, color: "var(--wf-ink-2)", lineHeight: 1.3 }}>« Votre manager écrit à 16h45 : rapport pour demain 8h. Vous faites… »</div></div>
      {["A", "B", "C", "D"].map((l) => <div key={l} style={{ border: "1px solid var(--wf-line)", borderRadius: 6, padding: "4px 7px", fontSize: 8, color: "var(--wf-ink-2)" }}>{l}. ________</div>)}
    </MiniPhone>,
    <MiniPhone step="07" block="BLOC 1 · 1.1" name="Vidéo → micro-exercice" mech="Auto-resume · feedback immédiat" accent={G}>
      <div className="wf-img cross" style={{ height: 48, borderRadius: 6 }}><div className="wf-img__play" style={{ width: 22, height: 22 }} /></div>
      <div style={{ fontSize: 8, fontWeight: 700, lineHeight: 1.15 }}>Le temps africain & le temps organisationnel</div>
      <div style={{ fontFamily: "var(--wf-mono)", fontSize: 7, color: "var(--wf-ink-3)" }}>⤺ reprise auto · ◷ 6 min · ST</div>
      <div className="pam-box" style={{ padding: 6, fontSize: 8 }}><span className="pam-tag">PAM</span> Exercice ancré sur <span className="pam">votre journée décrite</span></div>
    </MiniPhone>,
    <MiniPhone step="08" block="RELANCE" name="Relance J+7" mech="Reconnexion au Moment d'Ancrage" accent={A}>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}><Ico.bell style={{ width: 12, height: 12, color: A }} />{mt("Message J+7")}</div>
      <div className="pam-box" style={{ padding: 6, fontSize: 8 }}>« La situation que vous avez décrite <span className="pam">mérite ces outils</span>. Reprenez quand vous avez 15 min. »</div>
      <Btn kind="primary" sm block>Reprendre</Btn>
    </MiniPhone>,
    <MiniPhone step="09" block="BLOC 2 · 2.5" name="Application terrain" mech="Soumise · obligatoire pour le Bloc 3" accent={G}>
      {mt("Reprendre le contrôle")}
      <div style={{ fontSize: 8, color: "var(--wf-ink-2)" }}>Dire non · planifier · déléguer — dans votre organisation réelle.</div>
      <div className="wf-textarea" style={{ height: 32, fontSize: 8 }} />
      <span className="wf-chip" style={{ fontSize: 7.5, background: "var(--wf-green-t)", color: G, borderColor: "#b5e3c2" }}>Badge Pratique</span>
    </MiniPhone>,
    <MiniPhone step="10" block="BLOC 3 · 3.4" name="Quiz final + plan 30 j" mech="Noté · seuil 70 %" accent={G}>
      <div className="wf-card soft" style={{ padding: 7, textAlign: "center" }}><div style={{ fontFamily: "var(--wf-mono)", fontSize: 18, fontWeight: 600, color: G }}>75%</div><div style={{ fontSize: 7.5, color: "var(--wf-ink-3)" }}>seuil 70 % ✓ · Badge Ancrage</div></div>
      {mt("Plan d'action 30 jours")}
      <div className="wf-textarea" style={{ height: 26, fontSize: 8 }} />
    </MiniPhone>,
    <MiniPhone step="11" block="BLOC 4" name="Mini-projet + journal" mech="6 micro-entrées J+1…J+14" accent={O}>
      <div className="pam-box" style={{ padding: 6, fontSize: 8 }}>Projet ancré sur <span className="pam">votre situation</span> · 14 jours</div>
      <div className="wf-card" style={{ padding: 6 }}><div style={{ fontSize: 7.5, color: "var(--wf-ink-2)" }}>Journal J+1 · J+3 · J+5 · J+7 · J+10 · J+14</div></div>
      <Btn kind="primary" sm block>Soumettre</Btn>
    </MiniPhone>,
    <MiniPhone step="12" block="CERTIF" name="Certificat Niveau 1" mech="Évalué ≥ 70/100 · vérifiable" accent={O}>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}><Medal kind="cert" label="NIVEAU 1" /></div>
      <div style={{ textAlign: "center" }}>{mt("Certifié !", O)}</div>
      <Btn kind="go" sm block>Ajouter à LinkedIn</Btn>
    </MiniPhone>,
  ];
  return (
    <DCSection id="storyboard" title="① Parcours complet — storyboard" subtitle="« Gestion du temps & productivité en environnements professionnels africains » · Niveau 1 · 23 micro-sessions · les notes manuscrites pointent le mécanisme KD-HCBLM de chaque écran">
      <DCArtboard id="journey" label="Parcours apprenant — Block 0 → Certificat" width={2240} height={400}>
        <div className="wf" style={{ background: "#f4f6f9", padding: "26px 26px", alignItems: "flex-start", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
            {screens.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <Conn />}
                {s}
              </React.Fragment>
            ))}
          </div>
        </div>
      </DCArtboard>
    </DCSection>
  );
}
window.buildStoryboard = buildStoryboard;
