// hf-engagement.jsx — Hi-fi journal + re-engagement + peer (mobile + desktop).

function buildHfEngagement() {
  const entries = [
    ["J+1", "Première réaction concrète de votre environnement africain.", "done"],
    ["J+3", "Quel obstacle africain réel avez-vous rencontré, et comment l'avez-vous géré ?", "now"],
    ["J+5", "Un changement dans votre façon de répondre aux sollicitations ?", "todo"],
    ["J+7", "Qu'avez-vous partagé avec votre pair de progression ?", "todo"],
    ["J+10", "Votre micro-victoire de productivité la plus significative.", "todo"],
    ["J+14", "Ce que le parcours a transformé + vos 3 prochaines occasions.", "todo"],
  ];

  // ---- journal mobile ----
  const Journal = (
    <HAnnotated notes={[
      "Déclenchement automatique (push/in-app) à J+1, +3, +5, +7, +10, +14 — même inactif.",
      "Prompt généré dynamiquement avec le Moment d'Ancrage — jamais générique.",
      "6 micro-entrées de 5 min ; leur régularité est notée dans la grille (D4.C4).",
    ]}>
      <HPhone tab="journal">
        <div className="hf-appbar" style={{ padding: "10px 2px" }}><HLogo /><span className="hf-pill hf-pill--soft hf-pill--sm">Bloc 4</span></div>
        <div style={{ padding: "8px 2px 0" }}>
          <div className="hf-eyebrow">Journal de suivi · micro-entrée J+3</div>
          <div className="hf-h1 mt6" style={{ fontSize: 23 }}>Votre rendez-vous réflexif</div>
          <div className="hf-meta mt4">5 min · 50 à 100 mots</div>
        </div>
        <div className="mt14"><HPam>« Vous aviez décrit <em>votre journée à courir après le WhatsApp</em>. Quel obstacle africain réel avez-vous rencontré en appliquant votre solution, et comment l'avez-vous géré ? »</HPam></div>
        <div className="hf-textwrap mt12"><div className="hf-field" style={{ minHeight: 120 }}><span className="ph">Votre réflexion…</span></div><span className="hf-count">50–100 mots</span></div>
        <div className="mt12"><HBtn kind="declick" block>Enregistrer l'entrée</HBtn></div>
        <div className="mt16">
          <div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 10 }}>Vos 6 micro-entrées</div>
          <div className="hf-row hf-wrap g8">
            {[["J+1", "done"], ["J+3", "now"], ["J+5", "todo"], ["J+7", "todo"], ["J+10", "todo"], ["J+14", "todo"]].map(([d, s]) => (
              <span key={d} className={"hf-pill hf-pill--sm" + (s === "done" ? " hf-pill--mint" : s === "now" ? " hf-pill--orange" : " hf-pill--soft")}>{s === "done" ? <HIco.check style={{ width: 12, height: 12 }} /> : <HIco.clock style={{ width: 12, height: 12 }} />}{d}</span>
            ))}
          </div>
          <div className="hf-meta mt10">Micro-entrée 2 / 6 · chaque entrée débloque un élément de la certification.</div>
        </div>
      </HPhone>
    </HAnnotated>
  );

  // ---- journal desktop ----
  const Jdesk = (
    <div className="hf">
      <HWin url="app.declick.kompetences.net/cours/gestion-du-temps-n1/bloc-4/journal">
        <div className="hf-appbar" style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)" }}><div className="hf-row g16"><HLogo /><span className="hf-pill hf-pill--soft hf-pill--sm">Bloc 4 · Journal de suivi</span></div><span className="hf-meta" style={{ fontWeight: 700 }}>Micro-entrée 2 / 6</span></div>
        <div style={{ display: "flex", minHeight: 460 }}>
          <div style={{ flex: "1 1 0", padding: 24, borderRight: "1px solid var(--line)" }}>
            <div className="hf-eyebrow">Micro-entrée J+3 · 5 min · 50 à 100 mots</div>
            <div className="hf-h2 mt6">Votre rendez-vous réflexif</div>
            <div className="mt14" style={{ maxWidth: 540 }}><HPam>« Vous aviez décrit <em>votre journée à courir après le WhatsApp</em>. Quel obstacle africain réel avez-vous rencontré en appliquant votre solution, et comment l'avez-vous géré ? »</HPam></div>
            <div className="hf-textwrap mt14" style={{ maxWidth: 540 }}><div className="hf-field" style={{ minHeight: 130 }}><span className="ph">Votre réflexion…</span></div><span className="hf-count">50–100 mots</span></div>
            <div className="hf-row g14 mt14" style={{ alignItems: "center" }}><HBtn kind="declick">Enregistrer l'entrée</HBtn><span className="hf-meta">Prochaine relance auto : J+5</span></div>
          </div>
          <div style={{ flex: "0 0 360px", padding: 24 }}>
            <div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 12 }}>Vos 6 micro-entrées</div>
            <div className="hf-col g8">
              {entries.map(([d, q, s]) => (
                <div key={d} className="hf-card hf-card--tight hf-row g10" style={{ boxShadow: "none", alignItems: "flex-start", borderLeft: "4px solid " + (s === "done" ? "var(--brand-declick)" : s === "now" ? "var(--orange-500)" : "var(--line-strong)"), opacity: s === "todo" ? .72 : 1, padding: "10px 12px" }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", flex: "0 0 24px", display: "grid", placeItems: "center", background: s === "done" ? "var(--brand-declick)" : s === "now" ? "var(--orange-500)" : "var(--bg-soft)", color: s === "todo" ? "var(--fg-3)" : "#fff" }}>{s === "done" ? <HIco.check style={{ width: 12, height: 12 }} /> : s === "now" ? <HIco.bell style={{ width: 12, height: 12 }} /> : <HIco.clock style={{ width: 11, height: 11 }} />}</span>
                  <div className="hf-grow"><div className="hf-h4" style={{ fontSize: 12.5 }}>{d}</div><div className="hf-meta mt2" style={{ lineHeight: 1.35 }}>{q}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </HWin>
      <div className="hf-notes"><div className="hf-notes__h">Desktop = secondaire</div><HNote n={1} t="Déclenchement auto J+1…+14, push/email, même inactif." /><HNote n={2} t="Chaque prompt cite le Moment d'Ancrage." /><HNote n={3} t="Régularité notée dans la grille (Performance durable, D4.C4)." /></div>
    </div>
  );

  // ---- re-engagement mobile (centre de relance) ----
  const relMobile = [
    ["J+3", "Email + Push", "mint", "Votre parcours vous attend", <span className="hf-body" style={{ fontSize: 12.5 }}>Vous en étiez à <b>Bloc 1 · 1.2</b>. Il vous reste <b>≈ 1 h</b> pour ce bloc.</span>],
    ["J+7", "Email + SMS/WhatsApp", "orange", "Votre raison de départ", <HPam>« La situation que vous avez décrite — <em>votre dossier prioritaire qui n'avance jamais</em> — mérite ces outils. Reprenez quand vous avez 15 minutes. »</HPam>],
    ["J+14", "Alerte admin", "navy", "Escalade humaine", <span className="hf-body" style={{ fontSize: 12.5 }}>Signalé au responsable / RH (si entreprise) — pour une relance humaine.</span>],
  ];
  const Seq = (
    <HAnnotated notes={[
      "3 relances déclenchées par l'inactivité : J+3 positionnelle, J+7 PAM, J+14 escalade.",
      "Le J+7 cite le Moment d'Ancrage en entier — message le plus efficace.",
      "Indépendantes des digests, timing précis, jamais culpabilisantes.",
    ]}>
      <HPhone tab="home">
        <div style={{ padding: "8px 2px 0" }}><div className="hf-eyebrow">Séquence de relance · automatique</div><div className="hf-h1 mt6" style={{ fontSize: 23 }}>Reprendre le fil</div></div>
        <div className="hf-col g12 mt14">
          {relMobile.map(([d, ch, c, title, body], i) => (
            <div key={d} className={"hf-card " + (c === "orange" ? "hf-card--stripe-orange hf-card--peach" : c === "mint" ? "hf-card--stripe-mint" : "")} style={c === "navy" ? { borderLeft: "4px solid var(--navy-600)" } : null}>
              <div className="hf-row hf-between" style={{ alignItems: "center" }}><span className="hf-eyebrow" style={{ color: c === "mint" ? "#1c7a39" : c === "navy" ? "var(--navy-600)" : "var(--orange-600)" }}>Relance {d}</span><span className="hf-pill hf-pill--soft hf-pill--sm">{ch}</span></div>
              <div className="hf-h4 mt8">{title}</div>
              <div className="mt8">{body}</div>
              {c !== "navy" && <div className="mt10"><HBtn kind={c === "orange" ? "primary" : "declick"} sm block arrow>Reprendre exactement ici</HBtn></div>}
            </div>
          ))}
        </div>
      </HPhone>
    </HAnnotated>
  );

  // ---- re-engagement desktop ----
  const relances = [["J+3", "Email + Push", "Rappel positionnel", "envoyée", "var(--brand-declick)"], ["J+7", "Email + SMS/WhatsApp", "Reconnexion au Moment d'Ancrage", "en cours", "var(--orange-500)"], ["J+14", "Alerte admin + Email", "Escalade humaine", "à venir", "var(--navy-600)"]];
  const SeqDesk = (
    <div className="hf">
      <HWin url="app.declick.kompetences.net/admin/relances/aminata-d">
        <div className="hf-appbar" style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)" }}><div className="hf-row g16"><HLogo /><span className="hf-pill hf-pill--soft hf-pill--sm">Séquence de relance · automatique</span></div><span className="hf-meta">Aminata D. · inactive depuis 7 j</span></div>
        <div style={{ display: "flex", minHeight: 420 }}>
          <div style={{ flex: "0 0 300px", borderRight: "1px solid var(--line)", padding: 18 }}>
            <div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 12 }}>Déclencheurs d'inactivité</div>
            <div className="hf-col g10">
              {relances.map(([d, ch, t, st, c]) => (
                <div key={d} className="hf-card hf-card--tight" style={{ borderLeft: "4px solid " + c, background: st === "en cours" ? "var(--orange-50)" : "var(--bg)" }}>
                  <div className="hf-row hf-between" style={{ alignItems: "center" }}><span className="hf-h4" style={{ fontSize: 13 }}>{d}</span><span className="hf-meta" style={{ fontWeight: 700 }}>{st}</span></div>
                  <div className="hf-body mt4" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--navy-700)" }}>{t}</div>
                  <div className="hf-meta mt2">{ch}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, padding: 24 }}>
            <span className="hf-pill hf-pill--orange hf-pill--sm">J+7 · Email + SMS/WhatsApp</span>
            <div className="hf-h2 mt10">Votre raison de départ</div>
            <div className="hf-meta mt6">À : Aminata D. · déclenché automatiquement · jamais groupé avec un digest</div>
            <div className="mt14" style={{ maxWidth: 580 }}><HPam>« La situation que vous avez décrite — <em>votre dossier prioritaire qui n'avance jamais</em> — mérite les outils de ce parcours. Vous êtes à 38 %. Reprenez quand vous avez 15 minutes. »</HPam></div>
            <div className="hf-row g14 mt16" style={{ alignItems: "center" }}><HBtn kind="primary" arrow>Reprendre exactement ici</HBtn><span className="hf-meta">Lien profond → Bloc 1 · 1.2</span></div>
          </div>
        </div>
      </HWin>
      <div className="hf-notes"><div className="hf-notes__h">Desktop = secondaire</div><HNote n={1} t="3 relances d'inactivité : J+3 positionnelle, J+7 PAM, J+14 escalade." /><HNote n={2} t="Le J+7 cite le Moment d'Ancrage en entier — le plus efficace." /><HNote n={3} t="Indépendantes des digests, timing précis, jamais génériques." /></div>
    </div>
  );

  // ---- peer mobile ----
  const Peer = (
    <HAnnotated title="Notification au pair" notes={[
      "Pair désigné au Bloc 0, obligatoire pour le Badge Entrée.",
      "Délivrable par email ET SMS/WhatsApp — l'email seul ne suffit pas.",
      "100 % automatique : l'apprenant ne choisit pas si son pair est prévenu.",
    ]}>
      <HPhone>
        <div style={{ padding: "8px 2px 0" }}><div className="hf-eyebrow">Ce que reçoit le pair · automatique</div><div className="hf-h1 mt6" style={{ fontSize: 22 }}>Vue du pair de progression</div></div>
        <div className="hf-card hf-card--mint mt14" style={{ borderLeft: "4px solid var(--brand-declick)" }}>
          <div className="hf-row hf-between" style={{ alignItems: "center" }}><span className="hf-pill hf-pill--mint hf-pill--sm">WhatsApp / SMS</span><span className="hf-meta">il y a 12 min</span></div>
          <div className="hf-body mt10" style={{ fontSize: 13 }}><b style={{ color: "var(--navy-600)" }}>Aminata D.</b> vient de débloquer le <b style={{ color: "var(--navy-600)" }}>Badge Compréhension (Bloc 1)</b> du parcours « Gestion du temps & productivité ».</div>
        </div>
        <div className="hf-card hf-card--tight mt12"><div className="hf-row hf-between" style={{ alignItems: "center" }}><span className="hf-pill hf-pill--soft hf-pill--sm">Email</span><span className="hf-meta">Bloc 0 terminé</span></div><div className="hf-body mt8" style={{ fontSize: 12.5 }}>Aminata a obtenu son Badge Entrée.</div></div>
        <div className="hf-card hf-card--icy hf-card--tight mt12"><div className="hf-meta" style={{ color: "var(--navy-600)" }}>Information seulement — aucune action attendue du pair. Envoyé dans les 2 h suivant chaque bloc.</div></div>
      </HPhone>
    </HAnnotated>
  );

  // ---- peer desktop (inbox) ----
  const PeerDesk = (
    <div className="hf">
      <HWin url="mail.exemple.net · boîte de réception du pair">
        <div className="hf-appbar" style={{ padding: "14px 24px", borderBottom: "1px solid var(--line)" }}><div className="hf-row g10"><div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg-tint)", display: "grid", placeItems: "center", color: "var(--navy-500)" }}><HIco.user style={{ width: 17, height: 17 }} /></div><div><div className="hf-h4" style={{ fontSize: 13 }}>M. Diallo</div><div className="hf-meta">Pair de progression · boîte de réception</div></div></div><span className="hf-pill hf-pill--soft hf-pill--sm">Information seulement</span></div>
        <div style={{ display: "flex", minHeight: 420 }}>
          <div style={{ flex: "0 0 300px", borderRight: "1px solid var(--line)", padding: 14 }}>
            {[["Badge Compréhension", "Bloc 1 · débloqué · il y a 12 min", "WhatsApp", true], ["Badge Entrée", "Bloc 0 · débloqué · 02/03", "Email", false]].map(([t, m, ch, unread], i) => (
              <div key={i} className="hf-card hf-card--tight" style={{ marginBottom: 10, borderLeft: "4px solid " + (unread ? "var(--brand-declick)" : "var(--line-strong)"), background: unread ? "var(--brand-declick-tint)" : "var(--bg)", boxShadow: "none" }}>
                <div className="hf-row hf-between" style={{ alignItems: "center" }}><span className="hf-h4" style={{ fontSize: 13, fontWeight: unread ? 800 : 700 }}>{t}</span><span className="hf-pill hf-pill--soft hf-pill--sm">{ch}</span></div>
                <div className="hf-meta mt4">{m}</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, padding: 24 }}>
            <span className="hf-pill hf-pill--mint hf-pill--sm">WhatsApp / SMS · automatique</span>
            <div className="hf-h2 mt10">Aminata avance dans son parcours</div>
            <div className="hf-card mt14" style={{ maxWidth: 540 }}><div className="hf-body" style={{ fontSize: 14 }}><b style={{ color: "var(--navy-600)" }}>Aminata D.</b> vient de débloquer le <b style={{ color: "var(--navy-600)" }}>Badge Compréhension (Bloc 1)</b> du parcours « Gestion du temps & productivité en environnements professionnels africains ».</div><div className="hf-meta mt12">Vous recevez ce message car Aminata vous a désigné comme pair de progression. Aucune action n'est attendue.</div></div>
            <div className="hf-meta mt14">Envoyé automatiquement par la plateforme, dans les 2 h suivant la fin du bloc.</div>
          </div>
        </div>
      </HWin>
      <div className="hf-notes"><div className="hf-notes__h">Desktop = secondaire</div><HNote n={1} t="Notification automatique au pair à chaque badge — sans action de l'apprenant." /><HNote n={2} t="Délivrable email ET SMS/WhatsApp ; ici la vue inbox du pair." /><HNote n={3} t="Pas un bouton « partager » optionnel : envoi systématique." /></div>
    </div>
  );

  return (
    <DCSection id="hf-engagement" title="⑤ Journal & relances — hi-fi" subtitle="Journal de suivi · séquence de relance J+3/J+7/J+14 · notification au pair — chacun en mobile + desktop · design system Declick">
      <DCArtboard id="journal" label="Mobile · journal de suivi (J+3)" width={644} height={840}>{Journal}</DCArtboard>
      <DCArtboard id="jdesk" label="Desktop · journal de suivi" width={1228} height={696}>{Jdesk}</DCArtboard>
      <DCArtboard id="seq" label="Mobile · séquence de relance" width={644} height={968}>{Seq}</DCArtboard>
      <DCArtboard id="seqdesk" label="Desktop · séquence de relance (J+7)" width={1228} height={560}>{SeqDesk}</DCArtboard>
      <DCArtboard id="peer" label="Mobile · notification au pair" width={644} height={620}>{Peer}</DCArtboard>
      <DCArtboard id="peerdesk" label="Desktop · notification au pair (inbox)" width={1228} height={560}>{PeerDesk}</DCArtboard>
    </DCSection>
  );
}
window.buildHfEngagement = buildHfEngagement;
