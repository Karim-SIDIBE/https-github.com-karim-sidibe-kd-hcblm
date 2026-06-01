// wf-authoring.jsx — Wireframe of the Learning Designer authoring back-office (desktop).
function buildAuthoring() {
  const O = "var(--wf-orange)", G = "var(--wf-green)", A = "var(--wf-anno)";
  const blocks = [["0", "Onboarding & déclencheur", "done"], ["1", "Comprendre le temps", "now"], ["2", "Pratiquer", "done"], ["3", "Habitudes", "todo"], ["4", "Mini-projet", "todo"]];
  const fld = (label, val, hint) => (
    <div><div className="wf-meta" style={{ fontWeight: 700, color: "var(--wf-ink-2)", marginBottom: 4 }}>{label}{hint && <span style={{ fontWeight: 400, color: "var(--wf-ink-3)" }}> · {hint}</span>}</div><div className="wf-input" style={{ fontSize: 11, color: val ? "var(--wf-ink)" : "var(--wf-ink-3)" }}>{val || "____________"}</div></div>
  );
  const Editor = (
    <div className="wf" style={{ background: "#f4f6f9" }}>
      <Win url="admin.declick.kompetences.net/designer/parcours/gestion-du-temps-n1">
        <div className="wf-topbar" style={{ padding: "11px 18px" }}>
          <div className="row gap12 center"><Logo /><span className="wf-chip" style={{ fontSize: 9 }}>Learning Designer · Éditeur</span></div>
          <div className="row gap8"><span className="wf-chip" style={{ background: "#fff3e9", color: O, borderColor: "#f6cba3" }}>Brouillon</span><Btn sm>Aperçu</Btn><Btn kind="primary" sm>Publier</Btn></div>
        </div>
        <div style={{ display: "flex", minHeight: 540 }}>
          <div style={{ width: 210, flex: "0 0 210px", borderRight: "1px solid var(--wf-line)", padding: 14 }}>
            <div className="wf-ey" style={{ marginBottom: 6 }}>Parcours</div>
            <div className="wf-h md" style={{ fontSize: 12.5 }}>Gestion du temps · N1</div>
            <div className="row gap4 mt6 wrap"><span className="wf-chip" style={{ fontSize: 8.5 }}>Niveau 1</span><span className="wf-chip" style={{ fontSize: 8.5 }}>Domaine D4</span></div>
            <div className="wf-ey mt14" style={{ marginBottom: 8 }}>Blocs · 5 requis</div>
            <div className="col gap4">
              {blocks.map(([i, n, s]) => (
                <div key={i} className="row gap8 center" style={{ padding: "7px 9px", borderRadius: 7, background: s === "now" ? "#fff3e9" : "transparent" }}>
                  <span className={"node " + (s === "todo" ? "" : s)} style={{ width: 20, height: 20, fontSize: 8 }}>{s === "done" ? <Ico.check style={{ width: 10, height: 10 }} /> : i}</span>
                  <span style={{ fontSize: 10.5, fontWeight: s === "now" ? 700 : 500, color: "var(--wf-ink-2)" }}>Bloc {i} · {n}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, padding: 18 }}>
            <div className="row between center"><div><div className="wf-ey">Bloc 1 · composante</div><div className="wf-h lg mt4">Micro-session 1.1</div></div><Btn sm>+ Micro-session</Btn></div>
            <div className="wf-card mt12"><div className="row gap10">{fld("Titre")}<div style={{ width: 80 }}>{fld("Durée")}</div></div><div className="mt8">{fld("3 points clés (résumé)")}</div></div>
            <div className="wf-card mt10"><div className="wf-ey" style={{ marginBottom: 8 }}>Vidéo</div><div className="row gap10"><div style={{ flex: 1 }}>{fld("Titre / URL")}</div><div style={{ flex: 1 }}>{fld("Message clé")}</div></div></div>
            <div className="wf-card mt10 rel" style={{ borderTop: "3px solid " + O }}>
              <Pin n={1} style={{ top: -8, left: -8 }} />
              <div className="row between center"><div className="wf-ey" style={{ color: O }}>Exercice</div><div className="row gap4"><span className="wf-chip" style={{ fontSize: 8.5, background: "#fff3e9", color: O }}>Choix multiple</span><span className="wf-chip" style={{ fontSize: 8.5 }}>Écrit</span><span className="wf-chip" style={{ fontSize: 8.5 }}>Formulaire</span></div></div>
              <div className="row between center mt8"><span className="wf-meta" style={{ fontWeight: 700 }}>Consigne</span><span className="pam-tag">+ insérer PAM</span></div>
              <div className="wf-input mt4" style={{ fontSize: 10.5 }}>« D'après <span className="pam">{"{{moment_ancrage}}"}</span>, classez vos activités… »</div>
              <div className="row gap8 mt8"><div style={{ flex: 1 }}>{fld("Option A")}</div><div style={{ flex: 1 }}>{fld("Option B")}</div></div>
              <div className="mt8 rel"><Pin n={2} style={{ top: -8, right: -8 }} />{fld("Feedback (affiché en entier)")}</div>
            </div>
            <div className="wf-card mt10 rel" style={{ borderLeft: "3px solid " + G, background: "var(--wf-green-t)", padding: 9 }}><Pin n={3} style={{ top: -8, right: -8 }} /><div style={{ fontSize: 10.5, fontWeight: 700, color: G }}>Validation — PAM réutilisé ✓ · feedback ✓ · durée ✓</div></div>
          </div>
          <div style={{ width: 210, flex: "0 0 210px", borderLeft: "1px solid var(--wf-line)", padding: 14, background: "#fff" }}>
            <div className="wf-ey" style={{ marginBottom: 8 }}>Aperçu apprenant · live</div>
            <div style={{ border: "2px solid var(--wf-ink)", borderRadius: 16, padding: 9 }}>
              <div className="row between center"><span className="wf-chip" style={{ fontSize: 8 }}>B1 · 1.1</span><span className="wf-meta">◷ 20 min</span></div>
              <div className="wf-img cross mt6" style={{ height: 50, borderRadius: 6 }}><div className="wf-img__play" style={{ width: 22, height: 22 }} /></div>
              <div className="pam-box mt6" style={{ padding: 6, fontSize: 8 }}><span className="pam-tag">PAM</span> exercice injecté</div>
            </div>
          </div>
        </div>
      </Win>
      <div className="wf-notes">
        <div className="wf-notes__h">Authoring — Learning Designer</div>
        <Note n={1} lvl="non" cite="§2.3" text="Bouton « insérer PAM » : le designer place {{moment_ancrage}} dans la consigne." />
        <Note n={2} lvl="non" cite="§5.1" text="Chaque exercice exige un feedback explicatif — champ obligatoire." />
        <Note n={3} lvl="crit" cite="Validation" text="La publication est bloquée tant que les règles KD-HCBLM ne sont pas satisfaites." />
      </div>
    </div>
  );
  return (
    <DCSection id="authoring" title="⑧ Authoring — Learning Designer (wireframe)" subtitle="Back-office desktop : champs dédiés par composante, aperçu live, validation des règles · saisie d'un parcours N1/N2/N3 dans le gabarit figé">
      <DCArtboard id="editor" label="Éditeur de bloc · micro-session + exercice" width={1300} height={620}>{Editor}</DCArtboard>
    </DCSection>
  );
}
window.buildAuthoring = buildAuthoring;
