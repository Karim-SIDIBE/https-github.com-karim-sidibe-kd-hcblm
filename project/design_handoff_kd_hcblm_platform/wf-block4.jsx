// wf-block4.jsx — Block 4 certification project lifecycle (in-platform).
// Learner brief+submit (mobile) · evaluator rubric scoring (desktop) · certificate.

function buildBlock4() {
  const O = "var(--wf-orange)", G = "var(--wf-green)", A = "var(--wf-anno)";

  // ---------- Learner: gate → brief → submit (mobile) ----------
  const Learner = (
    <Annotated notesTitle="Côté apprenant">
      <Phone tab={0}>
        <div className="rel" style={{ paddingTop: 4 }}>
          <Pin n={1} style={{ position: "absolute", top: -2, right: -4 }} />
          <div className="wf-ey">Bloc 4 · Mini-projet certifiant</div>
          <div className="wf-h lg mt4">Votre livrable certifiant</div>
        </div>
        <div className="wf-card soft row gap8 center mt8" style={{ padding: "8px 10px" }}>
          <Ico.check style={{ width: 15, height: 15, color: G }} />
          <div className="wf-meta" style={{ color: "var(--wf-ink-2)" }}>Débloqué : quiz final Bloc 3 réussi à <b>75 %</b> (seuil 70 % · Niveau 1)</div>
        </div>
        <div className="pam-box mt10 rel">
          <Pin n={2} style={{ top: -8, left: -8 }} />
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Sujet du mini-projet</div>
          « Identifier le principal problème de gestion du temps dans <span className="pam">votre environnement africain réel</span>, mettre en œuvre une solution adaptée à vos codes culturels, et documenter l'impact sur 14 jours. »
        </div>
        <div className="row gap6 mt8"><span className="wf-chip member" style={{ fontSize: 8.5 }}><span className="dot" />Domaine D4 · Productivité & organisation</span><span className="wf-chip" style={{ fontSize: 8.5 }}>N1 — Fondamentaux</span></div>
        <div className="wf-card mt10 rel">
          <Pin n={3} style={{ top: -8, right: -8 }} />
          <div className="wf-ey" style={{ marginBottom: 2 }}>Grille · réf. D4 · /100 · seuil 70</div>
          <div className="col gap8 mt8">
            {[["Organisation personnelle (D4.C1)", "20"], ["Gestion des priorités (D4.C2)", "20"], ["Gestion du temps & interruptions (D4.C3)", "20"], ["Performance durable + journal (D4.C4)", "15"], ["Ancrage culturel africain (transversal)", "10"], ["Profondeur de l'apprentissage (transversal)", "15"]].map(([c, w]) => (
              <div key={c} className="row between" style={{ alignItems: "baseline", gap: 10, fontSize: 10.5, color: "var(--wf-ink-2)", lineHeight: 1.25 }}><span style={{ flex: "1 1 auto" }}>{c}</span><span className="wf-meta" style={{ color: O, fontWeight: 600, flex: "0 0 auto" }}>{w} pts</span></div>
            ))}
          </div>
        </div>
        <div className="wf-card dash tc mt10" style={{ padding: 14 }}>
          <div className="wf-meta">Déposer un fichier ou rédiger en ligne</div>
          <div className="mt8"><Btn kind="primary" block arrow>Soumettre mon projet</Btn></div>
        </div>
      </Phone>
      {[
        { n: 1, lvl: "non", cite: "§6.3", text: "Bloc 4 verrouillé tant que le quiz final Bloc 3 n'atteint pas le seuil (70 % en Niveau 1)." },
        { n: 2, lvl: "non", cite: "§2.3 · §6.3", text: "La Section 1 est pré-remplie avec le Moment d'Ancrage du Bloc 0." },
        { n: 3, lvl: "crit", cite: "§6.3", text: "La grille (5 critères pondérés, /100) est visible AVANT le dépôt." },
      ].map((x) => <Note key={x.n} {...x} />)}
    </Annotated>
  );

  // ---------- Evaluator: rubric scoring (desktop) ----------
  const crit = [
    ["Organisation personnelle (D4.C1)", 20, 16],
    ["Gestion des priorités (D4.C2)", 20, 15],
    ["Gestion du temps & interruptions (D4.C3)", 20, 16],
    ["Performance durable + journal (D4.C4)", 15, 12],
    ["Ancrage culturel africain (transversal)", 10, 8],
    ["Profondeur de l'apprentissage (transversal)", 15, 11],
  ];
  const Eval = (
    <div className="wf" style={{ background: "#f4f6f9" }}>
      <Win url="app.declick.kompetences.net/admin/evaluation/PRJ-1042">
        <div className="wf-topbar" style={{ padding: "12px 20px" }}>
          <div className="row gap12 center"><Logo /><span className="wf-chip" style={{ fontSize: 9.5 }}>Espace évaluateur</span></div>
          <span className="wf-chip" style={{ fontSize: 9.5, background: "#fbf2e2", color: "var(--lvl-crit)", borderColor: "#ecd4a6" }}><Ico.clock style={{ width: 11, height: 11 }} />Retour sous 5 j ouvrables · alerte admin si non noté</span>
        </div>
        <div style={{ display: "flex", minHeight: 440 }}>
          {/* submission */}
          <div style={{ flex: "1 1 0", padding: 20, borderRight: "1px solid var(--wf-line)" }}>
            <div className="wf-ey">Projet soumis · PRJ-1042</div>
            <div className="wf-h lg mt4">Aminata D. — Niveau 1</div>
            <div className="row gap8 mt8"><span className="wf-chip">Soumis le 14/03</span><span className="wf-chip">Gestion du temps</span></div>
            <div className="pam-box mt12" style={{ fontSize: 11 }}><span className="pam-tag">PAM</span> Ancré sur : <span className="pam">dossier prioritaire qui n'avance jamais</span></div>
            <div className="wf-card mt12" style={{ padding: 14 }}>
              <div className="wf-meta">Livrable — 5 sections + journal 6 entrées</div>
              <div className="mt8"><Bars n={6} /></div>
              <div className="mt8 row gap8"><span className="wf-chip">projet.pdf</span><span className="wf-chip">journal (6/6)</span></div>
            </div>
          </div>
          {/* rubric */}
          <div style={{ flex: "0 0 320px", padding: 20 }} className="rel">
            <span className="wf-pin abs" style={{ top: 12, left: -10 }}>1</span>
            <div className="wf-ey">Notation par critère · réf. D4 · / 100</div>
            <div className="col gap8 mt10">
              {crit.map(([c, w, sc]) => (
                <div key={c} className="wf-card" style={{ padding: 9 }}>
                  <div className="row between center"><span style={{ fontSize: 10.5, fontWeight: 700, flex: "1 1 auto", lineHeight: 1.2 }}>{c}</span><span className="wf-meta" style={{ color: O, flex: "0 0 auto", marginLeft: 6 }}>{sc}/{w}</span></div>
                  <div className="mt6"><div className="wf-prog"><i style={{ width: (sc / w * 100) + "%", background: G }} /></div></div>
                </div>
              ))}
            </div>
            <div className="wf-card soft row between center mt10 rel" style={{ padding: "10px 12px" }}>
              <span className="wf-pin abs" style={{ top: -8, right: -8 }}>2</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>Total · seuil 70</span><span style={{ fontFamily: "var(--wf-mono)", fontSize: 18, fontWeight: 600, color: G }}>78 / 100</span>
            </div>
            <div className="wf-ta-wrap mt10"><div className="wf-textarea" style={{ height: 50, fontSize: 11 }}>Feedback écrit structuré…</div></div>
            <div className="row gap8 mt10"><Btn kind="go" sm>Valider · Certifier</Btn><Btn sm>Demander révision</Btn></div>
          </div>
        </div>
      </Win>
      <div className="wf-notes">
        <div className="wf-notes__h">Côté évaluateur</div>
        <Note n={1} lvl="crit" cite="§6.3 · réf. D4" text="6 critères adossés au référentiel KOMPETENCES AFRICA (D4.C1–C4 + 2 transversaux), notés séparément ; total /100 auto." />
        <Note n={2} lvl="non" cite="§6.3 · Failure 6" text="Tout le cycle (dépôt, affectation, notation, feedback, résultat) dans la plateforme — jamais par email." />
        <Note n={3} lvl="non" cite="§6.3" text="Validation humaine par un évaluateur KOMPETENCES DECLICK · retour sous 5 jours ouvrables." />
      </div>
    </div>
  );

  // ---------- Certificate + verification (mobile) ----------
  const Cert = (
    <Annotated notesTitle="Certificat & vérification">
      <Phone>
        <div className="tc" style={{ paddingTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "center" }} className="rel"><Medal kind="cert" label="NIVEAU 1" /><span className="wf-pin abs" style={{ top: -6, right: 70 }}>1</span></div>
          <div className="wf-h lg mt10">Certificat de Niveau 1 obtenu</div>
          <div className="wf-sub mt6" style={{ fontSize: 11.5 }}>Gestion du Temps & Productivité en Environnements Professionnels Africains · délivré par Kompetences Declick</div>
        </div>
        <div className="wf-card mt12 rel" style={{ padding: 14 }}>
          <Pin n={2} style={{ top: -8, right: -8 }} />
          <div className="wf-meta">Conforme Open Badges 2.0</div>
          <div className="mt8"><Btn kind="go" block>Ajouter à LinkedIn</Btn></div>
        </div>
        <div className="wf-card soft mt10 rel" style={{ padding: 12 }}>
          <Pin n={3} style={{ top: -8, left: -8 }} />
          <div className="wf-meta">Vérification employeur · URL publique</div>
          <div className="wf-input mt8" style={{ fontFamily: "var(--wf-mono)", fontSize: 9.5, color: "var(--wf-ink-3)" }}>verify.declick.kompetences.net/c/8F2A-…</div>
          <div className="wf-meta mt6" style={{ color: "var(--wf-ink-3)" }}>Vérifiable sans compte ni action de l'apprenant.</div>
        </div>
      </Phone>
      {[
        { n: 1, lvl: "non", cite: "§7.6", text: "Certificat émis < 60 s après validation de l'évaluateur (score ≥ 70/100)." },
        { n: 2, lvl: "non", cite: "§7.6", text: "Open Badges 2.0 + import LinkedIn en un tap." },
        { n: 3, lvl: "crit", cite: "§7.6", text: "Vérification employeur via URL/API publique, sans accès plateforme." },
      ].map((x) => <Note key={x.n} {...x} />)}
    </Annotated>
  );

  // ---------- Desktop adaptation (certificat) ----------
  const Cdesk = (
    <div className="wf" style={{ background: "#f4f6f9" }}>
      <Win url="app.declick.kompetences.net/cours/gestion-du-temps-n1/certificat">
        <div className="wf-topbar" style={{ padding: "12px 20px" }}>
          <div className="row gap12 center"><Logo /><span className="wf-chip" style={{ fontSize: 9.5 }}>Certificat obtenu</span></div>
          <span className="wf-chip" style={{ fontSize: 9.5, background: "var(--wf-green-t)", color: G, borderColor: "#b5e3c2" }}>Validé · 78 / 100</span>
        </div>
        <div style={{ padding: "22px 28px 26px", display: "flex", gap: 24, alignItems: "flex-start" }}>
          {/* diploma */}
          <div className="wf-card tc" style={{ flex: 1, padding: "26px 28px", borderTop: "3px solid " + O, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "center" }}><Medal kind="cert" label="NIVEAU 1" /></div>
            <div className="wf-ey mt10" style={{ letterSpacing: ".18em" }}>KOMPETENCES DECLICK · Certificat</div>
            <div className="wf-h xl mt8">Certificat de Niveau 1</div>
            <div className="wf-sub mt6" style={{ maxWidth: 460, margin: "6px auto 0" }}>Gestion du Temps & Productivité en Environnements Professionnels Africains</div>
            <div className="wf-meta mt12">décerné à</div>
            <div className="wf-h lg mt4">Aminata Diallo</div>
            <div className="row gap14 center mt14" style={{ justifyContent: "center" }}>
              <span className="wf-meta">14 mars 2026</span><span className="wf-meta">·</span><span className="wf-meta">Score 78/100</span><span className="wf-meta">·</span><span className="wf-meta">ID 8F2A-2026</span>
            </div>
            <div className="row gap24 mt16" style={{ justifyContent: "center", gap: 40 }}>
              <div style={{ textAlign: "center" }}><div style={{ width: 120, height: 1, background: "var(--wf-line-2)" }} /><div className="wf-meta mt4">Évaluateur</div></div>
              <div style={{ textAlign: "center" }}><div style={{ width: 120, height: 1, background: "var(--wf-line-2)" }} /><div className="wf-meta mt4">Kompetences Declick</div></div>
            </div>
            <div className="row gap6 mt16" style={{ justifyContent: "center" }}><span className="wf-chip member" style={{ fontSize: 9 }}><span className="dot" />Domaine D4 · N1</span><span className="wf-chip" style={{ fontSize: 9 }}>Open Badges 2.0</span></div>
          </div>
          {/* actions */}
          <div style={{ flex: "0 0 280px" }}>
            <div className="wf-card" style={{ padding: 14 }}>
              <div className="wf-h md" style={{ fontSize: 13 }}>Valoriser votre certificat</div>
              <div className="mt10"><Btn kind="go" block>Ajouter à LinkedIn</Btn></div>
              <div className="wf-meta mt6">Import direct via Open Badges 2.0 — en un clic.</div>
            </div>
            <div className="wf-card soft mt12" style={{ padding: 14 }}>
              <div className="wf-ey" style={{ marginBottom: 8 }}>Vérification employeur</div>
              <div className="wf-input" style={{ fontFamily: "var(--wf-mono)", fontSize: 9.5, color: "var(--wf-ink-3)" }}>verify.declick.kompetences.net/c/8F2A-…</div>
              <div className="wf-meta mt8" style={{ color: "var(--wf-ink-2)" }}>URL publique : un employeur vérifie l'authenticité sans compte ni action de l'apprenant.</div>
              <div className="mt10"><Btn block sm>Copier le lien de vérification</Btn></div>
            </div>
          </div>
        </div>
      </Win>
      <div className="wf-notes">
        <div className="wf-notes__h">Desktop = secondaire</div>
        <Note n={1} lvl="non" cite="§7.6" text="Certificat émis < 60 s après validation de l'évaluateur (score ≥ 70/100)." />
        <Note n={2} lvl="non" cite="§7.6" text="Open Badges 2.0 + import LinkedIn ; partage en un clic." />
        <Note n={3} lvl="crit" cite="§7.6" text="Vérification employeur via URL/API publique, sans accès plateforme." />
      </div>
    </div>
  );

  return (
    <DCSection id="block4" title="⑥ Block 4 — Mini-projet certifiant" subtitle="Le cycle complet dans la plateforme : déblocage (quiz ≥ 70 %) + sujet ancré sur le Moment d'Ancrage + dépôt (apprenant) · notation /100 sur 6 critères adossés au référentiel D4 (évaluateur) · certificat vérifiable (mobile + desktop)">
      <DCArtboard id="learner" label="Apprenant · sujet + grille + dépôt" width={616} height={676}>{Learner}</DCArtboard>
      <DCArtboard id="eval" label="Évaluateur · notation par grille (desktop)" width={1180} height={648}>{Eval}</DCArtboard>
      <DCArtboard id="cert" label="Mobile · certificat + vérification" width={616} height={560}>{Cert}</DCArtboard>
      <DCArtboard id="cdesk" label="Desktop · certificat + vérification" width={1180} height={560}>{Cdesk}</DCArtboard>
    </DCSection>
  );
}
window.buildBlock4 = buildBlock4;
