// hf-block4.jsx — Hi-fi Block 4: learner (mobile) · evaluator (desktop) · certificate (mobile + desktop).

function buildHfBlock4() {
  const critList = [["Organisation personnelle (D4.C1)", "20"], ["Gestion des priorités (D4.C2)", "20"], ["Gestion du temps & interruptions (D4.C3)", "20"], ["Performance durable + journal (D4.C4)", "15"], ["Ancrage culturel africain", "10"], ["Profondeur de l'apprentissage", "15"]];
  const crit = [["Organisation personnelle (D4.C1)", 20, 16], ["Gestion des priorités (D4.C2)", 20, 15], ["Gestion du temps & interruptions (D4.C3)", 20, 16], ["Performance durable + journal (D4.C4)", 15, 12], ["Ancrage culturel africain (transversal)", 10, 8], ["Profondeur de l'apprentissage (transversal)", 15, 11]];

  // ---- learner mobile ----
  const Learner = (
    <HAnnotated title="Côté apprenant" notes={[
      "Bloc 4 verrouillé tant que le quiz final Bloc 3 n'atteint pas 70 % (Niveau 1).",
      "La Section 1 est pré-remplie avec le Moment d'Ancrage du Bloc 0.",
      "La grille (6 critères, réf. D4, /100) est visible AVANT le dépôt.",
    ]}>
      <HPhone tab="award">
        <div style={{ padding: "8px 2px 0" }}><div className="hf-eyebrow">Bloc 4 · Mini-projet certifiant</div><div className="hf-h1 mt6" style={{ fontSize: 24 }}>Votre livrable certifiant</div></div>
        <div className="hf-card hf-card--mint hf-card--tight mt12 hf-row g10" style={{ alignItems: "center", boxShadow: "none" }}><span className="hf-check"><HIco.check style={{ width: 18, height: 18 }} /></span><div className="hf-body" style={{ fontSize: 12.5 }}>Débloqué : quiz final Bloc 3 réussi à <b style={{ color: "var(--navy-600)" }}>75 %</b> (seuil 70 % · Niveau 1)</div></div>
        <div className="mt12"><HPam label="Sujet du mini-projet">Identifier le principal problème de gestion du temps dans <em>votre environnement africain réel</em>, mettre en œuvre une solution adaptée à vos codes culturels, et documenter l'impact sur 14 jours.</HPam></div>
        <div className="hf-row g8 mt10 hf-wrap"><span className="hf-pill hf-pill--sm"><span className="dot" />Domaine D4 · Productivité & organisation</span><span className="hf-pill hf-pill--soft hf-pill--sm">N1 — Fondamentaux</span></div>
        <div className="hf-card mt12">
          <div className="hf-eyebrow" style={{ color: "var(--navy-400)" }}>Grille · réf. D4 · /100 · seuil 70</div>
          <div className="hf-col g8 mt10">
            {critList.map(([c, w]) => <div key={c} className="hf-row hf-between" style={{ alignItems: "baseline", gap: 10 }}><span className="hf-body" style={{ fontSize: 12.5 }}>{c}</span><span className="hf-num" style={{ fontSize: 13, color: "var(--orange-500)" }}>{w}</span></div>)}
          </div>
        </div>
        <div className="hf-card hf-card--icy hf-tc mt12" style={{ border: "1.5px dashed var(--line-strong)" }}>
          <div className="hf-meta" style={{ color: "var(--navy-600)" }}>Déposer un fichier ou rédiger en ligne</div>
          <div className="mt10"><HBtn kind="primary" block arrow>Soumettre mon projet</HBtn></div>
        </div>
      </HPhone>
    </HAnnotated>
  );

  // ---- evaluator desktop ----
  const Eval = (
    <div className="hf">
      <HWin url="app.declick.kompetences.net/admin/evaluation/PRJ-1042">
        <div className="hf-appbar" style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)" }}><div className="hf-row g16"><HLogo /><span className="hf-pill hf-pill--soft hf-pill--sm">Espace évaluateur</span></div><span className="hf-pill hf-pill--orange hf-pill--sm"><HIco.clock style={{ width: 13, height: 13 }} />Retour sous 5 j ouvrables · alerte admin si non noté</span></div>
        <div style={{ display: "flex", minHeight: 480 }}>
          <div style={{ flex: "1 1 0", padding: 24, borderRight: "1px solid var(--line)" }}>
            <div className="hf-eyebrow">Projet soumis · PRJ-1042</div>
            <div className="hf-h2 mt6">Aminata D. — Niveau 1</div>
            <div className="hf-row g8 mt10"><span className="hf-pill hf-pill--soft hf-pill--sm">Soumis le 14/03</span><span className="hf-pill hf-pill--soft hf-pill--sm">Gestion du temps</span></div>
            <div className="mt14" style={{ maxWidth: 460 }}><HPam>Ancré sur : <em>dossier prioritaire qui n'avance jamais</em></HPam></div>
            <div className="hf-card mt16"><div className="hf-meta">Livrable — 5 sections + journal 6 entrées</div><div className="hf-col g8 mt10">{[1, 2, 3].map(i => <div key={i} className="hf-prog" style={{ background: "var(--navy-50)", height: 8 }}><i style={{ width: (90 - i * 12) + "%", background: "var(--navy-200)" }} /></div>)}</div><div className="hf-row g8 mt12"><span className="hf-pill hf-pill--soft hf-pill--sm">projet.pdf</span><span className="hf-pill hf-pill--mint hf-pill--sm">journal 6/6</span></div></div>
          </div>
          <div style={{ flex: "0 0 364px", padding: 24 }}>
            <div className="hf-eyebrow" style={{ color: "var(--navy-400)" }}>Notation par critère · réf. D4 · /100</div>
            <div className="hf-col g10 mt12">
              {crit.map(([c, w, sc]) => (
                <div key={c}><div className="hf-row hf-between" style={{ alignItems: "baseline" }}><span className="hf-body" style={{ fontSize: 12, fontWeight: 600, color: "var(--navy-700)" }}>{c}</span><span className="hf-num" style={{ fontSize: 12, color: "var(--orange-500)" }}>{sc}/{w}</span></div><div className="mt4"><HProg pct={sc / w * 100} mint /></div></div>
              ))}
            </div>
            <div className="hf-card hf-card--mint hf-card--tight mt14 hf-row hf-between" style={{ alignItems: "center", boxShadow: "none" }}><span className="hf-h4" style={{ fontSize: 13 }}>Total · seuil 70</span><span className="hf-num" style={{ fontSize: 22, color: "#1c7a39" }}>78 / 100</span></div>
            <div className="hf-textwrap mt12"><div className="hf-field" style={{ minHeight: 54, fontSize: 13 }}><span className="ph">Feedback écrit structuré…</span></div></div>
            <div className="hf-row g8 mt12"><HBtn kind="declick" sm>Valider · Certifier</HBtn><HBtn kind="outline" sm>Demander révision</HBtn></div>
          </div>
        </div>
      </HWin>
      <div className="hf-notes"><div className="hf-notes__h">Côté évaluateur</div><HNote n={1} t="6 critères adossés au référentiel D4 (C1–C4 + 2 transversaux), notés séparément ; total /100 auto." /><HNote n={2} t="Tout le cycle dans la plateforme — jamais par email." /><HNote n={3} t="Validation humaine · retour sous 5 jours ouvrables." /></div>
    </div>
  );

  // ---- certificate mobile ----
  const Cert = (
    <HAnnotated title="Certificat & vérification" notes={[
      "Certificat émis < 60 s après validation de l'évaluateur (≥ 70/100).",
      "Open Badges 2.0 + import LinkedIn en un tap.",
      "Vérification employeur via URL/API publique, sans accès plateforme.",
    ]}>
      <HPhone>
        <div className="hf-tc" style={{ paddingTop: 16 }}>
          <div style={{ display: "grid", placeItems: "center" }}><HMedal kind="cert" label="Niveau 1" lg /></div>
          <div className="hf-h1 mt12" style={{ fontSize: 22 }}>Certificat de Niveau 1 obtenu</div>
          <div className="hf-body mt8">Gestion du Temps & Productivité en Environnements Professionnels Africains · délivré par Kompetences Declick</div>
        </div>
        <div className="hf-card hf-card--peach mt16"><div className="hf-meta" style={{ color: "var(--orange-700)" }}>Conforme Open Badges 2.0</div><div className="mt10"><HBtn kind="declick" block><HIco.linkedin style={{ width: 16, height: 16 }} />Ajouter à LinkedIn</HBtn></div></div>
        <div className="hf-card hf-card--tight mt12"><div className="hf-eyebrow" style={{ color: "var(--navy-400)" }}>Vérification employeur · URL publique</div><div className="hf-field mt8" style={{ fontSize: 11.5, padding: "10px 12px", color: "var(--fg-3)" }}>verify.declick.kompetences.net/c/8F2A-…</div><div className="hf-meta mt8">Vérifiable sans compte ni action de l'apprenant.</div></div>
      </HPhone>
    </HAnnotated>
  );

  // ---- certificate desktop ----
  const Cdesk = (
    <div className="hf">
      <HWin url="app.declick.kompetences.net/cours/gestion-du-temps-n1/certificat">
        <div className="hf-appbar" style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)" }}><div className="hf-row g16"><HLogo /><span className="hf-pill hf-pill--soft hf-pill--sm">Certificat obtenu</span></div><span className="hf-pill hf-pill--mint hf-pill--sm">Validé · 78 / 100</span></div>
        <div style={{ padding: "26px 28px", display: "flex", gap: 24, alignItems: "flex-start" }}>
          <div className="hf-card hf-card--stripe-orange hf-tc" style={{ flex: 1, padding: "30px 32px" }}>
            <div style={{ display: "grid", placeItems: "center" }}><HMedal kind="cert" label="Niveau 1" lg /></div>
            <div className="hf-eyebrow mt12" style={{ letterSpacing: ".18em" }}>KOMPETENCES DECLICK · Certificat</div>
            <div className="hf-h1 mt8">Certificat de Niveau 1</div>
            <div className="hf-body mt8" style={{ maxWidth: 460, margin: "8px auto 0", fontSize: 15 }}>Gestion du Temps & Productivité en Environnements Professionnels Africains</div>
            <div className="hf-meta mt16">décerné à</div>
            <div className="hf-h2 mt4">Aminata Diallo</div>
            <div className="hf-row g14 mt16" style={{ justifyContent: "center" }}><span className="hf-meta">14 mars 2026</span><span className="hf-meta">·</span><span className="hf-meta">Score 78/100</span><span className="hf-meta">·</span><span className="hf-meta">ID 8F2A-2026</span></div>
            <div className="hf-row mt20" style={{ justifyContent: "center", gap: 48 }}>
              <div className="hf-tc"><div style={{ width: 130, height: 1.5, background: "var(--line-strong)" }} /><div className="hf-meta mt6">Évaluateur</div></div>
              <div className="hf-tc"><div style={{ width: 130, height: 1.5, background: "var(--line-strong)" }} /><div className="hf-meta mt6">Kompetences Declick</div></div>
            </div>
            <div className="hf-row g8 mt16" style={{ justifyContent: "center" }}><span className="hf-pill hf-pill--sm"><span className="dot" />Domaine D4 · N1</span><span className="hf-pill hf-pill--soft hf-pill--sm">Open Badges 2.0</span></div>
          </div>
          <div style={{ flex: "0 0 300px" }}>
            <div className="hf-card"><div className="hf-h3">Valoriser votre certificat</div><div className="mt12"><HBtn kind="declick" block><HIco.linkedin style={{ width: 16, height: 16 }} />Ajouter à LinkedIn</HBtn></div><div className="hf-meta mt8">Import direct via Open Badges 2.0 — en un clic.</div></div>
            <div className="hf-card hf-card--icy mt12"><div className="hf-eyebrow" style={{ color: "var(--navy-500)" }}>Vérification employeur</div><div className="hf-field mt8" style={{ fontSize: 11.5, padding: "10px 12px", color: "var(--fg-3)", background: "#fff" }}>verify.declick.kompetences.net/c/8F2A-…</div><div className="hf-body mt10" style={{ fontSize: 12.5 }}>URL publique : un employeur vérifie l'authenticité sans compte ni action de l'apprenant.</div><div className="mt12"><HBtn kind="outline" sm block>Copier le lien</HBtn></div></div>
          </div>
        </div>
      </HWin>
      <div className="hf-notes"><div className="hf-notes__h">Desktop = secondaire</div><HNote n={1} t="Certificat émis < 60 s après validation de l'évaluateur (≥ 70/100)." /><HNote n={2} t="Open Badges 2.0 + import LinkedIn ; partage en un clic." /><HNote n={3} t="Vérification employeur via URL/API publique, sans accès plateforme." /></div>
    </div>
  );

  return (
    <DCSection id="hf-block4" title="⑥ Block 4 — Mini-projet certifiant — hi-fi" subtitle="Déblocage + sujet (Moment d'Ancrage) + dépôt · notation /100 sur 6 critères réf. D4 · certificat vérifiable · design system Declick">
      <DCArtboard id="learner" label="Mobile · sujet + grille + dépôt" width={644} height={968}>{Learner}</DCArtboard>
      <DCArtboard id="eval" label="Desktop · évaluateur (notation D4)" width={1228} height={648}>{Eval}</DCArtboard>
      <DCArtboard id="cert" label="Mobile · certificat" width={644} height={680}>{Cert}</DCArtboard>
      <DCArtboard id="cdesk" label="Desktop · certificat + vérification" width={1228} height={652}>{Cdesk}</DCArtboard>
    </DCSection>
  );
}
window.buildHfBlock4 = buildHfBlock4;
